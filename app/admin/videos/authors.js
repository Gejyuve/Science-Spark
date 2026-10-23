import { listBots } from "@/lib/bots";
import { displayName } from "@/lib/auth";

// Видеог нийтлэх профайлын сонголт: супер админ өөрөө + нэртэй ботууд
export async function videoAuthors(me) {
  const bots = await listBots().catch(() => []);
  return [{ id: me.id, name: `${displayName(me)} (та)` }, ...bots.filter((b) => b.first_name).map((b) => ({ id: b.id, name: `${displayName(b)} · бот` }))];
}
