import { redirect } from "next/navigation";

// Хуучин «Профайл» хуудас: нууц үг солих нь одоо профайл засах хуудсанд байна
export default function ProfilePage() {
  redirect("/profile/edit");
}
