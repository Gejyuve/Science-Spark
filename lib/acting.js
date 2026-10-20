import { cookies } from "next/headers";
import { leaderClub, leaderOrg } from "./tasks";

// Баруун цэсний товчоор сонгосон хаяг: өөрөө, удирддаг клуб эсвэл байгууллага.
// Күүкид "club" | "org" хадгалж, тухайн хүн одоо ч удирдагч эсэхийг шалгана.
export const AS_COOKIE = "ss-as";

export async function actingAs(user) {
  if (!user) return { club: null, org: null, as: null, entity: null };
  const [club, org, jar] = await Promise.all([
    leaderClub(user.id).catch(() => null),
    leaderOrg(user.id).catch(() => null),
    cookies(),
  ]);
  const want = jar.get(AS_COOKIE)?.value;
  const as = want === "club" && club ? "club" : want === "org" && org ? "org" : null;
  return { club, org, as, entity: as === "club" ? club : as === "org" ? org : null };
}
