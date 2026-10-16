// Огноо: 2026.10.17
export function fmtDate(d) {
  return new Date(d).toISOString().slice(0, 10).replaceAll("-", ".");
}
export const KINDS = ["Нийтлэл", "Асуулт", "Мэдээ"];
