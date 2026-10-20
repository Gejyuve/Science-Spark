// Тусламж хуудсаар редакцад хандах төрлүүд. logic_reports-д type болж хадгалагдана (post_id-гүй).
export const HELP_TOPICS = [
  ["general", "Гомдол", "Хэрэглэгч, клуб, шийдвэр эсвэл үйлчилгээний талаар"],
  ["bug", "Сайтын алдаа", "Ажиллахгүй байгаа товч, хуудас, буруу харагдаж буй зүйл"],
  ["idea", "Санал хүсэлт", "Сайтыг сайжруулах санаа, шинэ боломж"],
];
export const HELP_LABEL = Object.fromEntries(HELP_TOPICS.map(([k, l]) => [k, l]));
export const HELP_TYPES = HELP_TOPICS.map(([k]) => k);
export const HELP_OPEN_MAX = 3; // нэг хүний нэг зэрэг хянагдаж буй хүсэлт
