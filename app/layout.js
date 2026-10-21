import "./globals.css";
import { Inter } from "next/font/google";
import ValidityMn from "./components/ValidityMn";
import Ping from "./components/Ping";
import Celebrate from "./components/Celebrate";
import SelectMenu from "./components/SelectMenu";
import { siteUrl } from "@/lib/mail";
import NavLoader from "./components/NavLoader";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-inter" });

// Хуваалцах үеийн зураг: өөрийн зураггүй бүх хуудас /og-ийн брэнд зургийг авна (Facebook хуудаснаас санамсаргүй зураг сонгохоос сэргийлнэ)
export const metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Science Spark",
  description: "Шинжлэх ухааныг хамтдаа асаая",
  openGraph: {
    siteName: "Science Spark",
    title: "Science Spark",
    description: "Шинжлэх ухааныг хамтдаа асаая",
    type: "website",
    locale: "mn_MN",
    images: [{ url: "/og", width: 1200, height: 630, alt: "Science Spark" }],
  },
  twitter: { card: "summary_large_image", images: ["/og"] },
};

// Хуудас ачаалахад горимыг шууд тохируулна (анивчихгүй байлгахын тулд)
const themeScript = `
try {
  var t = localStorage.getItem("ss-theme");
  if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="mn" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ValidityMn />
        <Ping />
        <Celebrate />
        <SelectMenu />
        <Suspense fallback={null}><NavLoader /></Suspense>
        {children}
      </body>
    </html>
  );
}
