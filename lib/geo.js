
export const inMongolia = (p) => !!p && p.lat >= 41.4 && p.lat <= 52.3 && p.lng >= 87.6 && p.lng <= 120.1;

const num = (s) => Number(String(s).replace(",", "."));
const pair = (a, b) => {
  const lat = num(a), lng = num(b);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

// Координат эсвэл Google Maps-ийн холбоосоос өргөрөг, уртрагийг гаргана.
// Жишээ: «47.9184, 106.9177», «47.9184 106.9177», .../@47.91,106.91,15z, ...!3d47.91!4d106.91, ?q=47.91,106.91, ll=47.91,106.91
export function parseLocation(input) {
  const s = decodeURIComponent(String(input || "").trim()).replace(/\s+/g, " ");
  if (!s) return null;
  let m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) return pair(m[1], m[2]);
  m = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return pair(m[1], m[2]);
  m = s.match(/[?&](?:q|query|ll|sll|center|destination|daddr)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (m) return pair(m[1], m[2]);
  m = s.match(/^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[, ;]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/);
  if (m) return pair(m[1], m[2]);
  m = s.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (m) return pair(m[1], m[2]);
  return null;
}

// Богино холбоос (maps.app.goo.gl, goo.gl/maps) бол чиглүүлсэн хаягийг нь дагаж уншина.
export async function resolveLocation(input) {
  const direct = parseLocation(input);
  if (direct) return direct;
  let url = String(input || "").trim();
  if (!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+|www\.google\.[a-z.]+\/maps)/i.test(url)) return null;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
      const loc = r.headers.get("location");
      if (!loc) {
        if (r.status === 200) {
          const html = (await r.text()).slice(0, 200000);
          const m = html.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || html.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/);
          if (m) return pair(m[1], m[2]);
        }
        return null;
      }
      url = new URL(loc, url).toString();
      const p = parseLocation(url);
      if (p) return p;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Эвентийн байршил: координат/Google холбоос, эс бөгөөс хаягийг OpenStreetMap (Nominatim)-оор хайна.
// Хариуг 30 хоног кэшлэнэ, олдохгүй бол null.
export async function geocodeLocation(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  const direct = await resolveLocation(s);
  if (direct) return direct;
  if (/^https?:/i.test(s)) return null;
  try {
    const q = new URLSearchParams({ q: s, format: "jsonv2", limit: "1", countrycodes: "mn", "accept-language": "mn" });
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { "User-Agent": "ScienceSpark/1.0 (https://sciencespark.mn)" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 2592000 },
    });
    if (!r.ok) return null;
    const [hit] = await r.json();
    return hit ? pair(hit.lat, hit.lon) : null;
  } catch (e) {
    return null;
  }
}
