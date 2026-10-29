/**
 * Display formats (N-08, DESIGN.md §7): dates "23-Oct-2026", 24-hour times, INR with Indian
 * digit grouping ("₹1,00,000"). Times show in the organisation's timezone (IST by default).
 */

// Explicit month names: ICU's en-GB short month for September is "Sept" in recent releases.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

let displayTimeZone = "Asia/Kolkata";

export function setDisplayTimeZone(timeZone: string): void {
  displayTimeZone = timeZone;
}

type DateInput = string | Date | null | undefined;

function zonedParts(date: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** "23-Oct-2026". Date-only strings (YYYY-MM-DD) are never shifted by timezone. */
export function formatDate(value: DateInput, timeZone = displayTimeZone): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = DATE_ONLY.exec(value);
    if (m) return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}`;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const p = zonedParts(date, timeZone);
  return `${p.day!.padStart(2, "0")}-${MONTHS[Number(p.month) - 1]}-${p.year}`;
}

/** "14:30" (24-hour). */
export function formatTime(value: DateInput, timeZone = displayTimeZone): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const p = zonedParts(date, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** "23-Oct-2026 14:30". */
export function formatDateTime(value: DateInput, timeZone = displayTimeZone): string {
  const d = formatDate(value, timeZone);
  return d ? `${d} ${formatTime(value, timeZone)}` : "";
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "₹38,40,000"; paise are shown only when present. */
export function formatINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? inr.format(n) : inrPaise.format(n);
}

const grouped = new Intl.NumberFormat("en-IN");

/** "1,00,000". */
export function formatNumber(n: number): string {
  return grouped.format(n);
}

/** Today's date in the display timezone as YYYY-MM-DD. */
export function todayISO(timeZone = displayTimeZone): string {
  const p = zonedParts(new Date(), timeZone);
  return `${p.year}-${p.month!.padStart(2, "0")}-${p.day!.padStart(2, "0")}`;
}
