export function getLocalDateKey(value: string | number | Date): string {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getRelativeLocalDateKey(daysFromToday = 0, now = new Date()): string {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + Math.trunc(daysFromToday));
  return getLocalDateKey(date);
}
