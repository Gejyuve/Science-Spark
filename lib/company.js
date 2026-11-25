// Платформыг эзэмшигч (мерчантын гэрээний тал) компанийн албан ёсны мэдээлэл.
// Супер админ Админ > Тохиргоо > «Компанийн мэдээлэл» хэсэгт бөглөнө (settings.company). Кодонд зохиомол утга бичихгүй.
// [түлхүүр, шошго, гэрээнд заавал эсэх]
export const COMPANY_FIELDS = [
  ["legalName", "Компанийн албан ёсны нэр", true],
  ["registerNo", "Регистрийн дугаар", true],
  ["stateRegNo", "Улсын бүртгэлийн дугаар", false],
  ["address", "Албан ёсны хаяг", true],
  ["phone", "Утас", true],
  ["email", "И-мэйл", true],
  ["repName", "Эрх бүхий төлөөлөгчийн овог, нэр", true],
  ["repPosition", "Төлөөлөгчийн албан тушаал", true],
  ["accName", "Нягтлан бодогчийн овог, нэр", false],
  ["bankName", "Банк (мерчантад төлбөр шилжүүлэх)", false],
  ["bankAccount", "Дансны дугаар", false],
  ["bankHolder", "Данс эзэмшигч", false],
];

export const companyMissing = (c = {}) => COMPANY_FIELDS.filter(([k, , req]) => req && !String(c[k] || "").trim()).map(([, l]) => l);
export const companyReady = (c) => companyMissing(c).length === 0;
