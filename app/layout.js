import "./globals.css";
import { Inter } from "next/font/google";
import ValidityMn from "./components/ValidityMn";
import Ping from "./components/Ping";

const inter = Inter({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-inter" });

export const metadata = {
  title: "Science Spark",
  description: "Шинжлэх ухааныг хамтдаа асаая",
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
        {children}
      </body>
    </html>
  );
}
