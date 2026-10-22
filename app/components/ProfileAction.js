"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NotifMenu from "./NotifMenu";

const Ic = ({ name, size }) => <img className="ic" src={`/icons/${name}.svg`} width={size} height={size} alt="" />;

// Баруун самбар: бусад хуудсанд «Профайл», өөрийн профайл дээр «Засах».
// Клуб, байгууллагатай хүнд дарахад өөрийн, клубийн, байгууллагын профайл сонголттой гарна (зочлох л, хаяг солихгүй)
export default function ProfileAction({ id, rows = [] }) {
  const path = usePathname();
  const own = path === `/u/${id}`;
  if (rows.length < 2) {
    return (
      <Link href={own ? "/profile/edit" : `/u/${id}`} className="ss-action">
        <Ic name={own ? "pen16" : "person"} size={18} />
        <span>{own ? "Засах" : "Профайл"}</span>
        <Ic name="arrow" size={14} />
      </Link>
    );
  }
  return (
    <NotifMenu label="Профайл" popClass="as-pop" hover={false} closeOnSubmit
      trigger={<><Ic name="person" size={18} /><span>Профайл</span><Ic name="arrow" size={14} /></>}>
      <div className="nf-head"><b>Профайл</b></div>
      {rows.map(({ href, av, name, kind }) => {
        const on = path === href;
        return (
          <Link key={href} href={href} className={"as-row" + (on ? " on" : "")} aria-current={on ? "page" : undefined}>
            {av}<span><b>{name}</b><small>{kind}</small></span>
            {on && <em>✓</em>}
          </Link>
        );
      })}
      {own && (
        <Link href="/profile/edit" className="as-row as-edit">
          <Ic name="pen16" size={16} /><span><b>Профайлаа засах</b></span>
        </Link>
      )}
    </NotifMenu>
  );
}
