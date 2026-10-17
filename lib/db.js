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
