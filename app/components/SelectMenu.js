"use client";

import { useEffect } from "react";

// Сайтын бүх <select>-ийн унждаг жагсаалтыг хөтчийнхөөр биш, сайтын загвараар харуулна.
// Жинхэнэ <select> хэвээр үлдэнэ (маягт илгээх, заавал бөглөх шалгалт, React-ийн onChange бүгд ажиллана);
// зөвхөн нээгдэх жагсаалтыг body дээр тусдаа зурж, сонгосон утгыг буцааж <select>-д тавина.
export default function SelectMenu() {
  useEffect(() => {
    let menu = null, sel = null, items = [], active = -1, typed = "", typedAt = 0, touch = null;

    const usable = (el) => el instanceof HTMLSelectElement && !el.multiple && el.size <= 1 && !el.disabled && !el.dataset.native;

    // Харагдах хүрээ: <select>-ийг ороосон хайрцаг (хүрээ, сум бүхий) байвал түүнийг авна
    const anchorOf = (el) => {
      const r = el.getBoundingClientRect();
      const p = el.parentElement;
      if (p && p !== document.body) {
        const q = p.getBoundingClientRect();
        if (q.width <= r.width + 80 && q.height <= r.height + 30) return q;
      }
      return r;
    };

    const close = (focus = true) => {
      if (!menu) return;
      menu.remove();
      menu = null;
      items = [];
      if (focus && sel) sel.focus({ preventScroll: true });
      sel = null;
    };

    const pick = (i) => {
      const o = items[i];
      if (!o || o.disabled || !sel) return close();
      const s = sel;
      if (s.value !== o.value) {
        // React-ийн хяналттай select ч өөрчлөлтийг «change» үйлдлээр хүлээж авна
        const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
        set.call(s, o.value);
        s.dispatchEvent(new Event("input", { bubbles: true }));
        s.dispatchEvent(new Event("change", { bubbles: true }));
      }
      close();
    };

    const highlight = (i, scroll = true) => {
      if (!menu) return;
      menu.querySelector(`[data-i="${active}"]`)?.classList.remove("dd-on");
      active = i;
      const n = menu.querySelector(`[data-i="${i}"]`);
      if (n) {
        n.classList.add("dd-on");
        // Зөвхөн жагсаалтыг дотор нь гүйлгэнэ (хуудас хөдлөхгүй)
        if (scroll) {
          const top = menu.querySelector(".dd-find")?.offsetHeight || 0;
          if (n.offsetTop - top < menu.scrollTop) menu.scrollTop = n.offsetTop - top - 6;
          else if (n.offsetTop + n.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = n.offsetTop + n.offsetHeight - menu.clientHeight + 6;
        }
      }
    };

    const step = (from, dir) => {
      for (let i = from + dir; i >= 0 && i < items.length; i += dir) if (!items[i].disabled && !items[i].out) return i;
      return from;
    };

    const place = () => {
      if (!menu || !sel) return;
      const a = anchorOf(sel);
      const vh = window.innerHeight, vw = window.innerWidth;
      const below = vh - a.bottom - 8, above = a.top - 8;
      const want = Math.min(menu.scrollHeight, 300);
      const up = below < want && above > below;
      const h = Math.min(want, Math.max(up ? above : below, 120));
      const w = Math.max(a.width, 160);
      menu.style.maxHeight = `${h}px`;
      menu.style.width = `${w}px`;
      menu.style.left = `${Math.max(8, Math.min(a.left, vw - w - 8))}px`;
      menu.style.top = up ? `${Math.max(8, a.top - h - 6)}px` : `${a.bottom + 6}px`;
      menu.classList.toggle("dd-up", up);
    };

    const open = (el) => {
      close(false);
      sel = el;
      items = [...el.options].map((o) => ({ value: o.value, label: o.textContent, disabled: o.disabled, hidden: o.hidden }));
      menu = document.createElement("div");
      menu.className = "dd-menu";
      menu.setAttribute("role", "listbox");
      const lab = el.getAttribute("aria-label") || el.labels?.[0]?.textContent;
      if (lab) menu.setAttribute("aria-label", lab.trim());
      // Урт жагсаалтад хайх талбар (жишээ нь шашин, улс)
      let find = null;
      if (items.length > 15) {
        find = document.createElement("input");
        find.className = "dd-find";
        find.type = "search";
        find.placeholder = "Хайх…";
        find.setAttribute("aria-label", "Жагсаалтаас хайх");
        find.addEventListener("input", () => {
          const q = find.value.trim().toLowerCase();
          items.forEach((o, i) => {
            o.out = !!q && !o.label.toLowerCase().includes(q);
            const n = menu.querySelector(`[data-i="${i}"]`);
            if (n) n.hidden = o.out;
          });
          menu.querySelector(".dd-none").hidden = items.some((o) => !o.out && !o.hidden);
          highlight(step(-1, 1));
        });
        menu.appendChild(find);
      }
      items.forEach((o, i) => {
        if (o.hidden) return;
        const d = document.createElement("div");
        const placeholder = o.value === "" && i === 0;
        d.className = "dd-opt" + (o.disabled ? " dd-off" : "") + (placeholder ? " dd-ph" : "") + (i === el.selectedIndex && !placeholder ? " dd-sel" : "");
        d.setAttribute("role", "option");
        d.setAttribute("aria-selected", String(i === el.selectedIndex));
        d.textContent = o.label;
        d.dataset.i = String(i);
        d.addEventListener("pointerenter", () => !o.disabled && highlight(i, false));
        d.addEventListener("click", (e) => { e.stopPropagation(); pick(i); });
        menu.appendChild(d);
      });
      if (find) {
        const none = document.createElement("div");
        none.className = "dd-none";
        none.textContent = "Олдсонгүй";
        none.hidden = true;
        menu.appendChild(none);
      }
      // Нуусан мөрүүдийг гараар гүйлгэхэд алгасна
      items = items.map((o) => (o.hidden ? { ...o, disabled: true } : o));
      document.body.appendChild(menu);
      // Утсан дээр гар шууд гарч ирэхгүйн тулд хайх талбарт зөвхөн компьютер дээр шилжинэ
      if (find && !touch) find.focus({ preventScroll: true });
      place();
      active = -1;
      const cur = el.selectedIndex >= 0 && !items[el.selectedIndex]?.disabled ? el.selectedIndex : step(-1, 1);
      // Сонгосон мөрийг жагсаалтын голд харуулна
      const n = menu.querySelector(`[data-i="${cur}"]`);
      if (n && cur > 0) menu.scrollTop = n.offsetTop - menu.clientHeight / 2 + n.offsetHeight / 2;
      highlight(cur, false);
    };

    const toggle = (t) => {
      if (menu && sel === t) return close();
      t.focus({ preventScroll: true });
      open(t);
    };
    const onPress = (e) => {
      const t = e.target;
      if (menu && !menu.contains(t) && t !== sel) close(false);
      if (!usable(t)) return;
      // Утсан дээр хуудсыг гүйлгэх үед нээгдэхгүйн тулд хуруугаа өргөхөд нээнэ
      if (e.pointerType === "touch") { touch = { t, x: e.clientX, y: e.clientY }; return; }
      if (e.button !== 0) return;
      e.preventDefault();
      toggle(t);
    };
    // Хөтчийн өөрийн жагсаалт нээгдэхээс сэргийлж, оронд нь сайтынхыг нээнэ
    const onTouchEnd = (e) => {
      const t = e.target;
      if (!usable(t)) return;
      e.preventDefault();
      const p = e.changedTouches[0];
      if (touch && touch.t === t && Math.hypot(p.clientX - touch.x, p.clientY - touch.y) < 10) toggle(t);
      touch = null;
    };
    const onClick = (e) => { if (usable(e.target)) e.preventDefault(); };

    const onKey = (e) => {
      if (menu) {
        const k = e.key;
        const inFind = e.target.classList?.contains("dd-find");
        if (inFind && (k === " " || k === "Home" || k === "End" || k.length === 1)) return;
        if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); highlight(step(active, k === "ArrowDown" ? 1 : -1)); return; }
        if (k === "Home" || k === "End") { e.preventDefault(); highlight(k === "Home" ? step(-1, 1) : step(items.length, -1)); return; }
        if (k === "Enter" || k === " ") { e.preventDefault(); pick(active); return; }
        if (k === "Escape" || k === "Tab") { if (k === "Escape") e.preventDefault(); close(k === "Escape"); return; }
        if (k.length === 1) {
          // Эхний үсгээр нь хайна (жишээ нь «2» гэж бичихэд 2010 руу очно)
          const now = Date.now();
          typed = now - typedAt < 700 ? typed + k.toLowerCase() : k.toLowerCase();
          typedAt = now;
          const i = items.findIndex((o) => !o.disabled && o.label.trim().toLowerCase().startsWith(typed));
          if (i >= 0) highlight(i);
        }
        return;
      }
      const t = e.target;
      if (!usable(t)) return;
      if (e.key === "Enter" || e.key === " " || e.key === "F4" || (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp"))) {
        e.preventDefault();
        open(t);
      }
    };

    // Хуудас гүйлгэхэд жагсаалт хайрцгаа дагана, хайрцаг харагдахаа больвол хаагдана
    const onScroll = (e) => {
      if (!menu || menu.contains(e.target)) return;
      const r = sel.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) close(false);
      else place();
    };
    const onResize = () => close(false);

    document.addEventListener("pointerdown", onPress, true);
    document.addEventListener("mousedown", onClick, true);
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      close(false);
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("mousedown", onClick, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return null;
}
