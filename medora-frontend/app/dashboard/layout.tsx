"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
    Menu,
    X,
    LayoutDashboard,
    UploadCloud,
    ActivitySquare,
    History,
    ScanSearch,
    FileText,
    FlaskConical,
    Settings,
} from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const [mobileOpen, setMobileOpen] = useState(false);

    const menu = [
        {
            name: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
        },
        {
            name: "Upload Scan",
            href: "/upload",
            icon: UploadCloud,
        },
        {
            name: "Results",
            href: "/results",
            icon: ActivitySquare,
        },
        {
            name: "Case History",
            href: "/history",
            icon: History,
        },
        {
            name: "Viewer",
            href: "/viewer",
            icon: ScanSearch,
        },
        {
            name: "Reports",
            href: "/report",
            icon: FileText,
        },
        {
            name: "Research Panel",
            href: "/research",
            icon: FlaskConical,
        },
        {
            name: "Settings",
            href: "/settings",
            icon: Settings,
        },
    ];

    return (
        <div className="min-h-screen bg-[var(--background)] flex">
            {/* DESKTOP SIDEBAR */}

            <aside className="hidden md:flex w-[280px] bg-white border-r border-[var(--border)] flex-col px-6 py-7 shadow-sm">
                {/* LOGO */}

                <div className="flex items-center gap-3 mb-10">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
                        <img
                            src="/logo.png"
                            alt="MEDORA"
                            className="w-8 h-8 object-contain"
                        />
                    </div>

                    <div>
                        <h1 className="text-xl font-bold text-[var(--primary-dark)]">
                            MEDORA
                        </h1>

                        <p className="text-xs text-[var(--text-soft)]">
                            AI Radiology Assistant
                        </p>
                    </div>
                </div>

                {/* NAVIGATION */}

                <nav className="space-y-2">
                    {menu.map((item) => {
                        const Icon = item.icon;

                        const active = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200 ${active
                                        ? "bg-[var(--primary-dark)] text-white shadow-md"
                                        : "text-gray-700 hover:bg-[var(--card)]"
                                    }`}
                            >
                                <Icon
                                    size={20}
                                    className={`${active
                                            ? "text-white"
                                            : "text-[var(--primary-dark)]"
                                        }`}
                                />

                                <span className="text-sm font-semibold">
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* FOOTER */}

                <div className="mt-auto pt-8">
                    <div className="rounded-3xl bg-[var(--card)] border border-[var(--border)] p-5">
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                            MEDORA AI
                        </h3>

                        <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">
                            Pediatric wrist fracture detection powered by
                            EfficientNet-B3 and YOLOv8.
                        </p>
                    </div>
                </div>
            </aside>

            {/* MOBILE OVERLAY */}

            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* MOBILE SIDEBAR */}

            <aside
                className={`fixed top-0 left-0 z-50 h-full w-[290px] bg-white shadow-2xl p-6 transform transition-transform duration-300 md:hidden ${mobileOpen
                        ? "translate-x-0"
                        : "-translate-x-full"
                    }`}
            >
                {/* HEADER */}

                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
                            <img
                                src="/logo.png"
                                alt="MEDORA"
                                className="w-7 h-7"
                            />
                        </div>

                        <div>
                            <h1 className="text-lg font-bold text-[var(--primary-dark)]">
                                MEDORA
                            </h1>

                            <p className="text-xs text-[var(--text-soft)]">
                                AI Assistant
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setMobileOpen(false)}
                        className="p-2 rounded-xl hover:bg-gray-100"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* MOBILE NAV */}

                <nav className="space-y-2">
                    {menu.map((item) => {
                        const Icon = item.icon;

                        const active = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200 ${active
                                        ? "bg-[var(--primary-dark)] text-white"
                                        : "text-gray-700 hover:bg-[var(--card)]"
                                    }`}
                            >
                                <Icon
                                    size={20}
                                    className={`${active
                                            ? "text-white"
                                            : "text-[var(--primary-dark)]"
                                        }`}
                                />

                                <span className="text-sm font-semibold">
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                {/* MOBILE FOOTER */}

                <div className="mt-8 rounded-3xl bg-[var(--card)] border border-[var(--border)] p-5">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        MEDORA AI
                    </h3>

                    <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">
                        AI-powered fracture analysis and localization system.
                    </p>
                </div>
            </aside>

            {/* MAIN AREA */}

            <div className="flex-1 flex flex-col min-h-screen">
                {/* MOBILE HEADER */}

                <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[var(--border)] px-4 py-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
                            <img
                                src="/logo.png"
                                alt="MEDORA"
                                className="w-6 h-6"
                            />
                        </div>

                        <div>
                            <h1 className="text-base font-bold text-[var(--primary-dark)]">
                                MEDORA
                            </h1>

                            <p className="text-[10px] text-[var(--text-soft)]">
                                AI Fracture Detection
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-2 rounded-xl hover:bg-gray-100"
                    >
                        <Menu size={24} />
                    </button>
                </header>

                {/* PAGE CONTENT */}

                <main className="flex-1 p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
