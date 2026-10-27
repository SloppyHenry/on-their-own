"""Stellgrößen auf ein fertiges Layout anwenden (AP18f): zweite Häuserzeile, Haufendorf, Seen, Fluss, Gärten, Felder, Bäume, Wald und gerade Wege.

Das Grundlayout (`layout.make_layout`) bleibt unverändert; wer die Vorgaben der `Stil` nimmt, bekommt es genau so zurück. Alles hier benutzt einen eigenen Zufallsstrom
(Seed des Dorfs), damit gleiche Stellgrößen dasselbe Dorf ergeben. Wo etwas nicht passt, wird es ausgelassen und gezählt (`Layout.skipped`).
"""

from .layout_geo import needed_height
from .layout_gaerten import add_fields, add_gardens, add_ponds
from .layout_haeuser import place_buildings
from .layout_welt import adjust_forest, adjust_trees, flatten_paths, set_stream
from .rng import Rng
from .stil import Stil


def apply_stil(lay, p):
    """`lay`: das Grundlayout; Rückgabe dasselbe Objekt, verändert."""
    st: Stil = p.stil
    if st == Stil() and not lay.spare:
        return lay
    rng = Rng(lay.seed * 1299709 + 7)
    if st.wege == "gerade":
        flatten_paths(lay)
    set_stream(lay, st.wasser)
    if st.seen == 0:
        if lay.dock:
            lay.paths = [pl for pl in lay.paths if not (len(pl) == 2 and abs(pl[0][0] - (lay.dock["x0"] - 6)) < 0.5)]      # der Weg zum Steg entfällt
        lay.lake = lay.dock = None
        lay.decor = [d for d in lay.decor if d[0] not in ("reed", "boat")]
    if st.gaerten == 0 and lay.garden is not None:
        _drop_garden(lay)
    south_end = lay.paths[2][-1]
    lay.extra_h = 96                                                      # während des Setzens darf das Dorf nach Süden wachsen; danach wird gekürzt
    place_buildings(lay, rng, st)
    add_ponds(lay, rng, st.seen - 1)
    add_gardens(lay, rng, st.gaerten - 1)
    add_fields(lay, rng, st.felder)
    lay.extra_h = needed_height(lay)
    if lay.extra_h:
        lay.paths[2] = [*lay.paths[2][:-1], (south_end[0], south_end[1] + lay.extra_h)]
        lay.exits["south"] = (round(south_end[0], 1), round(south_end[1] + lay.extra_h, 1))
    adjust_trees(lay, rng, st.baeume)
    adjust_forest(lay, rng, st.wald)
    return lay


def _drop_garden(lay) -> None:
    """Der Gemeinschaftsgarten entfällt: Zaun, Pfosten, Beetpflanzen und der Weg zu ihm."""
    g = lay.garden
    inside = lambda d: g["x0"] - 12 <= d[1] <= g["x1"] + 12 and g["y0"] - 6 <= d[2] <= g["y1"] + 12                    # noqa: E731
    lay.decor = [d for d in lay.decor if not (d[0] in ("fence", "post", "sun", "tomato", "scare") and inside(d)) and not (d[0] == "barrel" and d[3] == 7)]
    lay.paths = [pl for pl in lay.paths if not (len(pl) == 4 and abs(pl[0][0] - g["x1"]) < 0.5 and abs(pl[1][0] - g["x1"] - 10) < 0.5)]
    lay.garden, lay.beds = None, []


def apply_rest(lay, rng, st) -> None:
    """Für die freien Dorfformen: Teiche (der Teich auf der Dorfwiese zählt mit), weitere Gärten und Felder; die Höhe nach Süden hat der Aufrufer schon gesetzt."""
    add_ponds(lay, rng, st.seen - 1 - len(lay.ponds))
    add_gardens(lay, rng, st.gaerten - 1)
    add_fields(lay, rng, st.felder)
