"use client";

import { useEffect } from "react";

// Сонгогдсон шүүлтүүр харагдахгүй байвал түүн рүү хажуу тийш гүйлгэнэ
export default function ScrollActive({ selector, dep }) {
  useEffect(() => {
    const el = document.querySelector(selector);
    const box = el?.parentElement;
    if (!el || !box) return;
    const l = el.offsetLeft - box.offsetLeft;
    if (l + el.offsetWidth > box.scrollLeft + box.clientWidth - 24 || l < box.scrollLeft) {
      box.scrollTo({ left: Math.max(0, l - 40), behavior: "auto" });
    }
  }, [selector, dep]);
  return null;
}
