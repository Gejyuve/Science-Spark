import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

// DATABASE_URL-г Vercel-ийн тохиргооноос авна.
// Neon хаяг (neon.tech) бол Neon-ы HTTP драйвер, бусад Postgres (Supabase г.м.) бол postgres.js.
// Хоёулаа ижил sql`...` бичиглэлтэй, мөрүүдийг объектын массиваар буцаана.
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const viaNeon = !url || /\.neon\.tech\b/.test(url);
export const sql = viaNeon
  ? neon(url)
  : postgres(url, {
      // Supabase-ийн transaction pooler (6543 порт) бэлтгэсэн асуулга дэмждэггүй
      prepare: false,
      // Vercel-ийн функц бүр цөөн холболт барина; сул холболтыг хурдан хаана
      max: Number(process.env.DATABASE_POOL_MAX) || 3,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
    });

// Бүтцийн хувилбар. Доорх STEPS-д шинэ хүснэгт, багана, индекс нэмэх бүрт 1-ээр нэмэгдүүлнэ.
// Өгөгдлийн санд хадгалсан хувилбар таарвал сервер асахад ганцхан асуулга явна.
const SCHEMA_VERSION = 3;

// Бүх алхам IF NOT EXISTS тул дахин ажиллуулахад аюулгүй.
const STEPS = (sql) => [
  sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    initial TEXT NOT NULL,
    first_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`,
  // Очны данс: үлдэгдлийг хадгалахгүй, бүх өөрчлөлтийг бичиж нийлбэрийг тооцно.
  sql`CREATE TABLE IF NOT EXISTS points_ledger (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'Нийтлэл',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS sparks (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
  )`,
  sql`CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id)
  )`,
  sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'`,
  sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
  sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`,
  sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS review_note TEXT`,
  sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS subtitle TEXT`,
  // Эвент, зарлалын нэмэлт мэдээлэл (огноо, байршил, үнэ, холбоос г.м.)
  sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb`,
  // Админ боард: админы харах хэсгүүд, хэрэглэгч хязгаарлах, аудит лог
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS perms TEXT[] NOT NULL DEFAULT '{}'`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS restrict_note TEXT`,
  sql`CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT, target_id INTEGER, target_label TEXT,
    ok BOOLEAN NOT NULL DEFAULT true,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS audit_log_time_idx ON audit_log (created_at DESC)`,
  // Зураг: хөтөч дээр шахаж (WebP) илгээнэ, өгөгдлийн санд хадгална, /img/{id} хаягаар харуулна
  sql`CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    mime TEXT NOT NULL,
    data BYTEA NOT NULL,
    width INTEGER, height INTEGER, bytes INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS images_owner_idx ON images (owner_id, created_at DESC)`,
  // Дэлгэрэнгүй профайл (Figma: Шинэ хэрэглэгч)
  sql`CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_public BOOLEAN NOT NULL DEFAULT false,
    gender TEXT, birth_date DATE, about TEXT,
    birth_country TEXT, birth_city TEXT, live_country TEXT, live_city TEXT,
    education TEXT, school TEXT, orcid TEXT, profession TEXT, job TEXT,
    socials JSONB NOT NULL DEFAULT '{}'::jsonb,
    origin_view TEXT, religion TEXT, belief TEXT, politics TEXT,
    agreed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id INTEGER`,
  sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_id INTEGER`,
  sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_id INTEGER`,
  // Чирж тохируулахын тулд эх зураг ба байрлал
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_src INTEGER`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_pos TEXT`,
  sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_src INTEGER`,
  sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_pos TEXT`,
  // Үзсэн хүний тоо: нэг хүн (эсвэл нэг төхөөрөмж) нэг л удаа тоологдоно
  sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0`,
  sql`CREATE TABLE IF NOT EXISTS post_views (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    viewer TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, viewer)
  )`,
  // Хадгалсан контент (зөвхөн өөрт харагдана)
  sql`CREATE TABLE IF NOT EXISTS saves (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
  )`,
  // Логик алдааны мэдэгдэл
  sql`CREATE TABLE IF NOT EXISTS logic_reports (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    note TEXT,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS logic_reports_one_open ON logic_reports (post_id, user_id) WHERE status = 'open'`,
  // Сэтгэгдэлд хариулах (мод бүтэц)
  sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE`,
  // Хариулт (сэтгэгдэл)-д лайк дарах: нэг хүн нэг удаа
  sql`CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, user_id)
  )`,
  // Хянагчийн шалгалт: оролдлого бүр, тэнцсэн бол редакцад хүсэлт очно
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS exam_reset_at TIMESTAMPTZ`,
  sql`CREATE TABLE IF NOT EXISTS exam_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sample INTEGER NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    score INTEGER NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS exam_attempts_user_idx ON exam_attempts (user_id, created_at DESC)`,
  // Толь: хэлэлцүүлгийн санал (1 = дэмжих, -1 = эсрэг)
  sql`CREATE TABLE IF NOT EXISTS term_votes (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
  )`,
  sql`CREATE INDEX IF NOT EXISTS posts_kind_status_idx ON posts (kind, status)`,
  // Мод: нийтлэл, мэдээний ангилал (lib/tree.js дахь зам, ж: "nat/phys/nuc")
  sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT`,
  sql`CREATE INDEX IF NOT EXISTS posts_category_idx ON posts (category)`,
  // Мод: редакц баталсан нэмэлт ангилал, хэрэглэгчийн санал, ангиллын алдааны мэдэгдэл
  sql`CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY, path TEXT UNIQUE NOT NULL, parent TEXT NOT NULL, name TEXT NOT NULL, en TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS category_requests (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent TEXT NOT NULL, name TEXT NOT NULL, en TEXT NOT NULL, note TEXT NOT NULL, examples TEXT, source TEXT,
    status TEXT NOT NULL DEFAULT 'pending', review_note TEXT, reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ
  )`,
  sql`CREATE TABLE IF NOT EXISTS category_reports (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    path TEXT, issue TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS reviewer_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_id INTEGER REFERENCES exam_attempts(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    note TEXT,
    decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS reviewer_requests_one_pending ON reviewer_requests (user_id) WHERE status = 'pending'`,
  // Хянагч засвар хийвэл бичээчийн анхны хувилбар хадгалагдана
  sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS original JSONB`,
  // Хэрэглэгчийн төрөл: person (хувь хүн), org (байгууллага), club (клуб)
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'person'`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS surname TEXT`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS ledger_profile_once ON points_ledger (user_id, reason) WHERE reason LIKE 'profile:%'`,
  // Клуб: хувь хүн (удирдагч) бүртгүүлнэ. Хэрэглэгч нэг л клубт гишүүн байна.
  // (Эхний хувилбарын хоосон хүснэгтүүдийг шинэ бүтцээр солино)
  sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clubs' AND column_name = 'user_id') THEN
      DROP TABLE IF EXISTS club_members; DROP TABLE IF EXISTS clubs;
    END IF;
  END $$`,
  sql`CREATE TABLE IF NOT EXISTS clubs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    logo_id INTEGER, cover_id INTEGER, cover_src INTEGER, cover_pos TEXT,
    category TEXT, founded DATE, country TEXT, city TEXT, address TEXT,
    lat DOUBLE PRECISION, lng DOUBLE PRECISION,
    about TEXT, rules TEXT, website TEXT, email TEXT, phone TEXT,
    socials JSONB NOT NULL DEFAULT '{}'::jsonb,
    leader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS clubs_name_uq ON clubs (lower(name))`,
  // Байгууллага ч мөн энэ хүснэгтэд (kind = 'org'): гишүүнчлэлгүй, зөвхөн дагагчтай
  sql`ALTER TABLE clubs ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'club'`,
  sql`ALTER TABLE clubs ADD COLUMN IF NOT EXISTS field TEXT`,
  sql`ALTER TABLE clubs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
  sql`CREATE TABLE IF NOT EXISTS club_members (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS club_members_club_idx ON club_members (club_id)`,
  sql`CREATE TABLE IF NOT EXISTS club_invites (
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'board',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (club_id, user_id)
  )`,
  // Клубт нэгдэх хүсэлт (удирдагч шийднэ). Нэг хүн нэг л хүлээгдэж буй хүсэлттэй.
  sql`CREATE TABLE IF NOT EXISTS club_requests (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // Клубээс гарсан, шилжсэн түүх (1 сарын хоригт ашиглана)
  sql`CREATE TABLE IF NOT EXISTS club_moves (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_club INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
    from_name TEXT,
    to_club INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS club_follows (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, club_id)
  )`,
  // Клубын групп чат: зөвхөн гишүүд бичиж, уншина. Хүн бүр хаана хүртэл уншсанаа хадгална.
  sql`CREATE TABLE IF NOT EXISTS club_messages (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS club_messages_club_idx ON club_messages (club_id, id DESC)`,
  sql`CREATE TABLE IF NOT EXISTS club_chat_reads (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    last_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, club_id)
  )`,
  // Мэдэгдэл: батлагдсан, татгалзсан, хасагдсан, сэтгэгдэл, шинэ дагагч
  sql`CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    note TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC)`,
  sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE`,
  // Нэвтрэх оролдлого (нууц үг таах халдлагаас хамгаална)
  sql`CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts (email, created_at)`,
  // v2: хуудас бүр мөр болгонд оч, дагагч, сэтгэгдлийг тоолдог тул эдгээр баганаар хайх индекс
  sql`CREATE INDEX IF NOT EXISTS points_ledger_user_idx ON points_ledger (user_id)`,
  sql`CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id)`,
  sql`CREATE INDEX IF NOT EXISTS comments_post_idx ON comments (post_id, created_at)`,
  sql`CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments (parent_id)`,
  sql`CREATE INDEX IF NOT EXISTS posts_author_idx ON posts (author_id, created_at DESC)`,
  sql`CREATE INDEX IF NOT EXISTS posts_status_time_idx ON posts (status, created_at DESC)`,
  sql`CREATE INDEX IF NOT EXISTS posts_reviewer_idx ON posts (reviewer_id)`,
  sql`CREATE INDEX IF NOT EXISTS club_follows_club_idx ON club_follows (club_id)`,
  sql`CREATE INDEX IF NOT EXISTS sparks_time_idx ON sparks (created_at, post_id)`,
];

let ready = null;

async function storedVersion() {
  try {
    const [r] = await sql`SELECT version FROM schema_meta WHERE id = 1`;
    return r ? r.version : 0;
  } catch (e) {
    if (e.code === "42P01") return 0; // schema_meta хүснэгт хараахан байхгүй (шинэ сан)
    throw e;
  }
}

// Хүснэгтүүд байхгүй эсвэл хуучин бол эхний хандалт дээр нэг гүйлгээгээр (нэг хүсэлтээр) шинэчилнэ.
export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      if ((await storedVersion()) >= SCHEMA_VERSION) return;
      const run = (q) => [
        // Хэд хэдэн сервер зэрэг асвал ээлжилж ажиллана
        q`SELECT pg_advisory_xact_lock(7203114)`,
        ...STEPS(q),
        q`CREATE TABLE IF NOT EXISTS schema_meta (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
        // v3: Supabase public схемийг Data API-аар нээлттэй гаргадаг тул бүх хүснэгтэд RLS асаана.
        // Хүснэгтийн эзэн (энэ апп) RLS-д хамаарахгүй тул сайтын ажиллагаа өөрчлөгдөхгүй.
        q`DO $$ DECLARE t text; BEGIN
          FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user LOOP
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
          END LOOP;
        END $$`,
        q`INSERT INTO schema_meta (id, version) VALUES (1, ${SCHEMA_VERSION})
            ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, updated_at = now()`,
      ];
      if (viaNeon) await sql.transaction(run(sql));
      else await sql.begin(async (tx) => { for (const q of run(tx)) await q; });
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
