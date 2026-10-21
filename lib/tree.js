// Шинжлэх ухааны мод: нийтлэл, мэдээний ангилал.
// Байршил, нэршил нь gejyuve.com/sc-category дахь архивын ангиллыг дагана. Англи нэр нь тайлбар.
// Түлхүүр нь зам болно: "nat/phys/nuc" гэх мэт. Редакц баталсан шинэ ангиллууд өгөгдлийн сангаас нэмэгдэнэ (syncTree).
const T = (key, name, en, kids = []) => ({ key, name, en, kids });

export const TREE = T("", "Шинжлэх ухаан", "Science", [
  T("nat", "Байгалийн шинжлэх ухаан", "Natural sciences", [
    T("phys", "Физик", "Physics", [
      T("cond", "Нягт бодисын физик", "Condensed matter physics"),
      T("theor", "Онолын физик", "Theoretical physics"),
      T("statics", "Статик", "Statics"),
      T("psychophys", "Психофизик", "Psychophysics"),
      T("polymer", "Полимерийн физик", "Polymer physics"),
      T("plasma", "Плазмийн физик", "Plasma physics"),
      T("particle", "Эгэл бөөмийн физик", "Particle physics"),
      T("nuc", "Цөмийн физик", "Nuclear physics"),
      T("metro", "Метрологи", "Metrology"),
      T("mech", "Механик", "Mechanics"),
      T("mathphys", "Математик физик", "Mathematical physics"),
      T("materials", "Материал судлал", "Materials science"),
      T("quant", "Квант физик", "Quantum physics"),
      T("cryo", "Криогеник", "Cryogenics"),
      T("classic", "Классик физик", "Classical physics"),
      T("chemphys", "Химийн физик", "Chemical physics"),
      T("solid", "Хатуу төлвийн физик", "Solid-state physics"),
      T("homeo", "Хомеокинетик", "Homeokinetics"),
      T("accel", "Хурдасгуурын физик", "Accelerator physics"),
      T("comp", "Тооцооллын физик", "Computational physics"),
      T("rel", "Харьцангуйн онол", "Theory of relativity"),
      T("hist", "Физикийн түүх", "History of physics"),
      T("em", "Цахилгаан соронзон", "Electromagnetism"),
      T("econo", "Эконофизик", "Econophysics"),
      T("astro", "Одон орон", "Astronomy"),
      T("vehicle", "Тээврийн хэрэгслийн динамик", "Vehicle dynamics"),
      T("optics", "Оптик физик", "Optical physics"),
      T("molec", "Молекул физик", "Molecular physics"),
      T("atomic", "Атомын физик", "Atomic physics"),
      T("acou", "Акустик", "Acoustics"),
      T("agro", "Агрофизик", "Agrophysics"),
    ]),
    T("bio", "Биологи", "Biology", [
      T("zoo", "Амьтан зүй", "Zoology"),
      T("sysbio", "Систем биологи", "Systems biology"),
      T("neuro", "Мэдрэл судлал", "Neuroscience"),
      T("parasit", "Шимэгч зүй", "Parasitology"),
      T("osteo", "Остеологи", "Osteology"),
      T("molgen", "Молекул биологи ба Генетик", "Molecular biology & genetics"),
      T("micro", "Микробиологи", "Microbiology"),
      T("myco", "Микологи", "Mycology"),
      T("theo", "Математик ба Онолын биологи", "Mathematical & theoretical biology"),
      T("chrono", "Кронобиологи", "Chronobiology"),
      T("cryo", "Криобиологи", "Cryobiology"),
      T("hydro", "Гидробиологи", "Hydrobiology"),
      T("dev", "Хөгжлийн биологи", "Developmental biology"),
      T("photo", "Фотобиологи", "Photobiology"),
      T("physio", "Физиологи", "Physiology"),
      T("evo", "Хувьслын биологи", "Evolutionary biology"),
      T("eco", "Экологи", "Ecology"),
      T("marine", "Далайн биологи", "Marine biology"),
      T("bot", "Ургамал зүй", "Botany"),
      T("biotech", "Биотехнологи", "Biotechnology"),
      T("biochem", "Биохими", "Biochemistry"),
      T("biophys", "Биофизик", "Biophysics"),
      T("bioinfo", "Биоинформатик", "Bioinformatics"),
      T("biogeo", "Био газар зүй", "Biogeography"),
      T("astrobio", "Астробиологи", "Astrobiology", [
        T("alien", "Харийн амьдрал", "Extraterrestrial life"),
        T("astrogeo", "Астрогеологи", "Astrogeology"),
        T("astroeco", "Астроэкологи", "Astroecology"),
        T("abio", "Абиогенез", "Abiogenesis"),
      ]),
    ]),
    T("earth", "Дэлхий судлал", "Earth sciences", [
      T("atmo", "Агаар мандал судлал", "Atmospheric sciences"),
      T("cryos", "Цэвдэг зүй", "Cryology"),
      T("geog", "Газар зүй", "Geography"),
      T("geoinfo", "Геоинформатик", "Geoinformatics"),
      T("geo", "Геологи", "Geology"),
      T("ocean", "Далай зүй", "Oceanography"),
      T("soil", "Хөрс судлал", "Soil science"),
      T("hist", "Дэлхий судлалын түүх", "History of Earth sciences"),
    ]),
    T("chem", "Хими", "Chemistry", [
      T("anal", "Аналитик хими", "Analytical chemistry"),
      T("physchem", "Физикийн хими", "Physical chemistry"),
      T("agro", "Агрохими", "Agrochemistry"),
      T("petro", "Петрохими", "Petrochemistry"),
      T("synth", "Синтетик хими", "Synthetic chemistry"),
      T("mechano", "Механохими", "Mechanochemistry"),
      T("radio", "Радиохими", "Radiochemistry"),
      T("molmech", "Молекул механик", "Molecular mechanics"),
      T("chembio", "Химийн биологи", "Chemical biology"),
      T("mathchem", "Математик хими", "Mathematical chemistry"),
      T("cheminfo", "Хемоинформатик", "Cheminformatics"),
      T("inorg", "Органик бус хими", "Inorganic chemistry"),
      T("org", "Органик хими", "Organic chemistry"),
      T("nucchem", "Цөмийн хими", "Nuclear chemistry"),
    ]),
  ]),
  T("soc", "Нийгмийн шинжлэх ухаан", "Social sciences", [
    T("anthro", "Антропологи", "Anthropology"),
    T("sexo", "Сексологи", "Sexology"),
    T("demo", "Хүн ам зүй", "Demography"),
    T("ling", "Хэл шинжлэл", "Linguistics"),
    T("edu", "Боловсролын ШУ", "Education"),
    T("econ", "Эдийн засгийн ШУ", "Economics"),
    T("indrel", "Аж үйлдвэрийн харилцаа", "Industrial relations"),
    T("devst", "Хөгжил судлал", "Development studies"),
    T("law", "Хууль", "Law"),
    T("biz", "Бизнес", "Business"),
    T("crim", "Гэмт хэрэг судлал", "Criminology"),
    T("cult", "Соёл судлал", "Cultural studies"),
    T("media", "Медиа судлал", "Media studies"),
    T("pol", "Улс төрийн ШУ", "Political science", [
      T("govform", "Засгийн хэлбэр", "Forms of government"),
      T("ideo", "Идеологи", "Ideology"),
      T("geopol", "Геополитик", "Geopolitics"),
      T("pubadm", "Нийтийн удирдлага", "Public administration"),
      T("elect", "Сонгуулийн ШУ", "Psephology"),
    ]),
    T("sociol", "Нийгэм судлал", "Sociology"),
    T("sustain", "Тогтвортой байдлын ШУ", "Sustainability science"),
    T("ir", "Олон улсын харилцаа", "International relations"),
  ]),
  T("hum", "Хүмүүнлэгийн шинжлэх ухаан", "Humanities", [
    T("relig", "Шашин", "Religion", [
      T("relst", "Шашны судалгаа", "Religious studies"),
      T("buddh", "Буддын номлол", "Buddhism"),
      T("hindu", "Хиндү номлол", "Hinduism"),
      T("christ", "Христийн номлол", "Christianity"),
      T("islam", "Исламын номлол", "Islam"),
      T("jud", "Еврейн номлол", "Judaism"),
    ]),
    T("hist", "Түүх", "History"),
    T("arts", "Урлаг", "Arts", [
      T("visual", "Дүрслэх урлаг", "Visual arts"),
      T("perform", "Тайзны урлаг", "Performing arts"),
    ]),
    T("comm", "Харилцаа холбоо", "Communication"),
    T("phil", "Философи", "Philosophy"),
    T("lit", "Утга зохиол", "Literature", [
      T("oral", "Аман зохиол", "Oral literature"),
      T("written", "Бичигдмэл зохиол", "Written literature", [
        T("children", "Хүүхдийн зохиол", "Children's literature"),
        T("erotic", "Эротик", "Erotic literature"),
        T("nonfic", "Баримтат зохиол", "Nonfiction"),
        T("fiction", "Уран зохиол", "Fiction"),
        T("poetry", "Яруу найраг", "Poetry"),
      ]),
    ]),
  ]),
  T("app", "Хэрэглээний шинжлэх ухаан", "Applied sciences", [
    T("forensic", "Шүүх шинжилгээ", "Forensic science"),
    T("agron", "Агрономи", "Agronomy", [
      T("agri", "Хөдөө аж ахуй", "Agriculture"),
      T("livestock", "Мал аж ахуй", "Animal husbandry"),
      T("forest", "Ойн аж ахуй", "Forestry"),
    ]),
    T("mil", "Цэргийн шинжлэх ухаан", "Military science"),
    T("env", "Хүрээлэн буй орчны ШУ", "Environmental science"),
    T("energy", "Эрчим хүчний технологи", "Energy technology"),
    T("comp", "Тооцооллын ШУ", "Computational science", [
      T("infosys", "Мэдээллийн систем", "Information systems"),
      T("it", "Мэдээллийн технологи", "Information technology"),
      T("cs", "Компьютерийн ШУ", "Computer science", [
        T("ds", "Өгөгдлийн ШУ", "Data science"),
        T("db", "Өгөгдлийн сан", "Databases"),
        T("ai", "Хиймэл оюун", "Artificial intelligence"),
        T("se", "Программ инженерчлэл", "Software engineering", [
          T("gyv", "Гэж Юу Вэ систем", "“Gej Yu Ve” system"),
        ]),
      ]),
      T("ce", "Компьютерийн инженерчлэл", "Computer engineering"),
    ]),
    T("eng", "Инженерчлэл", "Engineering"),
    T("health", "Эрүүл мэндийн ШУ", "Health sciences"),
  ]),
  T("form", "Формаль шинжлэх ухаан", "Formal sciences", [
    T("actuar", "Даатгалын ШУ", "Actuarial science"),
    T("info", "Мэдээллийн онол", "Information theory"),
    T("stat", "Статистик", "Statistics"),
    T("math", "Математик", "Mathematics", [
      T("algo", "Алгоритм", "Algorithms"),
      T("anal", "Математик анализ", "Mathematical analysis"),
      T("hist", "Математикийн түүх", "History of mathematics"),
      T("geom", "Геометр", "Geometry"),
      T("number", "Тооны онол", "Number theory"),
      T("prob", "Магадлалын онол", "Probability theory"),
      T("trig", "Тригнометр", "Trigonometry"),
      T("applied", "Хэрэглээний математик", "Applied mathematics"),
    ]),
    T("sys", "Системийн ШУ", "Systems science"),
  ]),
]);

// Зам бүрийг тэмдэглэнэ: path, depth, parent
export const NODES = new Map();
function attach(n, path, depth, parent) {
  const node = { key: n.key, name: n.name, en: n.en, path, depth, parent, extra: !!n.extra, children: [] };
  NODES.set(path, node);
  node.children = (n.kids || []).map((k) => attach(k, path ? `${path}/${k.key}` : k.key, depth + 1, path));
  return node;
}
attach(TREE, "", 0, null);

// Редакц баталсан нэмэлт ангиллуудыг (categories хүснэгт) модонд залгана. 60 сек кэштэй.
let syncedAt = 0;
export async function syncTree(sql) {
  if (Date.now() - syncedAt < 60000) return;
  syncedAt = Date.now();
  try {
    const rows = await sql`SELECT path, parent, name, en FROM categories ORDER BY id`;
    for (const r of rows) {
      if (NODES.has(r.path)) continue;
      const p = NODES.get(r.parent);
      if (!p) continue;
      const node = { key: r.path.split("/").pop(), name: r.name, en: r.en, path: r.path, depth: p.depth + 1, parent: p.path, extra: true, children: [] };
      NODES.set(r.path, node);
      p.children.push(node);
    }
  } catch (e) {}
}
export const resetTreeCache = () => { syncedAt = 0; };

export const nodeOf = (path) => NODES.get(String(path || "").replace(/^\/+|\/+$/g, "")) || null;

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
  return { path: node.path, name: node.name, en: node.en, n: counts[node.path] || 0, kids: node.children.map((c) => plainTree(counts, c)) };
}

// Тухайн салбар болон түүний бүх дэд салбарын замууд
export function descendants(path) {
  const n = nodeOf(path);
  if (!n) return [];
  const out = [];
  (function go(x) { out.push(x.path); x.children.forEach(go); })(n);
  return out;
}
