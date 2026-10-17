import ArchivePage from "../components/ArchivePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Нийтлэл · Science Spark" };

export default async function Articles({ searchParams }) {
  return <ArchivePage kind="Нийтлэл" path="/articles" title="Нийтлэл" sub="Зөвхөн нийтлэлүүд · хамгийн сүүлд нийтлэгдсэнээс эхэлнэ" sp={await searchParams} />;
}
