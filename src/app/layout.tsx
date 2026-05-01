import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { AuthProvider } from '@/hooks/useSpaceAuth';

const inter = Inter({ 
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Lumina — Наше пространство",
  description: "Приватный цифровой дом для двоих",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="selection:bg-terra/20" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} font-sans bg-milk text-bark antialiased min-h-screen flex flex-col`}
      >
        {/* Обязательно возвращаем AuthProvider, чтобы Header не ломался */}
        <AuthProvider>
          <div className="flex-grow flex flex-col border-bark/10 border-x mx-auto w-full max-w-screen-2xl min-h-screen">
            
            <Header />

            <main className="flex-grow flex flex-col relative">
              {children}
            </main>

            <footer className="border-t border-bark/10 py-4 px-8 flex justify-between items-end">
              <div className="text-[9px] uppercase tracking-widest opacity-30">
                © 2024 — {new Date().getFullYear()} / Сделано с любовью
              </div>
              <div className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-terra/40" />
                <div className="w-1.5 h-1.5 bg-bark/20" />
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}