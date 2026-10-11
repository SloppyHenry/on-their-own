"""Die zentrale Liste aller Parameter. Oberfläche, Validierung, Dokumentation und Tests bauen auf ihr auf."""

from . import specs_agents, specs_llm, specs_memory, specs_sim, specs_world
from .spec import GROUPS, ParamSpec

SPEC_LIST: list[ParamSpec] = [*specs_agents.SPECS, *specs_memory.SPECS, *specs_world.SPECS, *specs_llm.SPECS, *specs_sim.SPECS]
REGISTRY: dict[str, ParamSpec] = {s.key: s for s in SPEC_LIST}
assert len(REGISTRY) == len(SPEC_LIST), "doppelter Parameterschlüssel"
assert all(s.group in GROUPS for s in SPEC_LIST)


def schema() -> dict:
    return {"groups": [{"id": k, "label": v} for k, v in GROUPS.items()], "specs": [s.to_schema() for s in SPEC_LIST]}
