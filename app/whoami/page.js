import Link from "next/link";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Оношилгооны хуудас: админ эрх яагаад олгогдохгүй байгааг харуулна.
export default async function WhoAmI() {
  const user = await getUser();
  const list = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Оношилгоо</h1>
        <p>Нэвтэрсэн имэйл: <b>{user ? user.email : "нэвтрээгүй"}</b></p>
        <p>Эрх: <b>{user ? user.role : "-"}</b></p>
        <p>ADMIN_EMAILS тохируулсан имэйлийн тоо: <b>{list.length}</b></p>
        {list.length > 0 && (
          <p>Жагсаалт: {list.map((e) => e.replace(/^(.{2}).*(@.*)$/, "$1***$2")).join(", ")}</p>
        )}
        <p>Таарсан эсэх: <b>{user && list.map((e) => e.toLowerCase()).includes(user.email) ? "тийм" : "үгүй"}</b></p>
        <p className="muted"><Link href="/">← Нүүр</Link></p>
      </div>
    </div>
  );
}
