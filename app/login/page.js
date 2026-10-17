import Link from "next/link";
import { login } from "../auth/actions";
import AuthCard, { Field } from "../components/AuthCard";

export const metadata = { title: "Нэвтрэх · Science Spark" };

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;
  return (
    <AuthCard
      action={login}
      error={error}
      footer={<p className="au-foot">Бүртгэлгүй юу? <Link href="/register">Асаах</Link></p>}
    >
      <Field name="email" type="email" required autoComplete="email" placeholder="Мэйл" aria-label="Мэйл" />
      <Field icon={null} name="password" type="password" required autoComplete="current-password" placeholder="Нууц үг" aria-label="Нууц үг" />
    </AuthCard>
  );
}
