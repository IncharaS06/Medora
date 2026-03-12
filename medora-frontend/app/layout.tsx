"use client";

import "./globals.css";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GlobalLoader from "@/components/GlobalLoader";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

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
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Service Worker registered:", registration.scope);
          })
          .catch((error) => {
            console.error("Service Worker registration failed:", error);
          });
      });
    }
  }, []);

  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <title>MEDORA</title>
        <meta name="description" content="AI Pediatric Fracture Detection Platform" />

        <meta name="theme-color" content="#7C6EE6" />
        <meta name="color-scheme" content="light" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MEDORA" />

        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="MEDORA" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>

      <body className="flex min-h-screen flex-col bg-gradient-to-br from-[#F8F7FF] via-white to-[#F1EEFF] antialiased">
        {loading && <GlobalLoader />}

        <div
          className={`flex min-h-screen w-full flex-col transition-all duration-500 ease-out ${
            !loading && isVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          } ${loading ? "invisible" : "visible"}`}
        >
          {!isAuthPage && <Header />}

          <main className={`flex-grow w-full ${!isAuthPage ? "pt-4 sm:pt-6" : ""}`}>
            {children}
          </main>

          {!isAuthPage && <Footer />}
        </div>

        <PwaInstallPrompt />

        {isAuthPage && (
          <div className="fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-[#7C6EE6]/5 blur-3xl animate-float-slow" />
            <div className="absolute bottom-1/4 -right-20 h-96 w-96 rounded-full bg-[#FFB7C5]/5 blur-3xl animate-float-slower" />
          </div>
        )}
      </body>
    </html>
  );
}
