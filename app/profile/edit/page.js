import Link from "next/link";
import TopNav from "../../components/TopNav";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getUser, needsName } from "@/lib/auth";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Профайл · Science Spark" };

// Figma: Шинэ хэрэглэгч (бүртгүүлсний дараа шууд нээгдэнэ) / профайл засах
export default async function EditProfilePage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;
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
      {!isNew && (
        <div className="ar-pagebar wr-bar">
          <Link href={`/u/${user.id}`} className="ar-back">← Буцах</Link>
        </div>
      )}
      <ProfileForm
        user={{ id: user.id, email: user.email, surname: user.surname || "", first_name: user.first_name || "" }}
        profile={profile}
        error={error}
        isNew={isNew}
      />
    </div>
  );
}
