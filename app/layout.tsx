import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서울 고혈압 치료 연계",
  description: "서울시민 고혈압 치료율 표준화율 캠페인",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="relative min-h-full flex flex-col font-sans tracking-tight">
        {children}
      </body>
    </html>
  );
}
