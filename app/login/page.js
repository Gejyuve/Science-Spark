import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Нэвтрэх · Science Spark" };

// И-мэйлийн баталгаажуулах холбоос (app/verify/route.js) энд ?verify=... -тэй буцаана
const NOTICES = {
  done: { text: "И-мэйл тань баталгаажсан байна. Имэйл, нууц үгээрээ нэвтэрнэ үү." },
  bad: { text: "Баталгаажуулах холбоос хүчингүй эсвэл хугацаа нь дууссан байна. Имэйл, нууц үгээ бичээд дахин асаана уу.", bad: true },
  closed: { text: "Шинэ бүртгэл түр хаалттай байна.", bad: true },
};

export default async function LoginPage({ searchParams }) {
  if (await getUser()) redirect("/");
  const { verify } = await searchParams;
  return <LoginForm notice={NOTICES[verify] || null} />;
}
