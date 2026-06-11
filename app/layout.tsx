import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Smartify",
  description:
    "Smartify is a digital platform in Indonesia that helps users generate quizzes quickly and efficiently. It enables students to practice and improve their understanding, while allowing educators to create assessments in a more practical and scalable way using intelligent technology.",
  icons: {
    icon: "/images/logo2.png",
    shortcut: "/images/logo2.png",
    apple: "/images/logo2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${poppins.variable} h-full antialiased bg-background`}
    >
      <body
        className={`${poppins.className} min-h-full flex flex-col font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
