// Бичих самбарын зөв бичгийн шалгалт: текстийг үг болгон хувааж, сайтын дүрмийг шалгана.
// Толийн шалгалт (Hunspell mn_MN) нь хөтөч дотор app/components/spell.worker.js-д явагдана.

// Сайтын өөрийн дүрэм: үгийн эхлэлийг солино (клубынхаа → клубийнхаа гэх мэт хувилалд ч ажиллана)
export const SPELL_RULES = [
  { from: "клубын", to: "клубийн" },
  { from: "клубуу", to: "клубүү" },
  { from: "дэмжие", to: "дэмжье" },
];

// Толинд байхгүй ч сайтад түгээмэл үгс: [үг, ижил нөхцөл авдаг толийн үг]
export const SITE_WORDS = [
  ["эвент", "интернет"],
  ["вэб", "интернет"],
  ["блог", "каталог"],
  ["админ", "физик"],
  ["суперадмин", "физик"],
  ["профайл", "файл"],
];

// Кирилл үгэнд андуурч орсон латин үсэг (гадна төрхөөрөө ижил)
const LOOK = { a: "а", c: "с", e: "е", o: "о", p: "р", x: "х", y: "у", A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У" };

const CYR = /[Ѐ-ӿ]/;
const LAT = /[A-Za-z]/;

// Шалгахгүй хэсэг: код, холбоосын хаяг, зургийн эх сурвалж, имэйл
const SKIP = /```[\s\S]*?```|`[^`\n]*`|\]\([^)\n]*\)|https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/g;
const WORD = /\p{L}+/gu;

const keepCase = (src, out) => {
  if (src === src.toUpperCase()) return out.toUpperCase();
  if (src[0] === src[0].toUpperCase()) return out[0].toUpperCase() + out.slice(1);
  return out;
};

// Текст доторх бүх кирилл үг: { from, to, word }
export function tokens(text) {
  const skip = [];
  let m;
  SKIP.lastIndex = 0;
  while ((m = SKIP.exec(text))) skip.push([m.index, m.index + m[0].length]);
  const out = [];
  let k = 0;
  WORD.lastIndex = 0;
  while ((m = WORD.exec(text))) {
    const from = m.index, to = from + m[0].length;
    while (k < skip.length && skip[k][1] <= from) k++;
    if (k < skip.length && skip[k][0] < to) continue;
    if (!CYR.test(m[0])) continue;
    out.push({ from, to, word: m[0] });
  }
  return out;
}

// Сайтын дүрэм эсвэл холимог үсгийн алдаа. Толийн шалгалт хэрэгтэй бол null.
export function ruleIssue(word) {
  if (LAT.test(word)) {
    const fixed = [...word].map((ch) => LOOK[ch] || ch).join("");
    return { kind: "mix", note: "Кирилл үгэнд латин үсэг холилдсон байна.", fix: LAT.test(fixed) ? null : fixed };
  }
  const low = word.toLowerCase();
  for (const r of SPELL_RULES) {
    if (low.startsWith(r.from)) return { kind: "rule", note: `Сайтын дүрмээр «${r.to}» гэж бичнэ.`, fix: keepCase(word, r.to + low.slice(r.from.length)) };
  }
  return null;
}

// Толиор шалгах шаардлагатай эсэх: товчилсон нэр (НАСА, ДНХ), нэг үсэг алгасна
export const needsDict = (word) => word.length > 1 && word !== word.toUpperCase();
