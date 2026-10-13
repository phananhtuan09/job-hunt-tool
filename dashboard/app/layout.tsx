import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Crawler VN — Personal Dashboard",
  description: "Track and organize Frontend and Fullstack job opportunities in Vietnam",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
