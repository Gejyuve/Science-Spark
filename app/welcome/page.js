import { redirect } from "next/navigation";
import { getUser, needsName } from "@/lib/auth";
import { saveName } from "../auth/actions";
import AuthCard, { Field } from "../components/AuthCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Тавтай морил · Science Spark" };

// Бүртгүүлсний дараах алхам: сайтад харагдах нэр
export default async function WelcomePage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!needsName(user)) redirect("/");
  const { error } = await searchParams;
  return (
    <AuthCard action={saveName} error={error} button="Үргэлжлүүлэх" close={false}>
      <p className="au-step">Сайтад таны нэр <b>А.Доржпалам</b> гэх мэтээр харагдана.</p>
      <div className="au-row">
        <Field icon={null} name="initial" maxLength={1} required placeholder="Овог (Х)" aria-label="Овгийн эхний үсэг" />
        <Field icon={null} name="first_name" required placeholder="Нэр" aria-label="Нэр" />
      </div>
    </AuthCard>
  );
}
