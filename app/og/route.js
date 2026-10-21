import { ogImage } from "@/lib/og";

// Сайтын ерөнхий хуваалцах зураг (өөрийн зураггүй бүх хуудас)
export async function GET() {
  return ogImage();
}
