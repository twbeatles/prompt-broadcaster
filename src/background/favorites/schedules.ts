export function buildScheduleAlarmName(favoriteId: string) {
  const normalizedFavoriteId =
    typeof favoriteId === "string" ? favoriteId.trim() : "";
  return normalizedFavoriteId ? `apb-schedule:${normalizedFavoriteId}` : "";
}

export function parseScheduleAlarmFavoriteId(alarmName: string) {
  const normalizedAlarmName =
    typeof alarmName === "string" ? alarmName.trim() : "";
  return normalizedAlarmName.startsWith("apb-schedule:")
    ? alarmName.slice("apb-schedule:".length)
    : "";
}

export function computeNextScheduledAt(
  repeat: string,
  scheduledAt: string | null,
  now = new Date(),
) {
  const normalizedRepeat = typeof repeat === "string" ? repeat : "none";
  if (normalizedRepeat === "none") {
    return null;
  }

  const baseDate = Number.isFinite(Date.parse(String(scheduledAt ?? "")))
    ? new Date(String(scheduledAt))
    : new Date(now);
  const nextDate = new Date(baseDate);

  do {
    if (normalizedRepeat === "daily") {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (normalizedRepeat === "weekly") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setDate(nextDate.getDate() + 1);
      while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }
  } while (nextDate.getTime() <= now.getTime());

  return nextDate.toISOString();
}
