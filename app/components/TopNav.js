import Link from "next/link";
import { DrawerBtn } from "./Drawer";
import NavSpin from "./NavSpin";

const I = (name, size = 22) => (
  <img className={/^(logo)$/.test(name) ? "" : "ic"} src={`/icons/${name}.svg`} width={size} height={size} alt="" />
);

// Дээд цэс: лого ба 2 талд нь 2, 2 товч. Товчууд нь зүүн цэсийн идэвхтэй хэсгүүдээс санамсаргүй ээлжилж солигдоно (NavSpin).
// Нүүрэнд наалттай (sticky), бусад бүх хуудсанд (хянах, админ орно) хөдөлгөөнгүй байдлаар харагдана.
export function NavRow({ active, menu = false, me = null }) {
  return (
    <div className={"ss-topnav" + (menu ? " has-drawers" : "")}>
      {menu && <DrawerBtn side="left" className="ss-round ss-mbtn" label="Цэс">{I("menu", 20)}</DrawerBtn>}
      <NavSpin side={0} active={active} />
      <Link href="/" className="ss-logo" aria-label="Нүүр">
        <img src="/icons/logo.svg" width={74} height={74} alt="Science Spark" />
      </Link>
      <NavSpin side={1} active={active} />
      {menu && <DrawerBtn side="right" className="ss-round ss-mbtn ss-me" label="Профайл">{me}</DrawerBtn>}
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
