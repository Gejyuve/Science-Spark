import { redirect } from "next/navigation";

// Хуучин хаяг: шинэ профайл үүсгэх хуудас руу шилжүүлнэ
export default function Welcome() {
  redirect("/profile/edit");
}
