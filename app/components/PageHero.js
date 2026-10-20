// Хуудасны өнгөлөг толгой: Мод, Нийтлэл, Мэдээ, Даалгавар нэг загвартай, өнгө нь хуудас бүрт өөр.
// tone: tree | article | news | task | report | help

const ART = {
  // Мод: их бие, мөчир, навчис
  tree: (
    <>
      <path d="M100 194v-80M100 148l-26-22M100 132l24-20" />
      <g className="ph-fill">
        <circle cx="100" cy="66" r="40" />
        <circle cx="62" cy="92" r="30" />
        <circle cx="140" cy="90" r="32" />
        <circle cx="100" cy="104" r="26" />
      </g>
    </>
  ),
  // Нийтлэл: нээлттэй ном
  article: (
    <>
      <path d="M100 58c-22-14-50-16-74-10v118c24-6 52-4 74 10 22-14 50-16 74-10V48c-24-6-52-4-74 10z" />
      <path d="M100 58v118M44 78h34M44 98h34M44 118h26M122 78h34M122 98h34M122 118h26" />
    </>
  ),
  // Мэдээ: дамжуулах цамхаг, долгион
  news: (
    <>
      <circle cx="100" cy="92" r="12" className="ph-fill" />
      <path d="M100 104l-26 88M100 104l26 88M84 160h32" />
      <path d="M72 64a40 40 0 0 0 0 56M128 64a40 40 0 0 1 0 56M50 42a70 70 0 0 0 0 100M150 42a70 70 0 0 1 0 100" />
    </>
  ),
  // Даалгавар: колба, бөмбөлөг
  task: (
    <>
      <path d="M80 30h40M88 30v52l-44 84c-6 12 2 24 16 24h80c14 0 22-12 16-24l-44-84V30" />
      <path d="M62 140h76" />
      <circle cx="90" cy="162" r="7" className="ph-fill" />
      <circle cx="116" cy="170" r="5" className="ph-fill" />
      <circle cx="104" cy="118" r="4" className="ph-fill" />
    </>
  ),
  // Тайлан: самбар, тэмдэглэгээ
  report: (
    <>
      <rect x="46" y="36" width="108" height="150" rx="14" />
      <path d="M80 28h40v20H80zM68 84l10 10 18-20M108 86h30M68 124l10 10 18-20M108 126h30M68 162h70" />
    </>
  ),
  // Тусламж: аврах цагираг, асуултын бөмбөлөг
  help: (
    <>
      <circle cx="100" cy="100" r="62" />
      <circle cx="100" cy="100" r="28" />
      <path d="M56 56l24 24M144 56l-24 24M56 144l24-24M144 144l-24-24" />
      <circle cx="100" cy="100" r="10" className="ph-fill" />
    </>
  ),
};

const EMOJI = { tree: "🌳", article: "📖", news: "📡", task: "🧪", report: "📝", help: "🛟" };

export default function PageHero({ tone, title, text, children }) {
  return (
    <section className={`ph ph-${tone}`}>
      <i className="ph-blob a" aria-hidden="true" />
      <i className="ph-blob b" aria-hidden="true" />
      <svg className="ph-art" viewBox="0 0 200 200" aria-hidden="true">{ART[tone]}</svg>
      <i className="tl-star a" aria-hidden="true" /><i className="tl-star b" aria-hidden="true" /><i className="tl-star c" aria-hidden="true" />
      <div className="ph-body">
        <h1><span className="ph-ico" aria-hidden="true">{EMOJI[tone]}</span>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {children && <div className="ph-side">{children}</div>}
    </section>
  );
}
