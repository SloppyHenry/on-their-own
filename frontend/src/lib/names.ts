// Deutsche Bezeichnungen für Aktionen, Ressourcen und Status. Unbekanntes wird lesbar durchgereicht, nie verschluckt.
export const RESOURCE_NAMES: Record<string, string> = { food: "Essen", water: "Wasser", wood: "Holz", stone: "Stein", seeds: "Samen", fish: "Fisch", reed: "Schilf" };
export const resourceName = (r: string) => RESOURCE_NAMES[r] ?? r;

/** Aktionstyp -> [Tätigkeit im Präsens, Symbol] */
export const ACTIVITIES: Record<string, [string, string]> = {
  move_to: ["geht", "go"], wait: ["wartet", "think"], speak: ["spricht", "chat"], sleep: ["schläft", "zzz"], rest: ["ruht sich aus", "zzz"],
  build: ["baut", "hammer"], gather: ["sammelt", "leaf"], plant: ["pflanzt", "leaf"], water: ["gießt", "rain"], eat: ["isst", "leaf"],
  drink: ["trinkt", "rain"], inspect: ["schaut sich um", "think"], take: ["nimmt etwas", "hammer"], drop: ["legt etwas ab", "hammer"],
  give: ["gibt etwas", "hammer"], use: ["benutzt etwas", "hammer"],
};

export const STATUS_NAMES: Record<string, [string, string]> = {
  idle: ["frei", "think"], deciding: ["entscheidet", "plan"], acting: ["handelt", "hammer"], talking: ["spricht", "chat"],
  sleeping: ["schläft", "zzz"], stuck: ["steckt fest", "warn"],
};
export const statusName = (s: string): [string, string] => STATUS_NAMES[s] ?? [s, "think"];

export const DIRECTIONS: Record<string, string> = { up: "Norden", down: "Süden", left: "Westen", right: "Osten" };

export const WEATHER_NAMES: Record<string, string> = { clear: "Klar", cloudy: "Bewölkt", rain: "Regen", fog: "Nebel", storm: "Sturm", snow: "Schnee" };
export const weatherName = (k: string) => WEATHER_NAMES[k] ?? k;
