import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meetly | 면접 일정 예약",
  description: "지원자가 직접 선택하는 편리한 면접 일정",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
