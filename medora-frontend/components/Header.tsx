"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function Header() {
    const [isScrolled, setIsScrolled] = useState(false);
    const pathname = usePathname();

    // 🚫 REMOVE OR COMMENT OUT THIS BLOCK
    // Don't show header on auth pages
    // if (pathname?.startsWith('/auth')) {
    //     return null;
    // }

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className={`
            w-full sticky top-0 z-50 transition-all duration-300
            ${isScrolled
                ? 'bg-white/90 backdrop-blur-md shadow-md border-b border-[#C8C3FF]/30'
                : 'bg-white border-b border-[#C8C3FF]/20'
            }
        `}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-center h-16 md:justify-start">

                    {/* Logo Section - Preserved exactly as you had it */}
                    <Link href="/" className="flex items-center gap-2 group">
                        {/* Logo with hover effect */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-[#7C6EE6]/20 rounded-full blur-md group-hover:bg-[#7C6EE6]/30 transition-all duration-300" />
                            <img
                                src="/logo.png"
                                alt="MEDORA"
                                className="relative w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-110"
                            />
                        </div>

                        {/* Brand name with gradient */}
                        <div className="flex flex-col">
                            <span className="text-lg font-semibold bg-gradient-to-r from-[#7C6EE6] to-[#6B5DDA] bg-clip-text text-transparent leading-tight">
                                MEDORA
                            </span>
                            <span className="text-[8px] text-[#6F6A8A]/60 -mt-1 hidden xs:block">
                                Radiology Assistant
                            </span>
                        </div>
                    </Link>
                </div>
            </div>
        </header>
    );
}