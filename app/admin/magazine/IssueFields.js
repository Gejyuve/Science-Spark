// Дугаарын талбарууд: нэмэх, засах хоёрт ижил. Үнийг төгрөгөөр (0 = үнэгүй / зарахгүй).
export function IssueFields({ i = {} }) {
  return (
    <>
      <div className="vd-opts">
        <label><span>Дугаар №</span><input name="number" type="number" min={1} max={10000} defaultValue={i.number ?? ""} required className="vd-pos" /></label>
        <label><span>Гарсан огноо</span><input name="issued_on" type="date" defaultValue={i.issued_on ? new Date(i.issued_on).toLocaleDateString("sv-SE") : ""} /></label>
      </div>
      <label className="vd-f"><span>Гарчиг</span><input name="title" defaultValue={i.title || ""} maxLength={140} required placeholder="Жишээ: Сансрын эрин" /></label>
      <label className="vd-f"><span>Тайлбар</span><textarea name="body" defaultValue={i.body || ""} maxLength={2000} rows={3} className="vd-in" placeholder="Энэ дугаарт юу багтсан бэ? (заавал биш)" /></label>
      <div className="vd-opts">
        <label><span>Онлайн унших үнэ (₮)</span><input name="price_mnt" type="number" min={0} max={10000000} step={100} defaultValue={i.price_mnt ?? 10000} required /></label>
        <label><span>Үнэгүй харах хуудас</span><input name="preview_pages" type="number" min={0} max={50} defaultValue={i.preview_pages ?? 3} required /></label>
        <label><span>Биет хувийн үнэ (₮, 0 = зарахгүй)</span><input name="print_price" type="number" min={0} max={10000000} step={100} defaultValue={i.print_price ?? 0} required /></label>
        <label><span>Хүргэлтийн төлбөр (₮)</span><input name="delivery_fee" type="number" min={0} max={10000000} step={100} defaultValue={i.delivery_fee ?? 0} required /></label>
      </div>
    </>
  );
}
