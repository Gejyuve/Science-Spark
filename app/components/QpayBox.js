"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Spark from "./Spark";

// QPay-ийн QR, банкны апп-ын холбоосууд. Хэдэн секунд тутам төлөгдсөн эсэхийг асууж,
// төлөгдмөгц onPaid дуудна (эсвэл хуудсыг шинэчилнэ).
export default function QpayBox({ code, qpay, onPaid }) {
  const router = useRouter();
  const [status, setStatus] = useState("pending");
  useEffect(() => {
    let stop = false, timer = null;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      try {
        const r = await fetch(`/api/qpay/status?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        const j = await r.json();
        if (j.status && j.status !== "pending") {
          setStatus(j.status);
          if (j.status === "confirmed") onPaid ? onPaid() : router.refresh();
          return;
        }
      } catch (e) {}
      // 20 минутын дараа асуухаа болино (callback ирвэл баталгаажсан хэвээр)
      if (Date.now() - started < 20 * 60 * 1000) timer = setTimeout(tick, document.hidden ? 10000 : 4000);
    };
    timer = setTimeout(tick, 4000);
    return () => { stop = true; clearTimeout(timer); };
  }, [code]);

  if (status === "confirmed") return <p className="qp-wait ok">✓ Төлбөр орлоо. Баярлалаа!</p>;
  if (status === "cancelled") return <p className="qp-wait">Энэ хүсэлт цуцлагдсан байна.</p>;
  return (
    <div className="qp">
      {qpay.qr_image && (
        <div className="qp-qr">
          <img src={`data:image/png;base64,${qpay.qr_image}`} width={200} height={200} alt="QPay QR код" />
          <small>Банкны апп-аараа QR кодыг уншуулна</small>
        </div>
      )}
      {qpay.urls?.length > 0 && (
        <div className="qp-apps">
          <small>Утсан дээрээ банкны апп-аа сонгоно</small>
          <div>
            {qpay.urls.map((u) => (
              <a key={u.name + u.link} href={u.link} className="qp-app" title={u.description || u.name}>
                {u.logo && <img src={u.logo} width={36} height={36} alt="" loading="lazy" />}
                <span>{u.description || u.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
      <p className="qp-wait"><Spark size={22} />Төлбөр орохыг хүлээж байна. Орсон даруйд автоматаар баталгаажна.</p>
    </div>
  );
}
