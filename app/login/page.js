import Link from "next/link";
import { login } from "../auth/actions";

export const metadata = { title: "Нэвтрэх · Science Spark" };

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;
  return (
    <div className="auth-wrap">
      <form className="auth-card" action={login}>
        <h1>Нэвтрэх</h1>
        {error && <p className="error">{error}</p>}
        <label>Имэйл<input name="email" type="email" required autoComplete="email" /></label>
        <label>Нууц үг<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className="btn" type="submit">Нэвтрэх</button>
        <p className="muted">Бүртгэлгүй юу? <Link href="/register">Бүртгүүлэх</Link></p>
        <p className="muted"><Link href="/">← Нүүр</Link></p>
      </form>
    </div>
  );
}
