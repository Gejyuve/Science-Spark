import Link from "next/link";
import { register } from "../auth/actions";

export const metadata = { title: "Бүртгүүлэх · Science Spark" };

export default async function RegisterPage({ searchParams }) {
  const { error } = await searchParams;
  return (
    <div className="auth-wrap">
      <form className="auth-card" action={register}>
        <h1>Бүртгүүлэх</h1>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <label className="narrow">Овгийн эхний үсэг<input name="initial" maxLength={1} required placeholder="Х" /></label>
          <label>Нэр<input name="first_name" required placeholder="Нэр" /></label>
        </div>
        <label>Имэйл<input name="email" type="email" required autoComplete="email" /></label>
        <label>Нууц үг (8+ тэмдэгт)<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
        <button className="btn" type="submit">Бүртгүүлэх</button>
        <p className="muted">Бүртгэлтэй юу? <Link href="/login">Нэвтрэх</Link></p>
        <p className="muted"><Link href="/">← Нүүр</Link></p>
      </form>
    </div>
  );
}
