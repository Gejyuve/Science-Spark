// Зүүн цэсийн товчууд. href-гүй нь «Тун удахгүй» (идэвхгүй). Идэвхтэй товчууд лого­ны 2 талд ээлжлэн гарна.
export const NAV = [
  { icon: "tree", label: "Мод", href: "/tree" },
  { icon: "dict", label: "Толь", href: "/dict" },
  { icon: "event", label: "Эвент", href: "/events" },
  { icon: "club", label: "Клуб", href: "/clubs" },
  { icon: "prize", label: "Шагнал", href: "/san" },
  // superOnly: бэлэн болтол зөвхөн супер админд харагдана
  { icon: "video", label: "Видео", href: "/video", superOnly: true },
  { icon: "game", label: "Тоглоом" },
  { icon: "market", label: "Маркет" },
];

export const LIVE_NAV = NAV.filter((n) => n.href && !n.superOnly);
