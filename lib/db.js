import { neon } from "@neondatabase/serverless";

// DATABASE_URL-г Vercel (Neon холболт) автоматаар өгнө.
export const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

let ready = null;

// Хүснэгтүүд байхгүй бол эхний хандалт дээр автоматаар үүсгэнэ.
export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        initial TEXT NOT NULL,
        first_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      )`;
      // Очны данс: үлдэгдлийг хадгалахгүй, бүх өөрчлөлтийг бичиж нийлбэрийг тооцно.
      await sql`CREATE TABLE IF NOT EXISTS points_ledger (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'Нийтлэл',
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS sparks (
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (post_id, user_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS follows (
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (follower_id, followee_id)
      )`;
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'`;
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL`;
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`;
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS review_note TEXT`;
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS subtitle TEXT`;
      // Эвент, зарлалын нэмэлт мэдээлэл (огноо, байршил, үнэ, холбоос г.м.)
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb`;
      // Админ боард: админы харах хэсгүүд, хэрэглэгч хязгаарлах, аудит лог
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS perms TEXT[] NOT NULL DEFAULT '{}'`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS restrict_note TEXT`;
      await sql`CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT, target_id INTEGER, target_label TEXT,
        ok BOOLEAN NOT NULL DEFAULT true,
        ip TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS audit_log_time_idx ON audit_log (created_at DESC)`;
      // Зураг: хөтөч дээр шахаж (WebP) илгээнэ, өгөгдлийн санд хадгална, /img/{id} хаягаар харуулна
      await sql`CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        mime TEXT NOT NULL,
        data BYTEA NOT NULL,
        width INTEGER, height INTEGER, bytes INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS images_owner_idx ON images (owner_id, created_at DESC)`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id INTEGER`;
      await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_id INTEGER`;
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_id INTEGER`;
      // Чирж тохируулахын тулд эх зураг ба байрлал
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_src INTEGER`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_pos TEXT`;
      await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_src INTEGER`;
      await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_pos TEXT`;
      // Үзсэн хүний тоо: нэг хүн (эсвэл нэг төхөөрөмж) нэг л удаа тоологдоно
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0`;
      await sql`CREATE TABLE IF NOT EXISTS post_views (
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        viewer TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (post_id, viewer)
      )`;
      // Хадгалсан контент (зөвхөн өөрт харагдана)
      await sql`CREATE TABLE IF NOT EXISTS saves (
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (post_id, user_id)
      )`;
      // Логик алдааны мэдэгдэл
      await sql`CREATE TABLE IF NOT EXISTS logic_reports (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        note TEXT,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS logic_reports_one_open ON logic_reports (post_id, user_id) WHERE status = 'open'`;
      // Сэтгэгдэлд хариулах (мод бүтэц)
      await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE`;
      // Хариулт (сэтгэгдэл)-д лайк дарах: нэг хүн нэг удаа
      await sql`CREATE TABLE IF NOT EXISTS comment_likes (
        comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (comment_id, user_id)
      )`;
      // Хянагчийн шалгалт: оролдлого бүр, тэнцсэн бол редакцад хүсэлт очно
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS exam_reset_at TIMESTAMPTZ`;
      await sql`CREATE TABLE IF NOT EXISTS exam_attempts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sample INTEGER NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}'::jsonb,
        result JSONB NOT NULL DEFAULT '{}'::jsonb,
        score INTEGER NOT NULL DEFAULT 0,
        passed BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS exam_attempts_user_idx ON exam_attempts (user_id, created_at DESC)`;
      // Толь: хэлэлцүүлгийн санал (1 = дэмжих, -1 = эсрэг)
      await sql`CREATE TABLE IF NOT EXISTS term_votes (
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vote SMALLINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (post_id, user_id)
      )`;
      await sql`CREATE INDEX IF NOT EXISTS posts_kind_status_idx ON posts (kind, status)`;
      // Мод: нийтлэл, мэдээний ангилал (lib/tree.js дахь зам, ж: "nat/phys/nuc")
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT`;
      await sql`CREATE INDEX IF NOT EXISTS posts_category_idx ON posts (category)`;
      // Мод: редакц баталсан нэмэлт ангилал, хэрэглэгчийн санал, ангиллын алдааны мэдэгдэл
      await sql`CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY, path TEXT UNIQUE NOT NULL, parent TEXT NOT NULL, name TEXT NOT NULL, en TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS category_requests (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent TEXT NOT NULL, name TEXT NOT NULL, en TEXT NOT NULL, note TEXT NOT NULL, examples TEXT, source TEXT,
        status TEXT NOT NULL DEFAULT 'pending', review_note TEXT, reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ
      )`;
      await sql`CREATE TABLE IF NOT EXISTS category_reports (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        path TEXT, issue TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS reviewer_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        attempt_id INTEGER REFERENCES exam_attempts(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT,
        decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        decided_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS reviewer_requests_one_pending ON reviewer_requests (user_id) WHERE status = 'pending'`;
      // Хянагч засвар хийвэл бичээчийн анхны хувилбар хадгалагдана
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS original JSONB`;
      // Хэрэглэгчийн төрөл: person (хувь хүн), org (байгууллага), club (клуб)
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'person'`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS surname TEXT`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS ledger_profile_once ON points_ledger (user_id, reason) WHERE reason LIKE 'profile:%'`;
      // Клуб: хувь хүн (удирдагч) бүртгүүлнэ. Хэрэглэгч нэг л клубт гишүүн байна.
      // (Эхний хувилбарын хоосон хүснэгтүүдийг шинэ бүтцээр солино)
      const oldClubs = await sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'clubs' AND column_name = 'user_id'`;
      if (oldClubs.length) { await sql`DROP TABLE IF EXISTS club_members`; await sql`DROP TABLE IF EXISTS clubs`; }
      await sql`CREATE TABLE IF NOT EXISTS clubs (
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
      )`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS clubs_name_uq ON clubs (lower(name))`;
      // Байгууллага ч мөн энэ хүснэгтэд (kind = 'org'): гишүүнчлэлгүй, зөвхөн дагагчтай
      await sql`ALTER TABLE clubs ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'club'`;
      await sql`ALTER TABLE clubs ADD COLUMN IF NOT EXISTS field TEXT`;
      await sql`ALTER TABLE clubs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`;
      await sql`CREATE TABLE IF NOT EXISTS club_members (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS club_members_club_idx ON club_members (club_id)`;
      await sql`CREATE TABLE IF NOT EXISTS club_invites (
        club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'board',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (club_id, user_id)
      )`;
      // Клубт нэгдэх хүсэлт (удирдагч шийднэ). Нэг хүн нэг л хүлээгдэж буй хүсэлттэй.
      await sql`CREATE TABLE IF NOT EXISTS club_requests (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      // Клубээс гарсан, шилжсэн түүх (1 сарын хоригт ашиглана)
      await sql`CREATE TABLE IF NOT EXISTS club_moves (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        from_club INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
        from_name TEXT,
        to_club INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
        at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS club_follows (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, club_id)
      )`;
      // Дэлгэрэнгүй профайл (Figma: Шинэ хэрэглэгч)
      await sql`CREATE TABLE IF NOT EXISTS profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email_public BOOLEAN NOT NULL DEFAULT false,
        gender TEXT, birth_date DATE, about TEXT,
        birth_country TEXT, birth_city TEXT, live_country TEXT, live_city TEXT,
        education TEXT, school TEXT, orcid TEXT, profession TEXT, job TEXT,
        socials JSONB NOT NULL DEFAULT '{}'::jsonb,
        origin_view TEXT, religion TEXT, belief TEXT, politics TEXT,
        agreed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      // Мэдэгдэл: батлагдсан, татгалзсан, хасагдсан, сэтгэгдэл, шинэ дагагч
      await sql`CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        note TEXT,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC)`;
      await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE`;
      // Нэвтрэх оролдлого (нууц үг таах халдлагаас хамгаална)
      await sql`CREATE TABLE IF NOT EXISTS login_attempts (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts (email, created_at)`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
