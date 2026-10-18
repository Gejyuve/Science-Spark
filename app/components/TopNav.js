import Link from "next/link";

const I = (name, size = 22) => (
  <img className={/^(logo)$/.test(name) ? "" : "ic"} src={`/icons/${name}.svg`} width={size} height={size} alt="" />
);

// Дээд цэс: лого ба 6 товч. Зүүн 3 товчны үүргийг нүүрний шүүлтүүр рүү шилжүүлсэн. Нүүрэнд наалттай (sticky),
// бусад бүх хуудсанд (хянах, админ орно) хөдөлгөөнгүй байдлаар харагдана.
export function NavRow({ active }) {
  return (
    <div className="ss-topnav">
      <span className="ss-round soon" title="Тун удахгүй">{I("hspark")}</span>
      <span className="ss-round soon" title="Тун удахгүй">{I("dice")}</span>
      <span className="ss-round soon" title="Тун удахгүй">{I("ask", 24)}</span>
      <Link href="/" className="ss-logo" aria-label="Нүүр">
        <img src="/icons/logo.svg" width={74} height={74} alt="Science Spark" />
      </Link>
      <Link className={"ss-round" + (active === "/events" ? " on" : "")} href="/events" title="Эвент">{I("event", 24)}</Link>
      <span className="ss-round soon" title="Тун удахгүй">{I("market")}</span>
      <Link className={"ss-round" + (active === "/clubs" ? " on" : "")} href="/clubs" title="Клуб">{I("club", 24)}</Link>
    </div>
  );
}

export default function TopNav({ active, className = "" }) {
  return (
    <header className={"ss-header compact static " + className}>
      <NavRow active={active} />
    </header>
  );
}
