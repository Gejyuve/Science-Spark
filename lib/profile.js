// Профайл (Figma: Шинэ хэрэглэгч / Өөрт харагдах профайл)

// Хувь хүний овог, нэр: зөвхөн кирилл үсэг (латин хориотой). Байгууллага, клубт хамаарахгүй.
const CYRILLIC_NAME = /^[А-ЯЁӨҮа-яёөү]+(?:-[А-ЯЁӨҮа-яёөү]+)?$/;

export function checkName(value, accountType = "person") {
  const v = String(value || "").trim();
  if (!v) return "хоосон";
  if (v.length > 20) return "20 тэмдэгтээс урт";
  if (accountType === "person" && !CYRILLIC_NAME.test(v)) return "зөвхөн кирилл үсгээр бичнэ (латин үсэг хориглоно)";
  return null;
}

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Хувь хүний овог, нэр: эхний үсэг том, бусад нь жижиг («ДОРЖПАЛАМ» → «Доржпалам»).
// Зураастай нэрийн хэсэг бүр томоор эхэлнэ («бат-эрдэнэ» → «Бат-Эрдэнэ»).
// Байгууллага, клубийн нэрийг (товчлол гэх мэт) хэвээр нь үлдээнэ.
export const nameCase = (s, accountType = "person") =>
  accountType === "person" ? String(s || "").toLowerCase().split("-").map(capitalize).join("-") : capitalize(s);


// Талбар бүр бөглөгдөхөд нэг удаа оч олгоно (нийт 140, үүнээс зураг 20 нь тун удахгүй)
export const POINTS = {
  cover: 10, photo: 10,
  gender: 5, birth_date: 5, about: 10,
  birth_country: 5, birth_city: 5, live_country: 5, live_city: 5,
  education: 10, school: 10, orcid: 10, profession: 10, job: 10,
  socials: 10,
  origin_view: 5, religion: 5, belief: 5, politics: 5,
};
export const POINTS_TOTAL = Object.values(POINTS).reduce((a, b) => a + b, 0);

// Боловсрол: түвшин бүрийг «сурч байгаа», «төгссөн» гэж ялгана
const EDU_LEVELS = ["Ерөнхий боловсрол", "Мэргэжлийн сургалт", "Бакалавр", "Магистр", "Доктор (PhD)"];

// «Миний харах өнцөг»: Evrim Ağacı-ийн хувийн мэдээллийн сонголтоос санаа авав
export const OPTIONS = {
  gender: ["Эрэгтэй", "Эмэгтэй"],
  education: [...EDU_LEVELS.flatMap((l) => [`${l} · сурч байгаа`, `${l} · төгссөн`]), "Бусад"],
  origin_view: [
    "Хавтгай дэлхийч", "Геоцентрист (дэлхий төвт)", "Креационист (залуу дэлхий)", "Креационист (хөгшин дэлхий)",
    "Ухаалаг загварын дэмжигч", "Теист эволюционист", "Агностик эволюционист", "Материалист эволюционист",
    "Хэлэхийг хүсэхгүй",
  ],
  // Ричард Докинзын итгэл үнэмшлийн шатлал: бүрэн итгэгчээс бүрэн үгүйсгэгч хүртэл
  belief: [
    "Абсолют теист", "Де факто теист", "Теизм рүү хазайсан агностик", "Бүрэн агностик", "Шийдээгүй",
    "Атеизм рүү хазайсан агностик", "Де факто атеист", "Абсолют атеист",
    "Деист", "Пантеист", "Апатеист (сонирхдоггүй)", "Хэлэхийг хүсэхгүй",
  ],
  // Монголчуудад ойр буддын урсгалуудыг дэлгэрэнгүй, бусдыг товч оруулав
  religion: [
    "Шашин шүтдэггүй, атеизм (Atheism)", "Шашны үзэл байхгүй (Irreligion)", "Тэнгэр шүтлэг (Tengrism)", "Бөө мөргөл (Shamanism)",
    "Буддын шашин (Buddhism)", "Гэлүг · Шарын шашин (Gelug Buddhism)", "Нинмаа · Улааны шашин (Nyingma Buddhism)",
    "Гаржүд (Kagyu Buddhism)", "Сажаа (Sakya Buddhism)", "Жонан (Jonang Buddhism)", "Түвдийн буддизм (Tibetan Buddhism)",
    "Ваджраяна (Vajrayana Buddhism)", "Махаяна (Mahayana Buddhism)", "Тэравада (Theravada Buddhism)", "Хинаяна (Hinayana Buddhism)",
    "Зэн (Zen Buddhism)", "Цэвэр орны буддизм (Pure Land Buddhism)", "Нитирэн (Nichiren Buddhism)", "Сока Гаккай (Soka Gakkai)",
    "Бон шашин (Bon)", "Христийн шашин (Christianity)", "Католик (Catholicism)", "Ортодокс христ (Eastern Orthodoxy)",
    "Протестант (Protestantism)", "Евангелист (Evangelicalism)", "Баптист (Baptists)", "Адвентист (Adventism)",
    "Пентекостал (Pentecostalism)", "Лютеран (Lutheranism)", "Англикан (Anglicanism)", "Мормон (Mormonism)",
    "Еховагийн гэрчүүд (Jehovah's Witnesses)", "Ислам (Islam)", "Сунни ислам (Sunni Islam)", "Шиа ислам (Shia Islam)",
    "Суфизм (Sufism)", "Иудаизм (Judaism)", "Ортодокс иудаизм (Orthodox Judaism)", "Реформ иудаизм (Reform Judaism)",
    "Хинду шашин (Hinduism)", "Кришнагийн ухамсар (Hare Krishna)", "Тантра (Tantra)", "Сикх шашин (Sikhism)",
    "Жайн шашин (Jainism)", "Бахай шашин (Bahá'í Faith)", "Зороастр, галын шүтлэг (Zoroastrianism)", "Даоизм (Taoism)",
    "Күнзийн сургаал (Confucianism)", "Шинто (Shinto)", "Анимизм (Animism)", "Тотемизм (Totemism)", "Монизм (Monism)",
    "Гностицизм (Gnosticism)", "Манийн шашин (Manichaeism)", "Митраизм (Mithraism)", "Орфизм (Orphism)",
    "Пифагорын сургаал (Pythagoreanism)", "Паганизм (Paganism)", "Шинэ паганизм (Neopaganism)", "Викка (Wicca)",
    "Унитари (Unitarianism)", "Растафари (Rastafari)", "Сайентологи (Scientology)", "Урантиа (Urantia)",
    "Раэлизм (Raëlism)", "Каргогийн шүтлэг (Cargo cult)", "Жедиизм (Jediism)", "Вуду (Voodoo)", "Сатанизм (Satanism)",
    "Бусад", "Хэлэхийг хүсэхгүй",
  ],
  // Evrim Ağacı-ийн жагсаалтаас санаа авч, Пан-Монголизм нэмсэн; алс хамааралтай төрлүүдээс төлөөлөл үлдээсэн
  politics: [
    "Зүүний (Left)", "Төвөөс зүүн (Centre-left)", "Төвийн (Centre)", "Төвөөс баруун (Centre-right)", "Барууны (Right)", "Улс төрөөс ангид (Apolitical)", "Анархизм (Anarchism)", "Тодотголгүй анархизм (Anarchism without adjectives)",
    "Анархо-коммунизм (Anarcho-communism)", "Анархо-синдикализм (Anarcho-syndicalism)", "Анархо-капитализм (Anarcho-capitalism)", "Анархо-феминизм (Anarcha-feminism)", "Анархо-пацифизм (Anarcho-pacifism)",
    "Анархо-примитивизм (Anarcho-primitivism)", "Анархо-трансхуманизм (Anarcho-transhumanism)", "Хувь хүний анархизм (Individualist anarchism)", "Нийгмийн анархизм (Social anarchism)", "Коллектив анархизм (Collectivist anarchism)",
    "Эгоист анархизм (Egoist anarchism)", "Босогч анархизм (Insurrectionary anarchism)", "Синтезийн анархизм (Synthesis anarchism)", "Ногоон анархизм (Green anarchism)", "Буддист анархизм (Buddhist anarchism)", "Пост-анархизм (Post-anarchism)",
    "Пост-зүүний анархизм (Post-left anarchy)", "Пост-колоничлолын анархизм (Post-colonial anarchism)", "Квир анархизм (Queer anarchism)", "Хар анархизм (Black anarchism)", "Веган анархизм (Veganarchism)",
    "Христийн анархизм (Christian anarchism)", "Махновизм (Makhnovism)", "Зүүний зах зээлийн анархизм (Left-wing market anarchism)", "Мутуализм (Mutualism)", "Платформизм (Platformism)", "Коммунализм (Communalism)",
    "Ардчилсан конфедерализм (Democratic confederalism)", "Либертари хотын засаг (Libertarian municipalism)", "Хүртээмжтэй ардчилал (Inclusive democracy)", "Эрх мэдлийн эсрэг үзэл (Anti-authoritarianism)",
    "Центризм (Centrism)", "Радикал центризм (Radical centrism)", "Христийн ардчилал (Christian democracy)", "Консерватизм (Conservatism)", "Консерватив либерализм (Conservative liberalism)", "Либерал консерватизм (Liberal conservatism)",
    "Соёлын консерватизм (Cultural conservatism)", "Нийгмийн консерватизм (Social conservatism)", "Уламжлалт консерватизм (Traditionalist conservatism)", "Үндэсний консерватизм (National conservatism)", "Либертари консерватизм (Libertarian conservatism)",
    "Иргэний консерватизм (Civic conservatism)", "Энэрэнгүй консерватизм (Compassionate conservatism)", "Санхүүгийн консерватизм (Fiscal conservatism)", "Ногоон консерватизм (Green conservatism)", "Биоконсерватизм (Bioconservatism)",
    "Неоконсерватизм (Neoconservatism)", "Палеоконсерватизм (Paleoconservatism)", "Теоконсерватизм (Theoconservatism)", "Торизм (Toryism)", "Консерватив хувьсгалын хөдөлгөөн (Conservative Revolution)",
    "Прото-фашизм (Proto-fascism)", "Нео-реакционизм (Neo-reactionism, NRx)", "Реакционизм (Reactionism)", "Аграризм (Agrarianism)", "Коммунитаризм (Communitarianism)", "Федерализм (Federalism)", "Бүс нутгийн үзэл (Regionalism)",
    "Монархизм (Monarchism)", "Изоляционизм, тусгаарлах үзэл (Isolationism)", "Хөндлөнгөөс оролцохын эсрэг үзэл (Non-interventionism)", "Протекционизм (Protectionism)", "Барууны либертари (Right-libertarianism)",
    "Барууны популизм (Right-wing populism)", "Коммунизмын эсрэг үзэл (Anti-communism)", "Либерализмын эсрэг үзэл (Anti-liberalism)", "Социализмын эсрэг үзэл (Anti-socialism)", "Энвайронментализм, байгаль хамгаалах үзэл (Environmentalism)",
    "Гүн экологи (Deep ecology)", "Нийгмийн экологи (Social ecology)", "Тод ногоон энвайронментализм (Bright green environmentalism)", "Чөлөөт зах зээлийн энвайронментализм (Free-market environmentalism)",
    "Биобүс нутгийн үзэл (Bioregionalism)", "Эко-капитализм (Eco-capitalism)", "Эко-социализм (Eco-socialism)", "Эко-феминизм (Ecofeminism)", "Эко-үндсэрхэг үзэл (Eco-nationalism)", "Ногоон улс төр (Green politics)",
    "Ногоон зүүн (Green left)", "Ногоон либерализм (Green liberalism)", "Ногоон либертари (Green libertarianism)", "Эко-фашизм (Eco-fascism)", "Феминизм (Feminism)", "Либерал феминизм (Liberal feminism)",
    "Радикал феминизм (Radical feminism)", "Марксист феминизм (Marxist feminism)", "Социалист феминизм (Socialist feminism)", "Хувь хүний феминизм (Individualist feminism)", "Соёлын феминизм (Cultural feminism)",
    "Постмодерн феминизм (Postmodern feminism)", "Сэтгэлзүйн шинжилгээний феминизм (Psychoanalytic feminism)", "Феминист эдийн засаг (Feminist economics)", "Трансфеминизм (Transfeminism)", "Хар арьстны феминизм (Black feminism)",
    "Лесбиян феминизм (Lesbian feminism)", "Салан тусгаарлах феминизм (Separatist feminism)", "Атеист феминизм (Atheist feminism)", "Шашны феминизм (Religious feminism)", "Вуманизм (Womanism)", "Матриархат, эмэгтэй давамгайлал (Matriarchy)",
    "ЛГБТ нийгмийн хөдөлгөөн (LGBT social movements)", "Маскулинизм (Masculinism)", "Антифеминизм (Antifeminism)", "Либерализм (Liberalism)", "Сонгодог либерализм (Classical liberalism)", "Нийгмийн либерализм (Social liberalism)",
    "Эдийн засгийн либерализм (Economic liberalism)", "Соёлын либерализм (Cultural liberalism)", "Либерал ардчилал (Liberal democracy)", "Зах зээлийн либерализм (Market liberalism)", "Неолиберализм (Neoliberalism)",
    "Ордолиберализм (Ordoliberalism)", "Либерал социализм (Liberal socialism)", "Либерал үндсэрхэг үзэл (Liberal nationalism)", "Либерал прогрессивизм (Liberal progressivism)", "Прогрессивизм (Progressivism)",
    "Бүгд найрамдах үзэл (Republicanism)", "Индивидуализм (Individualism)", "Радикализм (Radicalism)", "Жоржизм (Georgism)", "Объективизм (Objectivism)", "Либертари үзэл (Libertarianism)", "Минархизм (Minarchism)",
    "Агоризм (Agorism)", "Волюнтаризм (Voluntaryism)", "Зүүний либертари (Left-libertarianism)", "Либертари социализм (Libertarian socialism)", "Иргэний либертари (Civil libertarianism)", "Жео-либертари (Geolibertarianism)",
    "Либертари патернализм (Libertarian paternalism)", "Автарки (Autarky)", "Якобинизм (Jacobinism)", "Фьюжнизм (Fusionism)", "Панархизм (Panarchism)", "Үндсэрхэг үзэл (Nationalism)", "Пан-Монголизм (Pan-Mongolism)",
    "Эх оронч үзэл (Patriotism)", "Иргэний үндсэрхэг үзэл (Civic nationalism)", "Романтик үндсэрхэг үзэл (Romantic nationalism)", "Шашны үндсэрхэг үзэл (Religious nationalism)", "Буддист үндсэрхэг үзэл (Buddhist nationalism)",
    "Диаспорын үндсэрхэг үзэл (Diaspora nationalism)", "Шинэ үндсэрхэг үзэл (Neo-nationalism)", "Зүүний үндсэрхэг үзэл (Left-wing nationalism)", "Социалист үндсэрхэг үзэл (Socialist nationalism)",
    "Тэлэлтийн үндсэрхэг үзэл (Expansionist nationalism)", "Ирредентизм (Irredentism)", "Ультранационализм (Ultranationalism)", "Пан-Азизм (Pan-Asianism)", "Пан-Түркизм (Pan-Turkism)", "Пан-Славизм (Pan-Slavism)",
    "Пан-Арабизм (Pan-Arabism)", "Хятадын үндсэрхэг үзэл (Chinese nationalism)", "Цагаан арьстны үндсэрхэг үзэл (White nationalism)", "Хар арьстны үндсэрхэг үзэл (Black nationalism)",
    "Кемализм (Kemalism)", "Голлизм (Gaullism)", "Перонизм (Peronism)", "Насеризм (Nasserism)", "Евроскептицизм (Euroscepticism)", "Продюсеризм (Producerism)", "Шинэ баруун (New Right)", "Идентитаризм (Identitarianism)",
    "Корпоратизм (Corporatism)", "Фашизм (Fascism)", "Нео-фашизм (Neo-fascism)", "Нацизм (Nazism)", "Нео-нацизм (Neo-Nazism)", "Италийн фашизм (Italian fascism)", "Фалангизм (Falangism)", "Штрассеризм (Strasserism)",
    "Шашны фашизм (Clerical fascism)", "Үндэсний большевизм (National Bolshevism)", "Гуравдагч байр суурь (Third Position)", "Антифашизм (Anti-fascism)", "Буддист социализм (Buddhist socialism)", "Теократи (Theocracy)",
    "Шашны социализм (Religious socialism)", "Исламизм (Islamism)", "Исламын ардчилал (Islamic democracy)", "Сионизм (Zionism)", "Хиндутва (Hindutva)", "Чөлөөлөлтийн теологи (Liberation theology)", "Социализм (Socialism)",
    "Ардчилсан социализм (Democratic socialism)", "Социал демократ (Social democracy)", "Нордикийн нийгмийн ардчилал (Nordic model)", "Ёс зүйн социализм (Ethical socialism)", "Фабианизм (Fabianism)",
    "Зах зээлийн социализм (Market socialism)", "Хувьсгалт социализм (Revolutionary socialism)", "Шинжлэх ухааны социализм (Scientific socialism)", "Ногоон социализм (Green socialism)", "Хөдөө аж ахуйн социализм (Agrarian socialism)",
    "Шинэ зүүн (New Left)", "Хуучин зүүн (Old Left)", "Ревизионизм (Revisionism)", "Оролцооны ардчилал (Participatory democracy)", "Оролцооны эдийн засаг (Participatory economics)", "Зүүний популизм (Left-wing populism)",
    "Авторитар социализм (Authoritarian socialism)", "Нэг улсын социализм (Socialism in one country)", "Хятад онцлогтой социализм (Socialism with Chinese characteristics)", "Бернштейнизм (Bernsteinism)", "Австромарксизм (Austromarxism)",
    "Гильдийн социализм (Guild socialism)", "Гандигийн эдийн засгийн үзэл (Gandhian economics)", "Сталинизмын эсрэг зүүн (Anti-Stalinist left)", "Арабын социализм (Arab socialism)", "Африкийн социализм (African socialism)",
    "Боливаризм (Bolivarianism)", "Сапатизм (Zapatismo)", "Бланкизм (Blanquism)", "Фурьеизм (Fourierism)", "Капитализмын эсрэг үзэл (Anti-capitalism)", "Коммунизм (Communism)", "Сонгодог марксизм (Classical Marxism)",
    "Ортодокс марксизм (Orthodox Marxism)", "Нео-марксизм (Neo-Marxism)", "Пост-марксизм (Post-Marxism)", "Барууны марксизм (Western Marxism)", "Бүтцийн марксизм (Structural Marxism)", "Марксист хүмүүнлэг (Marxist humanism)",
    "Фрейдо-марксизм (Freudo-Marxism)", "Либертари марксизм (Libertarian Marxism)", "Автономизм (Autonomism)", "Зүүний коммунизм (Left communism)", "Зөвлөлийн коммунизм (Council communism)", "Люксембургизм (Luxemburgism)",
    "Ленинизм (Leninism)", "Большевизм (Bolshevism)", "Марксизм-ленинизм (Marxism–Leninism)", "Сталинизм (Stalinism)", "Нео-сталинизм (Neo-Stalinism)", "Троцкизм (Trotskyism)", "Хрущевизм (Khrushchevism)",
    "Маоизм (Maoism)", "Марксизм-ленинизм-маоизм (Marxism–Leninism–Maoism)", "Ревизионизмын эсрэг үзэл (Anti-revisionism)", "Чучхэ (Juche)", "Си Жиньпиний үзэл (Xi Jinping Thought)", "Хо Ши Мины үзэл (Ho Chi Minh Thought)",
    "Гевараизм (Guevarism)", "Кастроизм (Castroism)", "Фокизм (Foco theory)", "Титоизм (Titoism)", "Хожаизм (Hoxhaism)", "Прачандын зам (Prachanda Path)", "Каутскизм (Kautskyism)", "Де Леонизм (De Leonism)",
    "Операизм (Operaismo)", "Ситуационист интернационализм (Situationism)", "Еврокоммунизм (Eurocommunism)", "Үндэсний коммунизм (National communism)", "Шашны коммунизм (Religious communism)",
    "Анхдагч коммунизм (Primitive communism)", "Бусад", "Хэлэхийг хүсэхгүй",
  ],
};

// Монгол улс эхэнд, дараа нь монголчууд хамгийн олноор амьдардаг 30 улс
export const COUNTRIES = [
  "Монгол", "Өмнөд Солонгос", "Япон", "АНУ", "Хятад", "Орос", "Чех", "Герман", "Казахстан", "Австрали",
  "Их Британи", "Турк", "Швед", "Канад", "Франц", "Польш", "Австри", "Унгар", "Нидерланд", "Бельги",
  "Швейцарь", "Итали", "Испани", "Ирланд", "Израиль", "Арабын Нэгдсэн Эмират", "Шинэ Зеланд", "Сингапур",
  "Тайвань", "Малайз", "Норвеги", "Бусад",
];

export const MN_CITIES = [
  "Улаанбаатар", "Архангай", "Баян-Өлгий", "Баянхонгор", "Булган", "Говь-Алтай", "Говьсүмбэр", "Дархан-Уул",
  "Дорноговь", "Дорнод", "Дундговь", "Завхан", "Орхон", "Өвөрхангай", "Өмнөговь", "Сүхбаатар", "Сэлэнгэ",
  "Төв", "Увс", "Ховд", "Хөвсгөл", "Хэнтий",
];

export const SCHOOLS = [
  "Монгол Улсын Их Сургууль", "Шинжлэх Ухаан, Технологийн Их Сургууль", "Анагаахын Шинжлэх Ухааны Үндэсний Их Сургууль",
  "Монгол Улсын Боловсролын Их Сургууль", "Хөдөө Аж Ахуйн Их Сургууль", "Санхүү Эдийн Засгийн Их Сургууль",
  "Шинэ Монгол Технологийн Дээд Сургууль", "Монголын Үндэсний Их Сургууль",
];

export const SOCIALS = [
  { key: "facebook", icon: "fb" },
  { key: "instagram", icon: "ig" },
  { key: "x", icon: "xx" },
  { key: "linkedin", icon: "li" },
  { key: "youtube", icon: "yt" },
];

export const countWords = (s) => (String(s || "").trim() ? String(s).trim().split(/\s+/).length : 0);
