"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Spark from "./Spark";

const DELAY = 150; // хурдан нээгдэх хуудсанд анивчихгүйн тулд
const GIVEUP = 15000; // хуудас ирэхгүй бол очийг нуух

// Сайт доторх холбоос дарахад шинэ хуудас ирэх хүртэл дээд хэсэгт оч гэрэлтэнэ.
// Хуудас бүр өөрийн Shell-тэй тул loading.js биш: одоогийн хуудас харагдсаар байна.
export default function NavLoader() {
  const path = usePathname();
  const query = useSearchParams().toString();
  const [on, setOn] = useState(false);
  const timers = useRef([]);
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => { stop(); setOn(false); }, [path, query]);

  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || /^\/(api|img)\//.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // зөвхөн #хэсэг
      stop();
      timers.current = [setTimeout(() => setOn(true), DELAY), setTimeout(() => setOn(false), GIVEUP)];
    };
    document.addEventListener("click", onClick, true); // capture: Link өөрөө preventDefault хийхээс өмнө
    return () => { stop(); document.removeEventListener("click", onClick, true); };
  }, []);

  return (
    <div className={"spk-nav" + (on ? " on" : "")} aria-hidden={!on}>
      <Spark size={30} label={on ? "Хуудас ачаалж байна" : undefined} />
    </div>
  );
}
