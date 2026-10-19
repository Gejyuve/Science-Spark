import { redirect } from "next/navigation";
import { getUser, isStaff } from "@/lib/auth";
import Head, { Flash } from "../admin/_c/Head";
import { Words } from "../admin/_c/Queues";
import { canApproveWords } from "@/lib/terms";

// Хяналтын жагсаалт Контент хэсэгт нэгтгэгдсэн. Хуучин холбоосыг (/review?t=…) тийш нь дамжуулна.
export default async function ReviewHome({ searchParams }) {
  const user = await getUser();
  const sp = await searchParams;
  if (isStaff(user)) {
    const q = new URLSearchParams();
    if (sp.t === "words" || sp.t === "cats") q.set("v", sp.t);
    else q.set("status", "pending");
    if (sp.ok) q.set("ok", sp.ok);
    if (sp.error) q.set("error", sp.error);
    redirect("/admin/content?" + q);
  }
  if (!canApproveWords(user)) redirect("/");
  // Түвшин 5+ хэрэглэгч зөвхөн шинэ үгийг зөвшөөрнө
  return (
    <>
      <Head user={user} title="Шинэ үг зөвшөөрөх" sub="Хэлэлцүүлэгт байгаа нэр томьёо" />
      <Flash ok={sp.ok} error={sp.error} />
      <Words user={user} can />
    </>
  );
}
