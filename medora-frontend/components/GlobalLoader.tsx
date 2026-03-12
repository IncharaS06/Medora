"use client";

import { useState, useEffect } from "react";

export default function GlobalLoader() {

    const [messageIndex, setMessageIndex] = useState(0);

    const loadingMessages = [
        "Initializing MEDORA...",
        "Calibrating precision...",
        "Analyzing radiology data...",
        "Loading diagnostic tools...",
        "Preparing your dashboard...",
        "Connecting to secure network...",
        "Almost there...",
        "Ready to assist...",
    ];

    useEffect(() => {

        const messageInterval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
        }, 2200);

        return () => clearInterval(messageInterval);

    }, []);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F8F7FF] overflow-hidden">

            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">

                <div className="absolute inset-0 bg-gradient-to-br from-[#F8F7FF] via-white to-[#F1EEFF]" />

                <div className="absolute top-20 left-10 w-64 h-64 bg-[#7C6EE6]/5 rounded-full blur-3xl animate-float-slow" />
                <div className="absolute bottom-20 right-10 w-80 h-80 bg-[#FFB7C5]/5 rounded-full blur-3xl animate-float-slower" />
                <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-[#C8C3FF]/10 rounded-full blur-3xl animate-pulse-slow" />

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-[#7C6EE6]/10 rounded-full animate-spin-slow" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-[#FFB7C5]/10 rounded-full animate-spin-slower" />

            </div>

            {/* Loader Content */}
            <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-sm px-6">

                {/* Logo */}
                <div className="relative mb-8">

                    <div className="absolute inset-0 bg-[#7C6EE6]/20 rounded-full blur-3xl animate-pulse-gentle" />

                    <div
                        className="absolute -inset-3 rounded-full border-2 border-[#C8C3FF]/40 animate-spin-slow border-t-[#7C6EE6] border-l-transparent"
                        style={{ animationDuration: "4s" }}
                    />

                    <div
                        className="absolute -inset-6 rounded-full border border-[#FFB7C5]/30 animate-spin-slower border-b-[#7C6EE6] border-r-transparent"
                        style={{ animationDuration: "6s" }}
                    />

                    <div className="relative w-32 h-32 animate-float-subtle">
                        <img
                            src="/loader.gif"
                            alt="MEDORA Loader"
                            className="w-full h-full object-contain drop-shadow-2xl"
                        />
                    </div>

                </div>

                {/* Message */}
                <p className="text-lg sm:text-xl text-[#2E2E3A] font-light tracking-wide animate-fade-in-up text-center">
                    {loadingMessages[messageIndex]}
                </p>

            </div>

            {/* Bottom motif */}
            <div className="absolute bottom-8 flex flex-col items-center gap-3">

                <div className="relative w-40 h-8 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 120 20">
                        <path
                            d="M0,10 L20,10 L30,2 L40,18 L50,2 L60,18 L70,10 L120,10"
                            stroke="#7C6EE6"
                            strokeWidth="1.5"
                            fill="none"
                            strokeOpacity="0.3"
                            strokeDasharray="5,5"
                            className="animate-dash"
                        />
                    </svg>
                </div>

                <p className="text-[10px] text-[#7C6EE6]/20 font-mono tracking-wider">
                    MEDORA v2.4.0 • RADIOLOGY SUITE
                </p>

            </div>

            <style jsx>{`
                @keyframes dash {
                    to {
                        stroke-dashoffset: -20;
                    }
                }
                .animate-dash {
                    stroke-dashoffset: 0;
                    animation: dash 20s linear infinite;
                }

                @keyframes float-slow {
                    0%,100% { transform: translate(0,0); }
                    50% { transform: translate(15px,-15px); }
                }

                @keyframes float-slower {
                    0%,100% { transform: translate(0,0); }
                    50% { transform: translate(-20px,20px); }
                }

                @keyframes float-subtle {
                    0%,100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }

                .animate-float-slow {
                    animation: float-slow 12s ease-in-out infinite;
                }

                .animate-float-slower {
                    animation: float-slower 15s ease-in-out infinite;
                }

                .animate-float-subtle {
                    animation: float-subtle 3s ease-in-out infinite;
                }
            `}</style>

        </div>
    );
}