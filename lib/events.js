// Эвентийн огноо, календарь. Огноог Улаанбаатарын цагаар (UTC+8) "YYYY-MM-DDTHH:MM" хэлбэрээр хадгалдаг.
export const TZ = "Asia/Ulaanbaatar";
export const WEEKDAYS = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"];
export const WD_SHORT = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

const pad = (n) => String(n).padStart(2, "0");

// Улаанбаатарын одоогийн огноо, цаг
export function nowLocal() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return { y: +p.year, m: +p.month, d: +p.day, iso: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`, day: `${p.year}-${p.month}-${p.day}` };
}

// Даваа = 0 … Ням = 6
export const weekday = (y, m, d) => (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
export const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// Сарын торыг 7 хоногоор (Даваагаас) бүтээнэ
export function monthGrid(y, m) {
  const first = weekday(y, m, 1);
  const cells = [];
  const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
  const pd = daysIn(py, pm);
  for (let i = first - 1; i >= 0; i--) cells.push({ y: py, m: pm, d: pd - i, out: true });
  for (let d = 1; d <= daysIn(y, m); d++) cells.push({ y, m, d });
  const nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y;
  for (let d = 1; cells.length % 7; d++) cells.push({ y: ny, m: nm, d, out: true });
  return cells.map((c) => ({ ...c, key: ymd(c.y, c.m, c.d) }));
}

export function addMonths(y, m, k) {
  const t = y * 12 + (m - 1) + k;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}

// "1 цаг 30 минут" → минут
export function durationMin(s) {
  if (!s) return 60;
  const h = /(\d+(?:[.,]\d+)?)\s*ц/i.exec(s);
  const mi = /(\d+)\s*мин/i.exec(s);
  const dd = /(\d+)\s*өдөр/i.exec(s);
  const t = (h ? parseFloat(h[1].replace(",", ".")) * 60 : 0) + (mi ? +mi[1] : 0) + (dd ? +dd[1] * 1440 : 0);
  return t > 0 ? Math.round(t) : 60;
}

// Орон нутгийн цагийг UTC-ийн "YYYYMMDDTHHMMSSZ" болгоно
function utcStamp(local, addMin = 0) {
  const [d, t = "00:00"] = local.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const ms = Date.UTC(y, mo - 1, da, h - 8, mi + addMin);
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function eventTimes(m) {
  if (!m?.starts_at || !/^\d{4}-\d{2}-\d{2}/.test(m.starts_at)) return null;
  return { start: utcStamp(m.starts_at), end: utcStamp(m.starts_at, durationMin(m.duration)) };
}

export function googleCalUrl(title, m, details, url) {
  const t = eventTimes(m);
  if (!t) return null;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${t.start}/${t.end}`,
    details: `${(details || "").slice(0, 600)}\n\n${url}`,
    location: m.location || "",
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

// "2026.10.17 (Бямба) · 15:00"
export function fmtEventDate(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return s || "";
  const [d, t] = s.split("T");
  const [y, m, dd] = d.split("-").map(Number);
  return `${y}.${pad(m)}.${pad(dd)} (${WEEKDAYS[weekday(y, m, dd)]})${t ? ` · ${t.slice(0, 5)}` : ""}`;
}

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c);
// Утасны / Outlook / Apple календарьт нэмэх .ics файл
export function icsFile({ id, title, body, meta, url }) {
  const t = eventTimes(meta);
  if (!t) return null;
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Science Spark//MN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${id}@science-spark`,
    `DTSTAMP:${now}`,
    `DTSTART:${t.start}`,
    `DTEND:${t.end}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc((body || "").slice(0, 1000) + "\n\n" + url)}`,
    `LOCATION:${esc(meta.location)}`,
    `URL:${url}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}
