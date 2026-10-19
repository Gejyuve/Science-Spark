// Клубийн даалгавар (хөтөч болон серверт хоёуланд нь)
export const TASK_KIND = "Даалгавар";
export const TASK_TYPES = ["Туршилт", "Эвент", "Воркшоп", "Төсөл", "Уралдаан", "Ажиглалт", "Бүтээл", "Анимэйшн"];
export const TYPE_MAX = 4; // нэг даалгаварт сонгох төрлийн дээд тоо
export const TYPE_LEN = 24; // шинэ төрлийн нэрийн урт
export const TASK_APPROVE_REWARD = 30; // редакц баталсан даалгаварт клубт нэг удаа

// Клубийн тайлан: даалгаврыг биелүүлсэн клуб бичнэ, редакц баталсны дараа нийтлэл шиг нийтлэгдэнэ
export const REPORT_KIND = "Тайлан";
export const CLUB_KINDS = [TASK_KIND, REPORT_KIND]; // «Клуб» ангилал
// Даалгаврын оч: редакц хүндрэлээс нь хамаарч баталгаажуулахдаа гараар оруулна
export const REWARD_MIN = 10;
export const REWARD_MAX = 500;
export const REWARD_DEFAULT = 50;
// Тайлан батлагдахад биелүүлсэн клуб даалгаврын очийг бүтнээр, даалгавар нэмсэн клуб түүний энэ хувийг авна
export const AUTHOR_SHARE = 20;
