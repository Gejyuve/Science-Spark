import ArchivePage from "../components/ArchivePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мэдээ · Science Spark" };

export default async function News({ searchParams }) {
  return <ArchivePage kind="Мэдээ" path="/news" title="Мэдээ" sub="Зөвхөн мэдээнүүд · хамгийн сүүлд нийтлэгдсэнээс эхэлнэ" sp={await searchParams} />;
}
