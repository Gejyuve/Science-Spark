"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Баруун самбар: бусад хуудсанд «Профайл», өөрийн профайл дээр «Засах»
export default function ProfileAction({ id }) {
  const own = usePathname() === `/u/${id}`;
  return (
    <Link href={own ? "/profile/edit" : `/u/${id}`} className="ss-action">
      <img className="ic" src={own ? "/icons/pen16.svg" : "/icons/person.svg"} width={18} height={18} alt="" />
      <span>{own ? "Засах" : "Профайл"}</span>
      <img className="ic" src="/icons/arrow.svg" width={14} height={14} alt="" />
    </Link>
  );
}
