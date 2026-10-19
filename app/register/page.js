import { redirect } from "next/navigation";

// Бүртгэл «Асаая өө» цонхонд нэгдсэн: бүртгэлгүй имэйлээр нэвтрэх үед нууц үгээ давтаад шууд бүртгүүлнэ.
export default function RegisterPage() {
  redirect("/login");
}
