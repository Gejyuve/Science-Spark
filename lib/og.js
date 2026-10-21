// Хуваалцах үеийн зураг (Open Graph, 1200x630): өөрийн зураггүй контент болон сайтын ерөнхий зураг.
// Facebook, Messenger, X гэх мэт платформ холбоосыг урьдчилж харуулахдаа энэ зургийг авна.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { strip } from "@/lib/md";

export const OG_SIZE = { width: 1200, height: 630 };
export const SLOGAN = "Igniting curiosity, together.";
const TAGLINE = "Шинжлэх ухааныг хамтдаа асаая";

// Inter (Latin + Кирилл, Ө Ү орсон) — lib/og-assets/ дахь жижигрүүлсэн хуулбар
let assets;
function loadAssets() {
  assets ||= Promise.all([
    readFile(join(process.cwd(), "lib/og-assets/Inter-SemiBold.otf")),
    readFile(join(process.cwd(), "lib/og-assets/Inter-Medium.otf")),
    readFile(join(process.cwd(), "public/icons/lockup-dark.png")),
    readFile(join(process.cwd(), "lib/og-assets/lighthouse.svg")),
  ]).then(([semi, medium, lockup, tower]) => ({
    fonts: [
      { name: "Inter", data: semi, weight: 600, style: "normal" },
      { name: "Inter", data: medium, weight: 500, style: "normal" },
    ],
    lockup: `data:image/png;base64,${lockup.toString("base64")}`,
    lighthouse: `data:image/svg+xml;base64,${tower.toString("base64")}`,
  }));
  return assets.catch((e) => { assets = null; throw e; });
}

// Урт текстийг үгийн хил дээр тасалж "…" нэмнэ
function clip(s, max) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:—-]+$/, "") + "…" : t;
}

// Эхний өгүүлбэр (хэт богино бол дараагийнхыг нь нийлүүлнэ)
function firstSentence(src) {
  const t = strip(src).replace(/\s+/g, " ").trim();
  const m = t.match(/^.{10,}?[.!?…](?=\s|$)/);
  return m ? m[0] : t;
}

// Контентын хуваалцах текст: асуулт, бодрол бол өөрийнх нь эхний өгүүлбэр, бусад нь гарчиг
export function shareText(post) {
  if (post.kind === "Асуулт" || post.kind === "Бодрол") return clip(firstSentence(post.body) || post.title, 150);
  return clip(post.title || firstSentence(post.body), 150);
}

// Тайлбар (og:description): товч агуулга
export function shareDescription(post) {
  return clip(post.subtitle || strip(post.body), 200);
}

const KIND_LABEL = { Үг: "Толь" };

export async function ogImage({ text, kind } = {}) {
  const { fonts, lockup, lighthouse } = await loadAssets();
  const main = text || TAGLINE;
  const size = main.length <= 40 ? 72 : main.length <= 80 ? 60 : main.length <= 120 ? 50 : 44;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Inter",
        background: "linear-gradient(135deg, #0e1b20 0%, #12232a 55%, #0f2f2d 100%)" }}>
        {/* Баруун талын гэрэлт цамхаг */}
        <div style={{ position: "absolute", right: -160, top: -120, width: 760, height: 760, borderRadius: 380, display: "flex",
          background: "radial-gradient(circle, rgba(55,195,179,0.32) 0%, rgba(55,195,179,0.08) 45%, rgba(55,195,179,0) 70%)" }} />
        <img src={lighthouse} width={440} height={520} style={{ position: "absolute", right: 20, top: 16 }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px", width: "100%", height: "100%" }}>
          <img src={lockup} width={300} height={55} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, width: 720 }}>
            {kind && (
              <div style={{ display: "flex", marginBottom: 22 }}>
                <span style={{ fontSize: 26, fontWeight: 600, color: "#0e1d21", background: "#37c3b3", borderRadius: 999, padding: "6px 20px" }}>{KIND_LABEL[kind] || kind}</span>
              </div>
            )}
            <div style={{ fontSize: size, fontWeight: 600, lineHeight: 1.18, color: "#ffffff", letterSpacing: -0.5 }}>{main}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", fontSize: 30, fontWeight: 500 }}>
            <span style={{ color: "#5fd6c8" }}>{SLOGAN}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    }
  );
}
