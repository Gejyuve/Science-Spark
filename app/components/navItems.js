// Зүүн цэсийн товчууд. href-гүй нь «Тун удахгүй» (идэвхгүй). Идэвхтэй товчууд лого­ны 2 талд ээлжлэн гарна.
export const NAV = [
  { icon: "tree", label: "Мод", href: "/tree" },
  { icon: "dict", label: "Толь", href: "/dict" },
  { icon: "event", label: "Эвент", href: "/events" },
  { icon: "club", label: "Клуб", href: "/clubs" },
  { icon: "prize", label: "Шагнал", href: "/san" },
  // superOnly: Админ > Видео / Сэтгүүл / Мерчант-аас нийтэд нээтэл зөвхөн супер админд харагдана
  { icon: "video", label: "Видео", href: "/video", superOnly: "video" },
  { icon: "magazine", label: "Сэтгүүл", href: "/magazine", superOnly: "magazine" },
  { icon: "game", label: "Тоглоом" },
  // Маркет: одоогоор мерчантын бүртгэл (Админ > Мерчант-аас нээтэл зөвхөн супер админд)
  { icon: "market", label: "Маркет", href: "/merchant", superOnly: "market" },
];

export const LIVE_NAV = NAV.filter((n) => n.href && !n.superOnly);
