"""Strukturierte Benutzerereignisse (AP08, §10): eine Liste von **Operationen** aus einem festen Katalog.

Nur diese Operationen kann eine Eingabe auslösen; jede läuft durch die Welt-Engine. Orte, Agenten und Objekte sind hier schon als Kennungen aufgelöst
(`lexicon.py` und `validate.py`); das Modell und die Regeln liefern nur Namen, die dort geprüft werden.
"""

from typing import Annotated, Any, ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field

WEATHER = ("clear", "cloudy", "rain", "storm", "fog", "snow")
MAX_OPS = 5
MAX_TEXT = 1000
DAY = 1440


class Op(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scope: ClassVar[str] = "world"                                  # world: passiert in der Welt | directive: direkte Anweisung an einen Agenten (nur im Eingriffsmodus)


class SetWeather(Op):
    op: Literal["set_weather"] = "set_weather"
    weather: Literal["clear", "cloudy", "rain", "storm", "fog", "snow"]
    duration_minutes: int = Field(180, ge=10, le=3 * DAY)


class SpawnObject(Op):
    op: Literal["spawn_object"] = "spawn_object"
    kind: str = "item"
    name: str = Field(min_length=1, max_length=60)
    description: str = Field("", max_length=300)
    location: str | None = None                      # Ortskennung
    tile: list[int] | None = None
    hidden: bool = False
    known_by: list[str] = []                         # Agenten, die es kennen (bei verborgenen Objekten): „Alex findet …“
    state: dict[str, Any] = {}
    duration_minutes: int | None = Field(None, ge=10, le=14 * DAY)     # danach verschwindet es wieder


class GiveObject(Op):
    op: Literal["give_object"] = "give_object"
    kind: str = "item"
    name: str = Field(min_length=1, max_length=60)
    description: str = Field("", max_length=300)
    agent: str


class ChangeObject(Op):
    op: Literal["change_object"] = "change_object"
    kind: str | None = None                          # alle Objekte dieser Art …
    location: str | None = None                      # … am Ort (oder in allen Orten, deren Kennung so beginnt: „house“)
    object_id: str | None = None
    changes: dict[str, Any]
    duration_minutes: int | None = Field(None, ge=10, le=14 * DAY)     # danach wird der alte Zustand wiederhergestellt


class AddLocation(Op):
    op: Literal["add_location"] = "add_location"
    name: str = Field(min_length=1, max_length=40)
    near: str                                        # bestehender Ort
    direction: Literal["north", "south", "east", "west"] = "north"
    kind: str = "area"


class ChangeResource(Op):
    op: Literal["change_resource"] = "change_resource"
    resource: str | None = None                      # None = alle
    location: str | None = None                      # None = überall
    factor: float = Field(1.0, ge=0.1, le=3.0)       # Faktor auf Bestand und Obergrenze
    duration_minutes: int | None = Field(None, ge=10, le=14 * DAY)


class Inform(Op):
    op: Literal["inform"] = "inform"
    recipients: list[str] = Field(min_length=1)
    content: str = Field(min_length=1, max_length=300)
    source: str = Field("", max_length=80)           # wer es erzählt hat oder woher es stammt
    truth: Literal["true", "rumor", "false"] = "true"


class Message(Op):
    op: Literal["message"] = "message"
    recipients: list[str] = Field(min_length=1)
    content: str = Field(min_length=1, max_length=300)
    sender: str = Field("", max_length=60)           # Kennung eines Agenten, „Brief“ oder leer
    invite: bool = False
    when: int | None = None                          # Termin der Einladung (Simulationsminute)
    location: str | None = None


class Schedule(Op):
    op: Literal["schedule"] = "schedule"
    at: int = Field(ge=0)                            # Simulationsminute
    ops: list[dict[str, Any]] = Field(min_length=1)  # die auszuführenden Operationen (werden einzeln geprüft)
    label: str = Field("", max_length=120)
    duration_minutes: int | None = Field(None, ge=10, le=3 * DAY)      # danach endet die Veranstaltung (erzeugte Objekte verschwinden)


class SpawnNpc(Op):
    op: Literal["spawn_npc"] = "spawn_npc"
    name: str = Field(min_length=1, max_length=40)
    description: str = Field("", max_length=300)
    location: str | None = None
    stay_minutes: int = Field(480, ge=30, le=7 * DAY)


class Situation(Op):
    op: Literal["situation"] = "situation"
    agents: list[str] = Field(min_length=1)
    description: str = Field(min_length=1, max_length=300)
    object_kind: str | None = None                   # z. B. „door“
    object_state: dict[str, Any] = {}
    object_name: str | None = None
    location: str | None = None


class MoveAgent(Op):
    op: Literal["move_agent"] = "move_agent"
    scope: ClassVar[str] = "directive"
    agent: str
    location: str


class SuggestGoal(Op):
    op: Literal["suggest_goal"] = "suggest_goal"
    scope: ClassVar[str] = "directive"
    agent: str
    text: str = Field(min_length=1, max_length=200)


class TempParam(Op):
    op: Literal["temp_param"] = "temp_param"
    scope: ClassVar[str] = "directive"
    key: str
    value: Any
    duration_minutes: int = Field(60, ge=10, le=3 * DAY)


AnyOp = Annotated[SetWeather | SpawnObject | GiveObject | ChangeObject | AddLocation | ChangeResource | Inform | Message | Schedule | SpawnNpc | Situation
                  | MoveAgent | SuggestGoal | TempParam, Field(discriminator="op")]
OP_NAMES = ("set_weather", "spawn_object", "give_object", "change_object", "add_location", "change_resource", "inform", "message", "schedule", "spawn_npc", "situation",
            "move_agent", "suggest_goal", "temp_param")


class EventSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ops: list[AnyOp] = Field(min_length=1, max_length=MAX_OPS)


def parse_ops(raw: list[dict[str, Any]]) -> list[Op]:
    """Roh-Operationen in geprüfte Modelle (wirft pydantic.ValidationError bei unbekannter Operation oder Feld)."""
    return EventSpec.model_validate({"ops": raw}).ops
