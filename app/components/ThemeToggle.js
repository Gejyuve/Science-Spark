"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ss-theme", next);
    } catch (e) {}
  }

  const dark = theme === "dark";
  return (
    <button
      className={"theme-toggle" + (dark ? " is-dark" : "")}
      onClick={toggle}
      aria-label={dark ? "Light горим руу шилжих" : "Dark горим руу шилжих"}
      title={dark ? "Light горим" : "Dark горим"}
    >
      <span className="knob">{dark ? "☀" : "☾"}</span>
    </button>
  );
}
