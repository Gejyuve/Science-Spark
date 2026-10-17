// Шинжлэх ухааны мод: нийтлэл, мэдээний ангилал.
// Бүтэц: «Суурь нийтлэлүүд» төлөвлөгөөний 5 үндсэн ангилал → салбар → дэд салбар (4–5 түвшин).
// Түлхүүр нь зам болно: "nat/phys/nuc" гэх мэт. [түлхүүр, нэр, хүүхдүүд]
const T = (key, name, kids = []) => ({ key, name, kids });

export const TREE = T("", "Шинжлэх ухаан", [
  T("nat", "Байгалийн ухаан", [
    T("bio", "Биологи", [
      T("cell", "Эсийн биологи"),
      T("gen", "Молекул биологи ба генетик", [T("genet", "Генетик"), T("epi", "Эпигенетик"), T("biochem", "Биохими")]),
      T("evo", "Хувьслын биологи", [
        T("hist", "Хувьслын түүх"), T("phylo", "Филогенетик"), T("popgen", "Популяцийн генетик"), T("molevo", "Молекул хувьсал"),
        T("macro", "Макрохувьсал"), T("micro", "Микрохувьсал"), T("evoeco", "Хувьслын экологи"), T("evomed", "Хувьслын анагаах ухаан"), T("syst", "Систематик"),
      ]),
      T("physio", "Физиологи", [T("human", "Хүний физиологи"), T("plantphys", "Ургамлын физиологи")]),
      T("neuro", "Мэдрэл судлал", [T("brain", "Тархины бүтэц"), T("senses", "Мэдрэхүй"), T("memory", "Санах ой ба суралцахуй")]),
      T("eco", "Экологи"),
      T("zoo", "Амьтан судлал", [T("insect", "Шавьж судлал"), T("bird", "Шувуу судлал"), T("mammal", "Хөхтөн амьтан судлал")]),
      T("microb", "Микробиологи", [T("virus", "Вирус судлал"), T("bact", "Бактери судлал")]),
      T("bot", "Ургамал судлал"),
      T("astrobio", "Астробиологи"),
    ]),
    T("phys", "Физик", [
      T("astro", "Одон орон", [
        T("astrophys", "Астрофизик"), T("planet", "Гаригийн шинжлэх ухаан"), T("galaxy", "Галактикийн одон орон"),
        T("cosmo", "Сансар судлал"), T("sun", "Нарны физик"), T("space", "Сансрын хайгуул"), T("archaeo", "Археоастрономи"),
      ]),
      T("mech", "Сонгодог механик"),
      T("em", "Цахилгаан соронзон"),
      T("thermo", "Термодинамик"),
      T("quant", "Квант физик"),
      T("amo", "Атом, молекул, оптикийн физик"),
      T("nuc", "Цөмийн физик", [T("fission", "Цөмийн задрал"), T("fusion", "Цөмийн нэгдэл"), T("radio", "Радиоактив задрал"), T("struct", "Цөмийн бүтэц"), T("nucmed", "Цөмийн анагаах ухаан")]),
      T("particle", "Бөөмийн физик"),
      T("rel", "Харьцангуйн онол"),
      T("cond", "Хатуу биеийн физик"),
      T("acou", "Акустик"),
    ]),
    T("chem", "Хими", [
      T("physchem", "Физик хими"), T("org", "Органик хими"), T("inorg", "Органик бус хими"),
      T("anal", "Шинжилгээний хими"), T("nucchem", "Цөмийн хими"), T("biochem", "Биохими"),
    ]),
    T("earth", "Дэлхийн шинжлэх ухаан", [
      T("geo", "Геологи", [T("quake", "Газар хөдлөлт"), T("volcano", "Галт уул"), T("mineral", "Эрдэс судлал"), T("paleo", "Палеонтологи")]),
      T("atmo", "Агаар мандлын шинжлэх ухаан", [T("weather", "Цаг уур"), T("climate", "Уур амьсгал судлал")]),
      T("ocean", "Далай судлал"),
      T("glacier", "Мөсөн голын шинжлэх ухаан", [T("permafrost", "Мөнх цэвдэг")]),
      T("soil", "Хөрс судлал"),
      T("geog", "Газарзүй"),
    ]),
  ]),
  T("app", "Хэрэглээний ухаан", [
    T("health", "Эрүүл мэндийн шинжлэх ухаан", [
      T("med", "Анагаах ухаан", [T("immuno", "Дархлаа судлал"), T("infect", "Халдварт өвчин"), T("onco", "Хорт хавдар судлал"), T("pharma", "Эм судлал")]),
      T("nutri", "Хоол тэжээл"),
      T("epid", "Тархвар судлал"),
      T("mental", "Сэтгэцийн эрүүл мэнд"),
    ]),
    T("comp", "Тооцооллын ухаан", [T("cs", "Компьютерын шинжлэх ухаан"), T("ai", "Хиймэл оюун ухаан"), T("sec", "Мэдээллийн аюулгүй байдал")]),
    T("env", "Байгаль орчны шинжлэх ухаан", [T("climatechange", "Уур амьсгалын өөрчлөлт"), T("pollution", "Бохирдол"), T("desert", "Цөлжилт")]),
    T("energy", "Эрчим хүчний технологи", [T("renew", "Сэргээгдэх эрчим хүч"), T("nucpower", "Цөмийн эрчим хүч")]),
    T("eng", "Инженерчлэл ба технологи", [T("biotech", "Биотехнологи"), T("robot", "Робот техник"), T("spacetech", "Сансрын технологи")]),
  ]),
  T("soc", "Нийгмийн ухаан", [
    T("psy", "Сэтгэл судлал", [
      T("cog", "Танин мэдэхүйн сэтгэл судлал"), T("dev", "Хөгжлийн сэтгэл судлал"), T("social", "Нийгмийн сэтгэл судлал"),
      T("clin", "Клиник сэтгэл судлал"), T("evopsy", "Хувьслын сэтгэл судлал"),
    ]),
    T("anthro", "Антропологи", [T("humanevo", "Хүний хувьсал"), T("arch", "Археологи"), T("cult", "Соёлын антропологи")]),
    T("econ", "Эдийн засаг", [T("behav", "Зан үйлийн эдийн засаг")]),
    T("ling", "Хэл шинжлэл"),
  ]),
  T("hum", "Хүмүүнлэгийн ухаан", [
    T("phil", "Философи", [
      T("philsci", "Шинжлэх ухааны философи"), T("logic", "Логик ба логик алдаа"), T("ethics", "Ёс зүй", [T("bioethics", "Био ёс зүй")]),
      T("epist", "Танин мэдэхүйн онол"), T("mind", "Оюун ухааны философи"),
    ]),
    T("hist", "Шинжлэх ухааны түүх", [T("ancient", "Эртний шинжлэх ухаан"), T("revol", "Шинжлэх ухааны хувьсгал"), T("modern", "Орчин үеийн шинжлэх ухаан"), T("mongol", "Монголын шинжлэх ухааны түүх")]),
  ]),
  T("form", "Формал ухаан", [
    T("math", "Математик", [T("number", "Тооны онол"), T("geom", "Геометр"), T("algebra", "Алгебр"), T("calc", "Анализ"), T("prob", "Магадлал")]),
    T("stat", "Статистик"),
    T("info", "Мэдээллийн онол"),
    T("mlogic", "Математик логик"),
  ]),
]);

// Зам бүрийг тэмдэглэнэ: path, depth, parent
export const NODES = new Map();
(function walk(n, path, depth, parent) {
  const node = { ...n, path, depth, parent };
  NODES.set(path, node);
  node.children = n.kids.map((k) => walk(k, path ? `${path}/${k.key}` : k.key, depth + 1, path));
  return node;
})(TREE, "", 0, null);

export const nodeOf = (path) => NODES.get(String(path || "").replace(/^\/+|\/+$/g, "")) || null;
export const ROOTS = TREE.kids.map((k) => k.key);

// Үндэснээс тухайн зам хүртэлх замын хэсгүүд (Шинжлэх ухааныг оруулахгүй)
export function crumbs(path) {
  const out = [];
  let n = nodeOf(path);
  while (n && n.path) {
    out.unshift(n);
    n = nodeOf(n.parent);
  }
  return out;
}

export const categoryName = (path) => nodeOf(path)?.name || null;
export const validCategory = (path) => !!(path && nodeOf(path) && nodeOf(path).depth >= 2);

// Нийтлэлийн тооллогыг (зам → тоо) эцэг салбарууд руу нэмж өгнө
export function rollup(rows) {
  const out = {};
  for (const r of rows) {
    let p = r.category;
    if (!NODES.has(p)) continue;
    while (p !== null && p !== undefined) {
      out[p] = (out[p] || 0) + r.n;
      p = NODES.get(p).parent;
    }
  }
  return out;
}

// Клиент рүү дамжуулах энгийн мод (тоотой)
export function plainTree(counts = {}, node = NODES.get("")) {
  return { path: node.path, name: node.name, n: counts[node.path] || 0, kids: node.children.map((c) => plainTree(counts, c)) };
}

// Тухайн салбар болон түүний бүх дэд салбарын замууд
export function descendants(path) {
  const n = nodeOf(path);
  if (!n) return [];
  const out = [];
  (function go(x) { out.push(x.path); x.children.forEach(go); })(n);
  return out;
}
