import Link from "next/link";
import { register } from "../auth/actions";
import AuthCard, { Field } from "../components/AuthCard";

export const metadata = { title: "Асаах · Science Spark" };

export default async function RegisterPage({ searchParams }) {
  const { error } = await searchParams;
  return (
    <AuthCard
      action={register}
      error={error}
      footer={<p className="au-foot">Бүртгэлтэй юу? <Link href="/login">Нэвтрэх</Link></p>}
    >
      <div className="au-types">
        <span className="au-type on"><img src="/icons/tperson.svg" width={34} height={34} alt="" />Хувь хүн</span>
        <span className="au-type soon" title="Тун удахгүй"><img src="/icons/torg.svg" width={34} height={34} alt="" />Байгууллага</span>
        <span className="au-type soon" title="Тун удахгүй"><img src="/icons/tclub.svg" width={34} height={34} alt="" />Клуб</span>
      </div>
      <Field name="email" type="email" required autoComplete="email" placeholder="Мэйл" aria-label="Мэйл" />
      <Field icon={null} name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Нууц үг (8+ тэмдэгт)" aria-label="Нууц үг" />
    </AuthCard>
  );
}
