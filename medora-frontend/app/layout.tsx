"use client";

import "./globals.css";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GlobalLoader from "@/components/GlobalLoader";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  // Check if current page is auth page
  const isAuthPage = pathname?.startsWith('/auth');

  useEffect(() => {
    // Initial loader
    const timer = setTimeout(() => {
      setLoading(false);
      // Small delay before fade-in
      setTimeout(() => setIsVisible(true), 100);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Handle route changes - show loader on navigation
  useEffect(() => {
    if (!loading) {
      setIsVisible(false);
      // Small delay to trigger animation
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [pathname, loading]);

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Medora theme meta tags */}
        <meta name="theme-color" content="#7C6EE6" />
        <meta name="color-scheme" content="light" />
      </head>
      <body className="flex flex-col min-h-screen bg-gradient-to-br from-[#F8F7FF] via-white to-[#F1EEFF] antialiased">

        {/* Global Loader */}
        {loading && <GlobalLoader />}

        {/* Main Content with fade transition */}
        <div className={`
          flex flex-col min-h-screen w-full
          transition-all duration-500 ease-out
          ${!loading && isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
          ${loading ? 'invisible' : 'visible'}
        `}>
          {/* Header - FORCE SHOW ON ALL PAGES */}
          <Header />

          {/* Main content with proper spacing */}
          <main className="flex-grow w-full pt-4 sm:pt-6">
            {children}
          </main>

          {/* Footer - FORCE SHOW ON ALL PAGES */}
          <Footer />
        </div>

        {/* Background decoration for auth pages */}
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