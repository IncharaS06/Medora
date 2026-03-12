"use client";

import { useEffect, useState } from "react";

export default function Footer() {
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        setYear(new Date().getFullYear());
    }, []);

    return (
        <footer className="w-full bg-white/80 backdrop-blur-sm border-t border-[#C8C3FF]/20 mt-auto py-5">
            <div className="max-w-6xl mx-auto px-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">

                    {/* Left side - Brand */}
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-[#7C6EE6] animate-pulse" />
                        <p className="text-xs text-[#6F6A8A]">
                            <span className="font-medium text-[#7C6EE6]">MEDORA</span>
                            <span className="mx-2 text-[#C8C3FF]">/</span>
                            <span>© {year}</span>
                        </p>
                    </div>

                    {/* Center - Description */}
                    <p className="text-[10px] sm:text-xs text-[#6F6A8A]/70 order-last sm:order-none">
                        AI Pediatric Fracture Detection
                    </p>

                    {/* Right side - Version */}
                    <p className="text-[10px] text-[#6F6A8A]/50 font-mono">
                        v2.4.0
                    </p>
                </div>
            </div>
        </footer>
    );
}