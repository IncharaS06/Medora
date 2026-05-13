"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const path = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const menu = [
        { name: "Dashboard", href: "/dashboard" },
        { name: "Upload Scan", href: "/upload" },
        { name: "Results", href: "/results" },
        { name: "Case History", href: "/history" },
        { name: "Settings", href: "/settings" },
    ];

    return (
        <div className="flex min-h-screen bg-[var(--background)]">
            {/* Desktop Sidebar */}
            <aside className="w-64 bg-white shadow-lg p-6 hidden md:block">
                <div className="flex items-center gap-3 mb-10">
                    <img src="/logo.png" alt="MEDORA Logo" className="w-10 h-10" />
                    <h1 className="text-lg font-bold text-[var(--primary-dark)]">
                        MEDORA
                    </h1>
                </div>

                <nav className="space-y-2">
                    {menu.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`block px-4 py-2 rounded-lg text-sm font-medium transition ${path === item.href
                                ? "bg-[var(--primary)] text-black"
                                : "hover:bg-pink-50 text-gray-700"
                                }`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Mobile Sidebar Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-xl p-6 transform transition-transform duration-300 md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="MEDORA Logo" className="w-10 h-10" />
                        <h1 className="text-lg font-bold text-[var(--primary-dark)]">
                            MEDORA
                        </h1>
                    </div>

                    <button
                        onClick={() => setMobileOpen(false)}
                        className="p-2 rounded-lg hover:bg-gray-100"
                    >
                        <X size={22} />
                    </button>
                </div>

                <nav className="space-y-2">
                    {menu.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`block px-4 py-3 rounded-lg text-sm font-medium transition ${path === item.href
                                ? "bg-[var(--primary)] text-black"
                                : "hover:bg-pink-50 text-gray-700"
                                }`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                {/* Mobile Header */}
                <header className="md:hidden bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="MEDORA Logo" className="w-9 h-9" />
                        <h1 className="text-base font-bold text-[var(--primary-dark)]">
                            MEDORA
                        </h1>
                    </div>

                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-2 rounded-lg hover:bg-gray-100"
                    >
                        <Menu size={24} />
                    </button>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 md:p-6">{children}</main>
            </div>
        </div>
    );
}
