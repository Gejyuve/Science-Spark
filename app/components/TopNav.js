import Link from "next/link";

const I = (name, size = 22) => (
  <img className={/^(logo)$/.test(name) ? "" : "ic"} src={`/icons/${name}.svg`} width={size} height={size} alt="" />
);

// Дээд цэс: лого ба 6 товч. Нүүр болон зүүн 3 товчны хуудсанд наалттай (sticky),
// бусад бүх хуудсанд (хянах, админ орно) хөдөлгөөнгүй байдлаар харагдана.
export function NavRow({ active }) {
  return (
    <div className="ss-topnav">
      <Link className={"ss-round" + (active === "top" ? " on" : "")} href="/?f=top" title="Сүүлийн 24 цагийн топ">{I("hspark")}</Link>
      <Link className={"ss-round" + (active === "rand" ? " on" : "")} href="/?f=rand" title="Санамсаргүй" prefetch={false}>{I("dice")}</Link>
      <Link className={"ss-round" + (active === "qa" ? " on" : "")} href="/?f=qa" title="Асуулт ба бодрол">{I("ask", 24)}</Link>
      <Link href="/" className="ss-logo" aria-label="Нүүр">
        <img src="/icons/logo.svg" width={74} height={74} alt="Science Spark" />
      </Link>
      <Link className={"ss-round" + (active === "/events" ? " on" : "")} href="/events" title="Эвент">{I("event", 24)}</Link>
      <span className="ss-round soon" title="Тун удахгүй">{I("market")}</span>
      <span className="ss-round soon" title="Тун удахгүй">{I("club", 24)}</span>
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
