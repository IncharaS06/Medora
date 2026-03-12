"use client";

import "./globals.css";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GlobalLoader from "@/components/GlobalLoader";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  const isAuthPage = pathname?.startsWith("/auth");

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setTimeout(() => setIsVisible(true), 100);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading) {
      setIsVisible(false);
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [pathname, loading]);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration.scope);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="theme-color" content="#7C6EE6" />
        <meta name="color-scheme" content="light" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MEDORA" />
      </head>

      <body className="flex flex-col min-h-screen bg-gradient-to-br from-[#F8F7FF] via-white to-[#F1EEFF] antialiased">
        {loading && <GlobalLoader />}

        <div
          className={`
            flex flex-col min-h-screen w-full
            transition-all duration-500 ease-out
            ${!loading && isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            ${loading ? "invisible" : "visible"}
          `}
        >
          {!isAuthPage && <Header />}

          <main className={`flex-grow w-full ${!isAuthPage ? "pt-4 sm:pt-6" : ""}`}>
            {children}
          </main>

          {!isAuthPage && <Footer />}
        </div>

        {isAuthPage && (
          <div className="fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#7C6EE6]/5 rounded-full blur-3xl animate-float-slow" />
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#FFB7C5]/5 rounded-full blur-3xl animate-float-slower" />
          </div>
        )}
      </body>
    </html>
  );
}
