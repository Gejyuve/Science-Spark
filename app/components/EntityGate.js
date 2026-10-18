import Link from "next/link";

// Figma 353:209 «Хувь хүний бүртгэл шаардлагатай» гэх мэт мэдэгдлийн карт
export default function EntityGate({ icon = "tclub", title, text, actions }) {
  return (
    <section className="pf-card cf-gate">
      <img src={`/icons/${icon}.svg`} width={56} height={56} alt="" />
      <b>{title}</b>
      <p>{text}</p>
      <div>{actions || <><Link href="/login" className="cf-btn">Нэвтрэх</Link><Link href="/register" className="cf-btn ghost">Бүртгүүлэх</Link></>}</div>
    </section>
  );
}

export async function leaderInfo(sql, user) {
  const job = (await sql`SELECT job FROM profiles WHERE user_id = ${user.id}`)[0]?.job || "";
  const { displayName } = await import("@/lib/auth");
  return { id: user.id, name: displayName(user), full: [user.surname, user.first_name].filter(Boolean).join(" "), avatar: user.avatar || null, job, email: user.email };
}
