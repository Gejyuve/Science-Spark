import Link from "next/link";
import { resetPassword } from "../auth/actions";
import { checkResetToken } from "@/lib/auth";
import AuthCard from "../components/AuthCard";
import PwField from "../components/PwField";

export const metadata = { title: "Шинэ нууц үг · Science Spark" };

export default async function ResetPage({ searchParams }) {
  const { t, error } = await searchParams;
  const user = await checkResetToken(t);
  if (!user) {
    return (
      <AuthCard action="/forgot" button="Шинэ холбоос авах" footer={<p className="au-foot"><Link href="/login">Нэвтрэх цонх руу буцах</Link></p>}>
        <p className="au-closed">Энэ холбоос хүчингүй эсвэл хугацаа нь дууссан байна.</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard action={resetPassword} error={error} button="Нууц үг шинэчлэх">
      <input type="hidden" name="t" value={t} />
      <p className="au-step"><b>{user.email}</b> хаягийн шинэ нууц үгээ бичнэ үү.</p>
      <PwField name="password" required minLength={8} autoComplete="new-password" placeholder="Шинэ нууц үг (8+ тэмдэгт)" aria-label="Шинэ нууц үг" />
      <PwField name="confirm" required minLength={8} autoComplete="new-password" placeholder="Шинэ нууц үгээ дахин бичнэ үү" aria-label="Шинэ нууц үгээ дахин бичнэ үү" />
    </AuthCard>
  );
}
