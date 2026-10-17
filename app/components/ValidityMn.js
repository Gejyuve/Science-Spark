"use client";

import { useEffect } from "react";

// Хөтчийн бүх маягтын сануулгыг монгол болгоно (бүх хуудсанд үйлчилнэ).
// Тусгай сануулгатай талбарыг (жишээ нь латин үсгийн шалгалт) өөрчлөхгүй.
function message(el) {
  const v = el.validity;
  const type = (el.type || "").toLowerCase();
  const len = (el.value || "").length;
  if (v.valueMissing) {
    if (type === "checkbox") return "Үргэлжлүүлэхийн тулд энэ хайрцгийг тэмдэглэнэ үү";
    if (type === "radio") return "Нэг сонголтыг сонгоно уу";
    if (el.tagName === "SELECT") return "Жагсаалтаас сонгоно уу";
    if (type === "file") return "Файл сонгоно уу";
    if (type === "date" || type === "datetime-local") return "Огноогоо сонгоно уу";
    return "Энэ талбарыг бөглөнө үү";
  }
  if (v.badInput) {
    if (type === "number") return "Зөвхөн тоо оруулна уу";
    if (type.startsWith("date") || type === "time") return "Огноо, цагаа бүрэн оруулна уу";
    return "Буруу утга байна";
  }
  if (v.typeMismatch) {
    if (type === "email") return "Зөв и-мэйл хаяг оруулна уу (жишээ: ner@mail.mn)";
    if (type === "url") return "Холбоосоо https:// -ээр эхлүүлж бүтнээр нь оруулна уу";
    return "Буруу хэлбэртэй утга байна";
  }
  if (v.tooShort) return `Дор хаяж ${el.minLength} тэмдэгт бичнэ үү (одоо ${len})`;
  if (v.tooLong) return `${el.maxLength}-аас илүүгүй тэмдэгт бичнэ үү (одоо ${len})`;
  if (v.rangeUnderflow) return type.startsWith("date") ? `${el.min.replace("T", " ")}-ээс хойшхи огноо сонгоно уу` : `${el.min}-ээс багагүй утга оруулна уу`;
  if (v.rangeOverflow) return type.startsWith("date") ? `${el.max.replace("T", " ")}-ээс өмнөх огноо сонгоно уу` : `${el.max}-ээс ихгүй утга оруулна уу`;
  if (v.stepMismatch) return type === "number" ? "Бүхэл тоо оруулна уу" : "Зөв утга сонгоно уу";
  if (v.patternMismatch) return el.title || "Шаардлагатай хэлбэрээр бичнэ үү";
  return "Энэ талбарыг зөв бөглөнө үү";
}

export default function ValidityMn() {
  useEffect(() => {
    const onInvalid = (e) => {
      const el = e.target;
      if (!el || typeof el.setCustomValidity !== "function") return;
      if (el.validity.customError && el.dataset.mnv !== "1") return; // өөрийн тусгай сануулгатай
      el.setCustomValidity("");
      if (el.validity.valid) return;
      el.setCustomValidity(message(el));
      el.dataset.mnv = "1";
    };
    const reset = (e) => {
      const el = e.target;
      if (el?.dataset?.mnv === "1") {
        el.setCustomValidity("");
        delete el.dataset.mnv;
      }
      // Радио товчны бүлэг: нэгийг сонгоход бүгдийнх нь сануулгыг арилгана
      if (el?.type === "radio" && el.name && el.form) {
        el.form.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`).forEach((r) => {
          if (r.dataset.mnv === "1") { r.setCustomValidity(""); delete r.dataset.mnv; }
        });
      }
    };
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", reset, true);
    document.addEventListener("change", reset, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", reset, true);
      document.removeEventListener("change", reset, true);
    };
  }, []);
  return null;
}
