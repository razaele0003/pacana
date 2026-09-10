import type { Schedule } from "./model";
const formatters = new Map<string, Intl.DateTimeFormat>();
export function parts(ts: number, zone: string) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(zone, f);
  }
  const p = Object.fromEntries(
    f.formatToParts(ts).map((x) => [x.type, x.value]),
  );
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour,
    minute: +p.minute,
    second: +p.second,
  };
}
const civil = (p: ReturnType<typeof parts>) =>
  Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
// Try both sides of a DST transition. Matching candidates skip gaps; minimum selects the first fold occurrence.
export function localInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  zone: string,
): number | null {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set(
    [-36, -12, 0, 12, 36].map((h) => {
      const t = target + h * 3600000;
      return civil(parts(t, zone)) - t;
    }),
  );
  const candidates = [...offsets]
    .map((o) => target - o)
    .filter((t) => civil(parts(t, zone)) === target);
  return candidates.length ? Math.min(...candidates) : null;
}
export const minutes = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
export function nextClock(
  after: number,
  schedule: Schedule,
  zone: string,
): number {
  const p = parts(after, zone);
  const times = schedule.explicit.length
    ? [...new Set(schedule.explicit.map(minutes))].sort((a, b) => a - b)
    : Array.from(
        {
          length:
            Math.floor(
              (minutes(schedule.end) - minutes(schedule.start)) /
                schedule.interval,
            ) + 1,
        },
        (_, i) => minutes(schedule.start) + i * schedule.interval,
      );
  for (let d = 0; d < 15; d++) {
    const date = new Date(Date.UTC(p.year, p.month - 1, p.day + d));
    if (!schedule.days.includes(date.getUTCDay())) continue;
    for (const time of times) {
      const t = localInstant(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        Math.floor(time / 60),
        time % 60,
        zone,
      );
      if (t !== null && t > after) return t;
    }
  }
  throw new Error("Choose at least one weekday and a valid schedule.");
}
export function dayKey(ts: number, zone: string) {
  const p = parts(ts, zone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
