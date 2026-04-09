import "./globals.css";

export const metadata = {
  title: "풍농모슬포ERP",
  description: "비료 출고 · 검수 · 미수 · 기사정산"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
