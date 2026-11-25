"use client";

import { useState } from "react";

// Бүтээгдэхүүний зураг: том зураг + жижиг зургууд
export default function Gallery({ ids = [], title }) {
  const [i, setI] = useState(0);
  if (!ids.length) return <div className="mk-gal empty" />;
  return (
    <div className="mk-gal">
      <img className="mk-gal-main" src={`/img/${ids[i] || ids[0]}`} alt={title} />
      {ids.length > 1 && (
        <div className="mk-gal-th">
          {ids.map((id, k) => (
            <button key={id} type="button" className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={`Зураг ${k + 1}`}><img src={`/img/${id}`} alt="" /></button>
          ))}
        </div>
      )}
    </div>
  );
}
