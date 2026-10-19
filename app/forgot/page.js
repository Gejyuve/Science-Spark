import Link from "next/link";
import { forgotPassword } from "../auth/actions";
import AuthCard, { Field } from "../components/AuthCard";

export const metadata = { title: "Нууц үг сэргээх · Science Spark" };

export default async function ForgotPage({ searchParams }) {
  const { error, sent } = await searchParams;
  const back = <p className="au-foot"><Link href="/login">Нэвтрэх цонх руу буцах</Link></p>;
  if (sent) {
    return (
      <AuthCard action="/login" button="Нэвтрэх цонх руу" footer={<p className="au-foot"><Link href="/forgot">Дахин илгээх</Link></p>}>
        <p className="au-step">
          Хэрэв <b>{sent}</b> хаяг бүртгэлтэй бол нууц үг сэргээх холбоосыг илгээлээ.<br />
          И-мейлээ шалгаарай (Spam хавтсыг ч бас). Холбоос 1 цагийн турш хүчинтэй.
        </p>
      </AuthCard>
    );
  }
  return (
    <AuthCard action={forgotPassword} error={error} button="Сэргээх холбоос илгээх" footer={back}>
      <p className="au-step">Бүртгэлтэй и-мейл хаягаа бичнэ үү. Нууц үгээ шинэчлэх холбоосыг тань руу илгээнэ.</p>
      <Field name="email" type="email" required autoComplete="email" placeholder="Мэйл" aria-label="Мэйл" />
    </AuthCard>
  );
}
