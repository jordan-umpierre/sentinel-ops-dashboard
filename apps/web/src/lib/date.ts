const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const intervals = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 }
] as const;

export function formatRelativeTime(value: string) {
  // The dashboard consumes ISO timestamps from FastAPI. Relative time makes live
  // operational data easier to scan than full timestamps in dense tables.
  const timestamp = new Date(value).getTime();
  const secondsElapsed = Math.round((timestamp - Date.now()) / 1000);
  const interval =
    intervals.find((item) => Math.abs(secondsElapsed) >= item.seconds) ??
    intervals[intervals.length - 1];

  return relativeFormatter.format(
    Math.round(secondsElapsed / interval.seconds),
    interval.unit
  );
}
