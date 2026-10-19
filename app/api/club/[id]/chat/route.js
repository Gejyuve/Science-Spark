import { getUser } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { membershipOf } from "@/lib/clubs";
import { chatMessages, chatDeleted, postMessage, deleteMessage, markChatRead } from "@/lib/chat";

export const dynamic = "force-dynamic";

const no = (error, status) => Response.json({ error }, { status });

// Чатыг зөвхөн тухайн клубийн гишүүд уншиж, бичнэ
async function gate(params) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) return { err: no("Клуб олдсонгүй.", 404) };
  const user = await getUser();
  if (!user) return { err: no("Нэвтэрнэ үү.", 401) };
  await ensureSchema();
  const mine = await membershipOf(user.id);
  if (mine?.club_id !== id) return { err: no("Чат зөвхөн клубийн гишүүдэд нээлттэй.", 403) };
  return { id, user, mine };
}

export async function GET(req, { params }) {
  const g = await gate(params);
  if (g.err) return g.err;
  const sp = new URL(req.url).searchParams;
  const after = Number(sp.get("after")) || 0;
  const res = await chatMessages(g.id, { after, before: Number(sp.get("before")) || 0 });
  const last = res.messages.at(-1)?.id;
  if (last && !sp.get("before")) await markChatRead(g.user.id, g.id, last);
  return Response.json({ ...res, deleted: after ? await chatDeleted(g.id) : [] });
}

export async function POST(req, { params }) {
  const g = await gate(params);
  if (g.err) return g.err;
  if (g.user.restricted_at) return no("Таны эрх хязгаарлагдсан байна.", 403);
  const data = await req.json().catch(() => ({}));
  const r = await postMessage(g.id, g.user.id, data.body);
  if (r.error) return no(r.error, 400);
  return Response.json(r);
}

export async function DELETE(req, { params }) {
  const g = await gate(params);
  if (g.err) return g.err;
  const mid = Number(new URL(req.url).searchParams.get("m"));
  const [c] = await sql`SELECT leader_id FROM clubs WHERE id = ${g.id}`;
  const ok = Number.isInteger(mid) && (await deleteMessage(g.id, g.user, mid, c?.leader_id === g.user.id));
  return ok ? Response.json({ ok: true }) : no("Устгах боломжгүй.", 403);
}
