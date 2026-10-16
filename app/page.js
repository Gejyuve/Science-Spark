import ThemeToggle from "./components/ThemeToggle";

const nav = [
  { icon: "💧", label: "Урсгал", active: true },
  { icon: "🌿", label: "Мод" },
  { icon: "📖", label: "Толь" },
  { icon: "🎮", label: "Тоглоом" },
  { icon: "🔥", label: "Төслүүд" },
  { icon: "❔", label: "Тусламж" },
];

const posts = [
  {
    tag: "Нийтлэл",
    title: "Пи тоо ба Пифилологи гэж юу вэ?",
    text: "Тойргийн урт, түүний диаметртэй харьцаагаар тодорхойлогддог энэ тоо 3.14159-өөр эхэлдэг.",
    author: "Б.Тэмүүлэн",
    date: "2025.03.14",
    sparks: 190,
  },
  {
    tag: "Асуулт",
    title: "Пи тооны хэдэн оронг цээжилж болох вэ?",
    text: "Дэлхийн рекорд, цээжлэх арга техникийн талаар хэлэлцье.",
    author: "Д.Анар",
    date: "2025.09.30",
    sparks: 42,
  },
  {
    tag: "Мэдээ",
    title: "Одон орны ажиглалтын шинэ төв нээгдлээ",
    text: "Судлаач, оюутнуудад зориулсан нээлттэй ажиглалтын талбай ажиллаж эхэллээ.",
    author: "Ж.Баяржавхлан",
    date: "2025.10.14",
    sparks: 87,
  },
];

export default function Home() {
  return (
    <div className="shell">
      <aside className="side left">
        <div className="brand">✦ Science Spark</div>
        <input className="search" placeholder="Хайх" aria-label="Хайх" />
        <nav>
          {nav.map((n) => (
            <a key={n.label} href="#" className={"nav-item" + (n.active ? " active" : "")}>
              <span>{n.icon}</span>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="grow" />
        <ThemeToggle />
      </aside>

      <main className="feed">
        <div className="composer">Өнөөдөр ямар оч асаах гэж байна даа?</div>
        {posts.map((p) => (
          <article key={p.title} className="card">
            <span className="chip">{p.tag}</span>
            <h2>{p.title}</h2>
            <p>{p.text}</p>
            <div className="meta">
              <span>{p.author}</span>
              <span>·</span>
              <span>{p.date}</span>
              <span className="spark">✦ {p.sparks}</span>
            </div>
          </article>
        ))}
      </main>

      <aside className="side right">
        <div className="panel">
          <h3>А.Доржпалам</h3>
          <p className="muted">1,850 оч · Түвшин 4 · Фузион</p>
        </div>
        <div className="panel">
          <h3>🔥 Асаж буй оч</h3>
          <p className="muted">Ж.Баяржавхлан · Б.Түмэнбаяр · Д.Анар</p>
        </div>
      </aside>
    </div>
  );
}
