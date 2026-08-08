const MS_PER_DAY = 86_400_000;
const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;

export function parseIsoDate(value) {
  if (!value || typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function daysBetweenInclusive(from, to) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.floor((end - start) / MS_PER_DAY) + 1;
}

export function resolveReportRange(query = {}) {
  const timezone =
    typeof query.timezone === "string" && query.timezone.trim()
      ? query.timezone.trim()
      : "America/Los_Angeles";

  const today = formatDateInTimezone(new Date().toISOString(), timezone);
  const defaultFrom = addDays(today, -(DEFAULT_RANGE_DAYS - 1));

  const from = parseIsoDate(query.from) ?? defaultFrom;
  let to = parseIsoDate(query.to) ?? today;
  if (from > to) {
    throw new RangeError("from must be on or before to");
  }
  if (daysBetweenInclusive(from, to) > MAX_RANGE_DAYS) {
    throw new RangeError(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }
  return { from, to, timezone };
}

export function formatDateInTimezone(isoTimestamp, timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(isoTimestamp));
}

export function utcDayFromTimestamp(isoTimestamp) {
  return new Date(isoTimestamp).toISOString().slice(0, 10);
}

/**
 * Expand local-date range to UTC partition keys (teacherDay suffix) with ±1 day guard
 * for timezone edges.
 */
export function utcPartitionDaysForRange(from, to, timezone) {
  const days = new Set();
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    days.add(cursor);
    days.add(addDays(cursor, -1));
    days.add(addDays(cursor, 1));
  }

  // Also include UTC day of midnight boundaries for the timezone range endpoints.
  for (const edge of [from, to]) {
    const noonUtc = `${edge}T12:00:00.000Z`;
    days.add(utcDayFromTimestamp(noonUtc));
  }

  return [...days].sort();
}

export function ttlEpochMonths(months = 13) {
  const dt = new Date();
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return Math.floor(dt.getTime() / 1000);
}
