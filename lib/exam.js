import { sql } from "./db";

// Хянагчийн шалгалт: 5 жишээ нийтлэл. Өгүүлбэр бүр [текст, алдааны төрөл(үүд) эсвэл null].
// Оролцогч алдаатай өгүүлбэрийг тэмдэглэж, төрлийг нь сонгоод, эцсийн шийдвэр гаргана.

export const ERROR_TYPES = [
  ["fact", "Баримтын алдаа"],
  ["logic", "Логик алдаа"],
  ["source", "Эх сурвалжгүй баталгаа"],
  ["grammar", "Зөв бичгийн алдаа"],
  ["ad", "Сурталчилгаа, дүрэм зөрчсөн"],
];
export const ERROR_LABEL = Object.fromEntries(ERROR_TYPES);

export const DECISIONS = [
  ["approve", "Шууд зөвшөөрөх"],
  ["fix", "Засвар хийгээд зөвшөөрөх"],
  ["reject", "Бичээч рүү буцаах"],
];
export const DECISION_LABEL = Object.fromEntries(DECISIONS);

export const MAX_FAILS = 5;
export const LOCK_DAYS = 30;
export const PASS_SCORE = 75;

export const SAMPLES = [
  {
    title: "Пи тоо гэж юу вэ?",
    subtitle: "Математикийн хамгийн алдартай тогтмолын товч түүх",
    kind: "Нийтлэл",
    category: "Математик",
    author: "Б.Жишээ",
    decision: "reject",
    paras: [
      [
        ["Пи бол тойргийн уртыг түүний диаметрт харьцуулсан харьцаа юм.", null],
        ["Энэ тоо ойролцоогоор 3.14159-тэй тэнцүү.", null],
        ["Пи тоо нь яг 22/7-тэй тэнцүү бөгөөд энэ нь түүний бүрэн утга юм.", ["fact"]],
      ],
      [
        ["Пи нь иррациональ тоо тул аравтын бутархай хэлбэрт нь цифрүүд давтагдалгүй, төгсгөлгүй үргэлжилнэ.", null],
        ["Эртний Грекийн эрдэмтэн Архимед олон өнцөгт ашиглан пи-г 3.1408-аас 3.1429-ийн хооронд байна гэж тогтоосон.", null],
        ["Архимед энэ тооцоогоо 18-р зуунд хийсэн.", ["fact"]],
      ],
      [
        ["Тойргийн талбай нь пи-г радиусын квадратаар үржүүлсэнтэй тэнцүү.", null],
        ["Иймээс радиус нь хоёр дахин ихэсвэл талбай нь мөн хоёр дахин ихэснэ.", ["logic", "fact"]],
        ["Математикчдын 95% нь пи-г хамгийн чухал тоо гэж үздэг.", ["source"]],
        ["Пи-гийн өдрийг жил бүрийн 3-р сарын 14-нд тэмдэглэдэг.", null],
      ],
    ],
  },
  {
    title: "Нарны аймгийн гаригууд",
    subtitle: "Бидний хөрш гаригуудын тухай товч танилцуулга",
    kind: "Нийтлэл",
    category: "Одон орон",
    author: "Д.Жишээ",
    decision: "reject",
    paras: [
      [
        ["Нарны аймагт найман гариг бий.", null],
        ["Нарнаас хамгийн ойр орших гариг бол Сугар юм.", ["fact"]],
        ["Бархасбадь бол нарны аймгийн хамгийн том гариг.", null],
      ],
      [
        ["Сар өөрөө гэрэл үүсгэдэг учраас шөнө гэрэлтэж харагддаг.", ["fact"]],
        ["Дэлхий нарыг нэг жилд нэг бүтэн тойрно.", null],
        ["Дэлхий нарнаас хамгийн хол байх үед өвөл, ойр байх үед зун болдог.", ["fact", "logic"]],
        ["Улирал солигдох нь Дэлхийн тэнхлэг хазайсантай холбоотой.", null],
      ],
      [
        ["Ангараг гараг улаан өнгөтэй харагддаг нь гадаргуу дээрх төмрийн исэлтэй холбоотой.", null],
        ["Шинжээчдийн үзэж байгаагаар 2030 он гэхэд Ангараг дээр хот байгуулагдах нь гарцаагүй.", ["source"]],
      ],
    ],
  },
  {
    title: "Ус яагаад онцгой вэ?",
    subtitle: "Өдөр бүр хэрэглэдэг ч бүрэн мэддэггүй бодис",
    kind: "Нийтлэл",
    category: "Хими",
    author: "С.Жишээ",
    decision: "reject",
    paras: [
      [
        ["Усны молекул нь хоёр устөрөгч, нэг хүчилтөрөгчийн атомаас тогтдог.", null],
        ["Далайн түвшинд цэвэр ус 100 хэмд буцалдаг.", null],
        ["Өндөр ууланд агаарын даралт бага тул ус 100 хэмээс доош температурт буцална.", null],
      ],
      [
        ["Мөс усан дээр хөвдөг нь мөс уснаас хүнд гэдгийг харуулж байна.", ["logic", "fact"]],
        ["Ус хөлдөхдөө тэлдэг тул мөсний нягт уснаас бага байдаг.", null],
        ["Насанд хүрсэн хүний биеийн жингийн тал гаруй хувь нь ус байдаг.", null],
        ["Өдөрт 10 литр ус уувал ямар ч өвчин тусахгүй.", ["fact", "source"]],
      ],
      [
        ["Хамгийн цэвэр усыг зөвхөн манай «Цэнгэг» брэндийн шүүлтүүрээс авах боломжтой, одоо захиалаарай!", ["ad"]],
        ["Ус олон бодисыг сайн уусгадаг тул түүнийг «түгээмэл уусгагч» гэж нэрлэдэг.", null],
      ],
    ],
  },
  {
    title: "ДНХ гэж юу вэ?",
    subtitle: "Амьдралын код хэрхэн хадгалагддаг вэ",
    kind: "Нийтлэл",
    category: "Биологи",
    author: "Г.Жишээ",
    decision: "fix",
    paras: [
      [
        ["ДНХ бол амьд организмын удамшлын мэдээллийг хадгалдаг молекул юм.", null],
        ["Түүний бүтэц нь давхар мушгиа хэлбэртэй.", null],
        ["Энэ бүтцийг 1953 онд Уотсон, Крик нар тодорхойлсон бөгөөд Розалинд Франклины рентген зураг үүнд чухал үүрэг гүйцэтгэсэн.", null],
      ],
      [
        ["ДНХ дөрвөн төрлийн азотын суурь агуулдаг: аденин, тимин, гуанин, цитозин.", null],
        ["Аденин нь тиминтэй, гуанин нь цитозинтой хосолдог.", null],
        ["Хүний биеийн бараг бүх эсэд ДНХ агуулагддаг.", null],
      ],
      [
        ["Эрдэмтэд ДНХ-ийн дараалалыг тайлах аргыг улам боловсронгуй болгосоор байна байна.", ["grammar"]],
        ["Энэ нь өвчиний шалтгааныг илрүүлэхэд тусалдаг.", ["grammar"]],
      ],
    ],
  },
  {
    title: "Вакцин биеийг хэрхэн хамгаалдаг вэ?",
    subtitle: "Дархлааны системийн «бэлтгэл сургуулилт»",
    kind: "Нийтлэл",
    category: "Анагаах ухаан",
    author: "Э.Жишээ",
    decision: "reject",
    paras: [
      [
        ["Вакцин нь дархлааны системд тодорхой өвчин үүсгэгчийг таньж сурахад тусалдаг.", null],
        ["Вакцинд ихэвчлэн сулруулсан эсвэл идэвхгүйжүүлсэн өвчин үүсгэгч, эсвэл түүний хэсэг агуулагддаг.", null],
        ["Вакцин хийлгэсний дараа бие эсрэгбие үүсгэж, жинхэнэ өвчин үүсгэгчтэй таарвал хурдан хариу үзүүлдэг.", null],
      ],
      [
        ["Эдвард Женнер 18-р зууны төгсгөлд цэцэг өвчний эсрэг вакциныг анх туршсан.", null],
        ["Миний хөрш вакцин хийлгээгүй ч хэзээ ч өвдөөгүй, тиймээс вакцин хэрэггүй нь батлагдсан.", ["logic"]],
        ["Антибиотик вирусыг устгадаг тул вакцины оронд антибиотик уухад хангалттай.", ["fact"]],
      ],
      [
        ["Сүүлийн судалгаагаар бүх вакцин 100% хамгаалдаг нь тогтоогдсон.", ["source", "fact"]],
        ["Вакцинжуулалтын ачаар цэцэг өвчин дэлхий дахинд устгагдсан.", null],
      ],
    ],
  },
];

// Өгүүлбэрүүдийг дугаартай нэг жагсаалт болгоно
export function sentences(sample) {
  const out = [];
  sample.paras.forEach((p, pi) => p.forEach(([t, err]) => out.push({ i: out.length, p: pi, t, err })));
  return out;
}

// Үнэлгээ: зөв төрөлтэй олсон алдаа 1, төрөл зөрсөн 0.5; алдаагүйг тэмдэглэвэл -0.5.
export function grade(sampleNo, marks, decision) {
  const s = SAMPLES[sampleNo];
  const list = sentences(s);
  const errors = list.filter((x) => x.err);
  let credit = 0;
  let typed = 0;
  let found = 0;
  let falsePos = 0;
  for (const x of list) {
    const m = marks[x.i];
    if (x.err && m) {
      found++;
      if (x.err.includes(m)) {
        credit += 1;
        typed++;
      } else credit += 0.5;
    } else if (!x.err && m) falsePos++;
  }
  const score = Math.max(0, Math.round((100 * (credit - 0.5 * falsePos)) / errors.length));
  const decisionOk = decision === s.decision;
  return { score, found, typed, total: errors.length, falsePos, decisionOk, passed: score >= PASS_SCORE && decisionOk };
}

// Оролцогчийн одоогийн төлөв
export async function examState(user) {
  const [u] = await sql`SELECT exam_reset_at FROM users WHERE id = ${user.id}`;
  let since = u?.exam_reset_at || new Date(0);
  let attempts = await sql`SELECT id, sample, score, passed, created_at FROM exam_attempts
                           WHERE user_id = ${user.id} AND created_at > ${since} ORDER BY created_at`;
  let fails = attempts.filter((a) => !a.passed);
  let unlockAt = null;
  if (fails.length >= MAX_FAILS) {
    unlockAt = new Date(new Date(fails[fails.length - 1].created_at).getTime() + LOCK_DAYS * 86400000);
    if (unlockAt <= new Date()) {
      // Хаалт дууссан: шинэ мөчлөг эхэлнэ
      await sql`UPDATE users SET exam_reset_at = now() WHERE id = ${user.id}`;
      attempts = [];
      fails = [];
      unlockAt = null;
    }
  }
  const [req] = await sql`SELECT id, status, note, created_at, decided_at FROM reviewer_requests
                          WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 1`;
  const all = await sql`SELECT id, sample, score, passed, created_at FROM exam_attempts
                        WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 20`;
  let state = "open";
  if (req?.status === "pending") state = "pending";
  else if (unlockAt) state = "locked";
  return {
    state,
    request: req || null,
    fails: fails.length,
    left: MAX_FAILS - fails.length,
    sample: attempts.length % SAMPLES.length,
    attemptNo: attempts.length + 1,
    unlockAt,
    history: all,
  };
}
