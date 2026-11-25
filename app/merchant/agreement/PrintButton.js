"use client";

export default function PrintButton({ className = "mc-btn ghost" }) {
  return <button type="button" className={className} onClick={() => window.print()}>Хэвлэх / PDF</button>;
}
