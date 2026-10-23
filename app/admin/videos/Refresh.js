"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Боловсруулж буй видео байвал хуудсыг 10 секунд тутам шинэчилж, бэлэн болмогц харуулна
export default function Refresh({ on }) {
  const router = useRouter();
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(t);
  }, [on, router]);
  return null;
}
