/**
 * Utility functions for parsing and formatting UTC dates consistently.
 * The backend stores and transmits timestamps in UTC.
 * If a timestamp string lacks explicit timezone indicators ('Z' or '+/-offset'),
 * parseUTCDate treats it as UTC so the browser converts it accurately to the user's local timezone.
 */

export function parseUTCDate(dateStr?: string | null): Date {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  if (!trimmed.endsWith("Z") && !trimmed.includes("+") && !/T.*\d{2}-\d{2}/.test(trimmed)) {
    return new Date(`${trimmed}Z`);
  }
  return new Date(trimmed);
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return parseUTCDate(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export function formatDate(
  dateStr?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "—";
  try {
    return parseUTCDate(dateStr).toLocaleDateString(undefined, options || {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function formatTime(
  dateStr?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "—";
  try {
    return parseUTCDate(dateStr).toLocaleTimeString([], options || {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
