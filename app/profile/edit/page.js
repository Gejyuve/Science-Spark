import Link from "next/link";
import TopNav from "../../components/TopNav";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import ProfileForm from "./ProfileForm";
import PwField from "../../components/PwField";
import ScrollInto from "../../components/ScrollInto";
import { changePassword } from "../../auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Профайл · Science Spark" };

// Figma: Шинэ хэрэглэгч (бүртгүүлсний дараа шууд нээгдэнэ) / профайл засах
export default async function EditProfilePage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { error, pw_ok, pw_error } = await searchParams;
  await ensureSchema();
  const profile = (await sql`SELECT * FROM profiles WHERE user_id = ${user.id}`)[0] || null;
  if (profile?.birth_date) profile.birth_date = new Date(profile.birth_date).toISOString();
  if (profile?.agreed_at) profile.agreed_at = new Date(profile.agreed_at).toISOString();
  if (profile?.updated_at) profile.updated_at = new Date(profile.updated_at).toISOString();
  const isNew = needsName(user) || !profile;
  return (
    <div className="wr-page">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      {!isNew && <TopNav className="wr-nav" />}
      {user.operator && <p className="ss-announce ss-botbar pf-botbar">Та бот хаягийн профайлыг бөглөж байна. Энэ мөрийг зөвхөн та харж байна.</p>}
      <ProfileForm
        user={{ id: user.id, email: user.email, surname: user.surname || "", first_name: user.first_name || "", avatar: user.avatar, avatar_src: user.avatar_src, avatar_pos: user.avatar_pos }}
        profile={profile}
        error={error}
        isNew={isNew}
      />
      {/* Нууц үг солих: профайлын маягтаас тусдаа (ноорогт хадгалагдахгүй) */}
      {/* Бот хаяг имэйл, нууц үггүй */}
      {!isNew && user.email && (
        <form action={changePassword} className="pf-col pf-pwcol" id="password">
          <section className="pf-card">
            <h2>Нууц үг солих</h2>
            <p className="pf-sub">Солиход бусад төхөөрөмж дээрх нэвтрэлт гарна. Мартсан бол <Link href="/forgot">энд дарж</Link> и-мэйлээр сэргээнэ.</p>
            {(pw_ok || pw_error) && <ScrollInto id="password" dep={pw_ok || pw_error} />}
            {pw_error && <p className="error">{pw_error}</p>}
            {pw_ok && <p className="notice">{pw_ok}</p>}
            <div className="pf-grid2">
              <div><div className="pf-label"><span>Одоогийн нууц үг</span></div>
                <PwField wrap="pf-input" name="current" required autoComplete="current-password" placeholder="Одоогийн нууц үг" aria-label="Одоогийн нууц үг" /></div>
              <div><div className="pf-label"><span>Шинэ нууц үг</span></div>
                <PwField wrap="pf-input" name="next" required minLength={8} autoComplete="new-password" placeholder="Хамгийн багадаа 8 тэмдэгт" aria-label="Шинэ нууц үг" /></div>
            </div>
            <div className="pf-pwfoot"><button type="submit" className="pf-save ghost">Нууц үг солих</button></div>
          </section>
        </form>
      )}
    </div>
  );
}
