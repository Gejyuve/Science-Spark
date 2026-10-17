import Link from "next/link";

// Figma: Нэвтрэх / Асаах дэлгэцийн нийтлэг карт (бүдэг ногоон дугуйтай арын дэвсгэр)
export default function AuthCard({ action, error, children, footer }) {
  return (
    <div className="au-wrap">
      <span className="au-blob a" aria-hidden="true" />
      <span className="au-blob b" aria-hidden="true" />
      <form className="au-card" action={action}>
        <Link href="/" className="au-close" aria-label="Хаах">
          <img src="/icons/close.svg" width={16} height={16} alt="" />
        </Link>
        <img className="au-logo" src="/icons/logo.svg" width={96} height={96} alt="Science Spark" />
        <div className="au-quote">
          <p>“Харанхуйг зүхэж суухаар<br />нэг ч гэсэн лаа асаа”</p>
          <span>— Элеонора Рузвельт</span>
        </div>
        {error && <p className="error">{error}</p>}
        {children}
        <button className="au-primary" type="submit">
          <img src="/icons/flamew.svg" width={20} height={20} alt="" />
          Асаая өө!
        </button>
        {footer}
      </form>
    </div>
  );
}

export function Field({ icon = "mail", ...props }) {
  return (
    <label className="au-field">
      {icon && <img src={`/icons/${icon}.svg`} width={20} height={20} alt="" />}
      <input {...props} />
    </label>
  );
}
