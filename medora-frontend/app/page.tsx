"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function SplashPage() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setIsVisible(true);

    // Navigate to auth after splash
    const timer = setTimeout(() => {
      router.push("/auth");
    }, 2800);

    return () => clearTimeout(timer);
  }, [router]);

  // Fixed particles - no random values to prevent hydration mismatch
  const particles = [
    { left: "10%", top: "20%", delay: "0s" },
    { left: "25%", top: "65%", delay: "0.3s" },
    { left: "70%", top: "15%", delay: "0.6s" },
    { left: "85%", top: "80%", delay: "0.9s" },
    { left: "40%", top: "40%", delay: "1.2s" },
    { left: "60%", top: "70%", delay: "1.5s" },
    { left: "15%", top: "85%", delay: "1.8s" },
    { left: "90%", top: "30%", delay: "2.1s" },
  ];

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#F8F7FF]">

      {/* Background gradient - Medora theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F8F7FF] via-white to-[#F1EEFF]" />

      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Soft gradient orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#7C6EE6]/5 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#FFB7C5]/5 rounded-full blur-3xl animate-float-slower" />

        {/* Subtle rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-[#C8C3FF]/20 rounded-full animate-spin-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-[#7C6EE6]/10 rounded-full animate-spin-slower" />

        {/* Fixed particles - same on server and client */}
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-[#7C6EE6]/20 rounded-full"
            style={{
              left: p.left,
              top: p.top,
              animation: `twinkle 3s ${p.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className={`
        relative z-10 flex flex-col items-center justify-center w-full max-w-md px-6 mx-auto
        transition-all duration-1000 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
      `}>

        {/* Logo Container - Medora styled */}
        <div className="relative mb-10 group">
          {/* Premium glow effect */}
          <div className="absolute inset-0 bg-[#7C6EE6]/20 rounded-full blur-3xl animate-pulse-gentle" />

          {/* Orbiting rings */}
          <div className="absolute inset-0 rounded-full border-2 border-[#C8C3FF]/40 animate-spin-slow"
            style={{ animationDuration: '8s' }} />
          <div className="absolute inset-4 rounded-full border border-[#FFB7C5]/30 animate-spin-slower"
            style={{ animationDuration: '12s' }} />

          {/* Main logo */}
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72">
            <Image
              src="/logo.png"
              alt="MEDORA"
              fill
              priority
              className="object-contain drop-shadow-xl"
              sizes="(max-width: 640px) 224px, (max-width: 768px) 256px, 288px"
            />
          </div>
        </div>

        {/* Brand Text */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-[#2E2E3A] tracking-tight">
            MEDORA
          </h1>

          <p className="text-base sm:text-lg text-[#6F6A8A] max-w-xs mx-auto font-light leading-relaxed">
            Medical Diagnostic Radiology Assistant
          </p>

          {/* Subtle brand element */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="w-8 h-px bg-gradient-to-r from-transparent via-[#7C6EE6]/30 to-transparent" />
            <span className="text-xs text-[#7C6EE6]/40 uppercase tracking-[0.3em] font-light">Care • Precision • Trust</span>
            <span className="w-8 h-px bg-gradient-to-r from-transparent via-[#7C6EE6]/30 to-transparent" />
          </div>
        </div>
      </div>

      {/* Bottom indicator - subtle */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center">
        <div className="flex flex-col items-center gap-3">
          {/* Gentle pulse dot */}
          <div className="relative">
            <div className="w-1.5 h-1.5 rounded-full bg-[#7C6EE6]/40" />
            <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-[#7C6EE6]/20 animate-ping" />
          </div>
          <p className="text-xs text-[#7C6EE6]/30 font-light tracking-wider">
            LOADING
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -20px); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-30px, 30px); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-slower {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-gentle {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        .animate-float-slow {
          animation: float-slow 15s ease-in-out infinite;
        }
        .animate-float-slower {
          animation: float-slower 20s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        .animate-spin-slower {
          animation: spin-slower 25s linear infinite;
        }
        .animate-pulse-gentle {
          animation: pulse-gentle 3s ease-in-out infinite;
        }
        .animate-ping {
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </main>
  );
}