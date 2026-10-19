import { redirect } from "next/navigation";

// «Миний шийдвэрүүд» аудит логт нэгтгэгдсэн
export default function Archive() {
  redirect("/admin/audit?cat=content");
}
