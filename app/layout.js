import "./globals.css";

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
    <html lang="mn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
