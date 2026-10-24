// Бичих самбарын зөв бичгийн шалгалт: текстээс шалгах үгсийг ялгана.
// Толийн шалгалт (Hunspell mn_MN) нь хөтөч дотор app/components/spell.worker.js-д явагдана.

const CYR = /[Ѐ-ӿ]/;

// Шалгахгүй хэсэг: код, холбоосын хаяг, зургийн эх сурвалж, имэйл
const SKIP = /```[\s\S]*?```|`[^`\n]*`|\]\([^)\n]*\)|https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/g;
const WORD = /\p{L}+/gu;

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

// Толиор шалгах шаардлагатай эсэх: товчилсон нэр (НАСА, ДНХ), нэг үсэг алгасна
export const needsDict = (word) => word.length > 1 && word !== word.toUpperCase();
