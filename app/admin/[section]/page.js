import { notFound } from "next/navigation";
import { SECTIONS, requireSection } from "@/lib/admin";
import Head from "../_c/Head";

const TEXT = {
  settings: "Түвшний босго, очны дүрэм, хязгаарлалтын тохиргоо.",
};

export default async function Soon({ params }) {
  const { section } = await params;
  const s = SECTIONS.find((x) => x.key === section && x.soon);
  if (!s) notFound();
  const user = await requireSection(s.key);
  return (
    <>
      <Head user={user} title={s.label} />
      <section className="adm-card adm-soon">
        <i className="adm-ic big" style={{ WebkitMaskImage: `url(/icons/${s.icon}.svg)`, maskImage: `url(/icons/${s.icon}.svg)` }} />
        <b>Тун удахгүй</b>
        <p>{TEXT[s.key]}</p>
      </section>
    </>
  );
}
