import { isPremium } from "@/lib/auth";
import { PREMIUM_PLANS, DONATION_MIN, DONATION_MAX, POOL_SHARE, bankInfo } from "@/lib/money";
import { PREMIUM_SPARK_WEIGHT, PREMIUM_DAILY_BONUS } from "@/lib/levels";

// «Дэмжигч болох», «Хандив өгөх» цонхны нийтлэг өгөгдөл (шагналын сан, хэтэвч, нийтлэл)
export function supportModalProps(user) {
  return {
    loggedIn: !!user, premium: !!user && isPremium(user), plans: PREMIUM_PLANS, bank: bankInfo(), min: DONATION_MIN, max: DONATION_MAX, poolShare: POOL_SHARE,
    perks: [["🚫", "Сурталчилгаагүй"], ["🎬", "Видео контент"], ["✦", `Таны оч ×${PREMIUM_SPARK_WEIGHT}`], ["🔥", `Өдөрт +${PREMIUM_DAILY_BONUS} оч`], ["💬", "Илүү их хуваалцах"], ["⚡", "Дэмжигч тэмдэг"], ["💚", "Бичээчдэд урам"]],
  };
}
