// Видео хэсгийн тохиргоо. Супер админ Админ > Видео хуудаснаас нийтэд нээнэ (settings.videoPublic).
export let VIDEO_PUBLIC = false;
export function setVideoRules(s) {
  VIDEO_PUBLIC = !!s.videoPublic;
}
// Шинэ видеоны анхны нээх үнэ (оч). 0 = үнэгүй.
export const DEFAULT_PRICE = 100;
// Төгрөгөөр нээх анхны үнэ (хэтэвчнээс). 0 = төгрөгөөр нээх сонголтгүй.
export const DEFAULT_PRICE_MNT = 3000;
export const VIDEO_KIND = "Видео";
