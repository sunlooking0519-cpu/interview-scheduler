import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://interview-scheduler26.vercel.app"),
  applicationName: "Schedule",
  title: "Schedule | 면접 일정 예약",
  description: "면접 일정을 확인하고 예약해 주세요.",
  openGraph: {
    title: "Schedule | 면접 일정 예약",
    description: "면접 일정을 확인하고 예약해 주세요.",
    siteName: "Schedule",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/schedule-share.png", width: 1672, height: 941, alt: "면접 스케줄 링크 · 면접 일정을 확인하고 예약해 주세요." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Schedule | 면접 일정 예약",
    description: "면접 일정을 확인하고 예약해 주세요.",
    images: ["/schedule-share.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
