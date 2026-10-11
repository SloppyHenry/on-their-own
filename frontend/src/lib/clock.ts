// Uhr der Simulation, spiegelt backend/simulacra/world/clock.py (1 Tick = 1 Minute, Tag 1 beginnt bei 00:00).
import type { ClockInfo } from "../types/generated";

export const MINUTES_PER_DAY = 1440;
export const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const DAWN = [300, 420] as const;
const DUSK = [1140, 1260] as const;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

export const dayOf = (total: number) => Math.floor(total / MINUTES_PER_DAY) + 1;
export const minuteOfDay = (total: number) => ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

export function daylight(total: number): number {
  const m = minuteOfDay(total);
  if (m < DAWN[0] || m >= DUSK[1]) return 0;
  if (m < DAWN[1]) return smooth((m - DAWN[0]) / (DAWN[1] - DAWN[0]));
  if (m < DUSK[0]) return 1;
  return 1 - smooth((m - DUSK[0]) / (DUSK[1] - DUSK[0]));
}

export function phaseOf(total: number): string {
  const m = minuteOfDay(total);
  if (m < DAWN[0] || m >= DUSK[1]) return "night";
  if (m < DAWN[1]) return "dawn";
  if (m < DUSK[0]) return "day";
  return "dusk";
}

export function formatTime(total: number): string {
  const m = minuteOfDay(total);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function clockOf(total: number): ClockInfo {
  return {
    minute: total,
    day: dayOf(total),
    time: formatTime(total),
    weekday: WEEKDAYS[(dayOf(total) - 1) % 7],
    phase: phaseOf(total),
    daylight: Math.round(daylight(total) * 1000) / 1000,
  };
}
