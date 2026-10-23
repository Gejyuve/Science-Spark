// Видео хэсгийн тохиргоо. Супер админ Админ > Видео хуудаснаас нийтэд нээнэ (settings.videoPublic).
export let VIDEO_PUBLIC = false;
export function setVideoRules(s) {
  VIDEO_PUBLIC = !!s.videoPublic;
}
// Дэмжигч сар бүр өөрийн сонгосон ийм тооны видеог нэмэлт төлбөргүй нээнэ (нээсэн видео үүрд нээлттэй)
export const SUPPORT_VIDEOS = 10;
export const VIDEO_KIND = "Видео";
