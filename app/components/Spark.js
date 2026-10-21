"use client";

import { useId } from "react";

// Логоны оч (од) хүлээлгийн хөдөлгөөн: том од амьсгалж гэрэлтэн, жижиг оч анивчина.
// mono — товчны дотор: өнгөө бичгийн өнгөнөөс (currentColor) авна.
export default function Spark({ size = 48, mono = false, label, className = "" }) {
  const id = useId().replace(/:/g, "");
  const fill = mono ? "currentColor" : `url(#spk${id})`;
  return (
    <span className={"spk" + (mono ? " mono" : "") + (className ? " " + className : "")} style={{ "--spk": size + "px" }}
      role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 74 74" width={size} height={size} aria-hidden="true">
        {!mono && (
          <defs>
            <linearGradient id={`spk${id}`} x1="17.8" y1="17.8" x2="55.3" y2="55.3" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7EE8DD" />
              <stop offset=".55" stopColor="#00A89B" />
              <stop offset="1" stopColor="#00857A" />
            </linearGradient>
          </defs>
        )}
        <g className="spk-big">
          <path fill={fill} d="M36.565 10C36.565 21.954 51.176 36.565 63.13 36.565C51.176 36.565 36.565 51.176 36.565 63.13C36.565 51.176 21.954 36.565 10 36.565C21.954 36.565 36.565 21.954 36.565 10Z" />
          {!mono && <path className="spk-core" fill="#fff" d="M36.565 25.698C36.565 30.588 42.542 36.565 47.433 36.565C42.542 36.565 36.565 42.542 36.565 47.433C36.565 42.542 30.588 36.565 25.698 36.565C30.588 36.565 36.565 30.588 36.565 25.698Z" />}
        </g>
        <path className="spk-tw a" fill={mono ? "currentColor" : "#62B5AC"} d="M56.225 11.06C56.225 14.211 58.779 16.765 61.93 16.765C58.779 16.765 56.225 19.319 56.225 22.47C56.225 19.319 53.67 16.765 50.519 16.765C53.67 16.765 56.225 14.211 56.225 11.06Z" />
        <path className="spk-tw b" fill={mono ? "currentColor" : "#7EE8DD"} d="M15.5 52C15.5 54.3 17.2 56 19.5 56C17.2 56 15.5 57.7 15.5 60C15.5 57.7 13.8 56 11.5 56C13.8 56 15.5 54.3 15.5 52Z" />
      </svg>
    </span>
  );
}

// Хуудас, хэсэг ачаалж байхад голд нь томоор харуулна
export function SparkLoader({ text = "Ачаалж байна", size = 64, full = false }) {
  return (
    <div className={"spk-load" + (full ? " full" : "")}>
      <Spark size={size} label={text} />
      <span className="spk-text">{text}<i>.</i><i>.</i><i>.</i></span>
    </div>
  );
}
