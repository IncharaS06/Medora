"use client";

import { useEffect, useState } from "react";

export default function StatCard({
    title,
    value,
    sub,
    icon,
    trend,
    trendValue,
}: {
    title: string;
    value: string;
    sub?: string;
    icon?: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
}) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const trendColors = {
        up: 'text-green-600 bg-green-50',
        down: 'text-red-600 bg-red-50',
        neutral: 'text-gray-600 bg-gray-50'
    };

    return (
        <div className={`
            rounded-2xl bg-white p-5
            border border-[#C8C3FF]/30
            shadow-sm hover:shadow-md
            transition-all duration-300 ease-out
            ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
            hover:border-[#7C6EE6]/30 hover:scale-[1.02]
            group
        `}>
            {/* Top section with title and optional icon */}
            <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-[#6F6A8A] uppercase tracking-wide">
                    {title}
                </p>
                {icon && (
                    <div className="text-[#7C6EE6]/60 group-hover:text-[#7C6EE6] transition-colors duration-300">
                        {icon}
                    </div>
                )}
            </div>

            {/* Main value */}
            <div className="mt-3 flex items-baseline gap-2">
                <p className="text-3xl font-bold bg-gradient-to-r from-[#2E2E3A] to-[#7C6EE6] bg-clip-text text-transparent">
                    {value}
                </p>

                {/* Trend indicator */}
                {trend && trendValue && (
                    <span className={`
                        text-xs px-2 py-0.5 rounded-full font-medium
                        ${trendColors[trend]}
                    `}>
                        {trend === 'up' && '↑'}
                        {trend === 'down' && '↓'}
                        {trend === 'neutral' && '→'}
                        {' '}{trendValue}
                    </span>
                )}
            </div>

            {/* Sub text and additional info */}
            {sub && (
                <div className="mt-2 flex items-center gap-2">
                    <p className="text-xs text-[#6F6A8A]/70">
                        {sub}
                    </p>

                    {/* Decorative element */}
                    <div className="w-1 h-1 rounded-full bg-[#C8C3FF] animate-pulse" />
                </div>
            )}

            {/* Minimal progress indicator (optional) */}
            <div className="mt-4 h-1 bg-[#C8C3FF]/20 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-gradient-to-r from-[#7C6EE6] to-[#FFB7C5] rounded-full animate-shimmer-slow" />
            </div>
        </div>
    );
}