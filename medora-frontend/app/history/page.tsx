"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
    collection,
    onSnapshot,
    orderBy,
    query,
    Timestamp,
    where,
} from "firebase/firestore";
import {
    Search,
    ArrowLeft,
    FileImage,
    AlertTriangle,
    CheckCircle2,
    CalendarDays,
    BarChart3,
    Filter,
    FolderOpen,
} from "lucide-react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
} from "recharts";

type BoxType =
    | {
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
    }
    | number[];

type CaseItem = {
    id: string;
    userId?: string;
    userEmail?: string;
    patientName?: string;
    prediction?: string;
    confidence?: number;
    createdAt?: Timestamp | string | null;
    originalImageBase64?: string;
    annotatedImageBase64?: string;
    gradCamBase64?: string;
    riskLevel?: string;
    modelName?: string;
    summary?: string;
    recommendation?: string;
    boxes?: BoxType[];
};

export default function HistoryPage() {
    const router = useRouter();

    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [cases, setCases] = useState<CaseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "fracture" | "normal">("all");

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            if (!user) {
                router.push("/auth");
                return;
            }
            setFirebaseUser(user);
        });

        return () => unsubAuth();
    }, [router]);

    useEffect(() => {
        if (!firebaseUser) return;

        setLoading(true);

        const q = query(
            collection(db, "cases"),
            where("userId", "==", firebaseUser.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const fetchedCases: CaseItem[] = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...(doc.data() as Omit<CaseItem, "id">),
                }));

                setCases(fetchedCases);
                setLoading(false);
                setError("");
            },
            (err) => {
                console.error("Failed to fetch cases:", err);
                setError(getReadableFirestoreError(err));
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [firebaseUser]);

    const formatDate = (value?: Timestamp | string | null) => {
        if (!value) return "—";

        if (typeof value === "string") {
            const date = new Date(value);
            if (isNaN(date.getTime())) return "—";
            return date.toLocaleDateString();
        }

        if (typeof value === "object" && value && "toDate" in value) {
            try {
                return value.toDate().toLocaleDateString();
            } catch {
                return "—";
            }
        }

        return "—";
    };

    const filteredCases = useMemo(() => {
        return cases.filter((c) => {
            const prediction = (c.prediction || "").toLowerCase();
            const patient = (c.patientName || "").toLowerCase();
            const id = c.id.toLowerCase();
            const q = search.toLowerCase().trim();

            const matchesSearch =
                !q || patient.includes(q) || id.includes(q) || prediction.includes(q);

            const matchesFilter =
                filter === "all" ? true : prediction === filter.toLowerCase();

            return matchesSearch && matchesFilter;
        });
    }, [cases, search, filter]);

    const stats = useMemo(() => {
        const total = filteredCases.length;
        const fractures = filteredCases.filter(
            (c) => (c.prediction || "").toLowerCase() === "fracture"
        ).length;
        const normal = filteredCases.filter(
            (c) => (c.prediction || "").toLowerCase() === "normal"
        ).length;
        const avgConfidence =
            total > 0
                ? (
                    filteredCases.reduce((sum, c) => sum + Number(c.confidence || 0), 0) /
                    total
                ) * 100
                : 0;

        return {
            total,
            fractures,
            normal,
            avgConfidence,
        };
    }, [filteredCases]);

    const distributionData = useMemo(
        () => [
            { name: "Fracture", value: stats.fractures, color: "#ef4444" },
            { name: "Normal", value: stats.normal, color: "#10b981" },
        ],
        [stats]
    );

    const confidenceChartData = useMemo(() => {
        return filteredCases.slice(0, 6).map((item, index) => ({
            name: `Case ${index + 1}`,
            confidence: Number(((item.confidence || 0) * 100).toFixed(1)),
        }));
    }, [filteredCases]);

    const handleViewCase = (item: CaseItem) => {
        router.push(`/report/${item.id}`);
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
                <div className="rounded-[28px] bg-white px-8 py-6 shadow-[var(--shadow-soft)]">
                    <p className="text-[var(--primary-dark)] font-semibold text-lg">
                        Loading case history...
                    </p>
                    <div className="mt-4 h-2 w-56 overflow-hidden rounded-full bg-[var(--secondary)]/40">
                        <div className="h-full rounded-full bg-[var(--primary)] animate-progress-loading" />
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
            <div className="max-w-7xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <img src="/logo.png" className="w-10 h-10" alt="MEDORA" />
                    <div className="min-w-0">
                        <h1 className="truncate text-lg sm:text-xl font-bold text-[var(--primary-dark)]">
                            MEDORA Case History
                        </h1>
                        <p className="text-sm text-[var(--text-soft)]">
                            Review your previous fracture analysis records
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => router.push("/dashboard")}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary-dark)] text-white font-medium"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Dashboard
                </button>
            </div>

            {error && (
                <div className="max-w-7xl mx-auto mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="max-w-7xl mx-auto mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" />
                    <input
                        type="text"
                        placeholder="Search by case ID, patient, or result..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-2xl border border-[var(--border)] bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-[var(--primary)]"
                    />
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-[var(--shadow-card)]">
                    <Filter className="h-4 w-4 text-[var(--primary-dark)] ml-2" />
                    <button
                        onClick={() => setFilter("all")}
                        className={`rounded-xl px-4 py-2 text-sm font-medium ${filter === "all"
                                ? "bg-[var(--primary-dark)] text-white"
                                : "text-[var(--foreground)]"
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter("fracture")}
                        className={`rounded-xl px-4 py-2 text-sm font-medium ${filter === "fracture"
                                ? "bg-red-500 text-white"
                                : "text-[var(--foreground)]"
                            }`}
                    >
                        Fracture
                    </button>
                    <button
                        onClick={() => setFilter("normal")}
                        className={`rounded-xl px-4 py-2 text-sm font-medium ${filter === "normal"
                                ? "bg-emerald-500 text-white"
                                : "text-[var(--foreground)]"
                            }`}
                    >
                        Normal
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
                <HistoryStatCard
                    title="Total Cases"
                    value={stats.total}
                    icon={<FolderOpen className="h-5 w-5" />}
                    color="bg-[var(--secondary)]/35 text-[var(--primary-dark)]"
                />
                <HistoryStatCard
                    title="Fractures"
                    value={stats.fractures}
                    icon={<AlertTriangle className="h-5 w-5" />}
                    color="bg-red-50 text-red-600"
                />
                <HistoryStatCard
                    title="Normal"
                    value={stats.normal}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    color="bg-emerald-50 text-emerald-600"
                />
                <HistoryStatCard
                    title="Avg Confidence"
                    value={`${stats.avgConfidence.toFixed(1)}%`}
                    icon={<BarChart3 className="h-5 w-5" />}
                    color="bg-blue-50 text-blue-600"
                />
            </div>

            {filteredCases.length > 0 && (
                <div className="max-w-7xl mx-auto mt-6 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] xl:col-span-2">
                        <div className="mb-4 flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-[var(--primary-dark)]" />
                            <h3 className="text-lg font-bold text-[var(--foreground)]">
                                Recent Case Confidence
                            </h3>
                        </div>

                        <div className="h-[260px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={confidenceChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip formatter={(value) => [`${value}%`, "Confidence"]} />
                                    <Bar
                                        dataKey="confidence"
                                        fill="#7c6ee6"
                                        radius={[8, 8, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)]">
                        <div className="mb-4 flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-[var(--primary-dark)]" />
                            <h3 className="text-lg font-bold text-[var(--foreground)]">
                                Result Distribution
                            </h3>
                        </div>

                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={4}
                                    >
                                        {distributionData.map((entry, index) => (
                                            <Cell key={index} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="mt-3 space-y-2">
                            {distributionData.map((item) => (
                                <div
                                    key={item.name}
                                    className="flex items-center justify-between rounded-xl bg-[var(--card)] px-3 py-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-sm font-medium">{item.name}</span>
                                    </div>
                                    <span className="text-sm text-[var(--text-soft)]">
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {filteredCases.length === 0 && !error ? (
                <div className="max-w-7xl mx-auto mt-10 bg-white rounded-[28px] shadow-[var(--shadow-card)] p-10 text-center">
                    <FileImage className="mx-auto h-10 w-10 text-[var(--primary-dark)]" />
                    <h2 className="mt-4 text-2xl font-bold text-[var(--foreground)]">
                        No cases found
                    </h2>
                    <p className="mt-3 text-[var(--text-soft)]">
                        Upload a wrist radiograph to create your first analysis record.
                    </p>
                    <button
                        onClick={() => router.push("/upload")}
                        className="mt-6 px-5 py-3 rounded-xl bg-[var(--primary-dark)] text-white font-semibold hover:bg-[var(--primary)]"
                    >
                        Upload First Scan
                    </button>
                </div>
            ) : (
                <>
                    <div className="max-w-7xl mx-auto mt-8 grid gap-4 md:hidden">
                        {filteredCases.map((c) => (
                            <div
                                key={c.id}
                                className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-4"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-xs text-[var(--text-soft)]">Case ID</p>
                                        <p className="truncate font-semibold text-[var(--foreground)]">
                                            {c.id}
                                        </p>
                                    </div>

                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${(c.prediction || "").toLowerCase() === "fracture"
                                                ? "bg-red-50 text-red-600"
                                                : (c.prediction || "").toLowerCase() === "normal"
                                                    ? "bg-emerald-50 text-emerald-600"
                                                    : "bg-amber-50 text-amber-600"
                                            }`}
                                    >
                                        {c.prediction || "Unknown"}
                                    </span>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                    <InfoMini label="Patient" value={c.patientName || "Unknown"} />
                                    <InfoMini
                                        label="Confidence"
                                        value={`${((c.confidence || 0) * 100).toFixed(1)}%`}
                                    />
                                    <InfoMini label="Date" value={formatDate(c.createdAt)} />
                                    <InfoMini label="Regions" value={`${c.boxes?.length || 0}`} />
                                </div>

                                <button
                                    onClick={() => handleViewCase(c)}
                                    className="mt-4 w-full px-4 py-2.5 rounded-xl bg-[var(--primary-dark)] text-white text-sm font-semibold"
                                >
                                    View Case
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="max-w-7xl mx-auto mt-10 bg-white rounded-[28px] shadow-[var(--shadow-card)] overflow-hidden hidden md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] text-sm">
                                <thead className="bg-[var(--secondary)]/45">
                                    <tr>
                                        <th className="text-left p-4 font-semibold">Case ID</th>
                                        <th className="text-left p-4 font-semibold">Patient</th>
                                        <th className="text-left p-4 font-semibold">Result</th>
                                        <th className="text-left p-4 font-semibold">Confidence</th>
                                        <th className="text-left p-4 font-semibold">Date</th>
                                        <th className="text-left p-4 font-semibold">Regions</th>
                                        <th className="text-left p-4 font-semibold">Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredCases.map((c) => (
                                        <tr
                                            key={c.id}
                                            className="border-t border-[var(--border)] hover:bg-[var(--card)]/35"
                                        >
                                            <td className="p-4 font-medium">{c.id}</td>
                                            <td className="p-4">{c.patientName || "Unknown"}</td>

                                            <td className="p-4">
                                                <span
                                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${(c.prediction || "").toLowerCase() === "fracture"
                                                            ? "bg-red-50 text-red-600"
                                                            : (c.prediction || "").toLowerCase() === "normal"
                                                                ? "bg-emerald-50 text-emerald-600"
                                                                : "bg-amber-50 text-amber-600"
                                                        }`}
                                                >
                                                    {c.prediction || "Unknown"}
                                                </span>
                                            </td>

                                            <td className="p-4">
                                                {((c.confidence || 0) * 100).toFixed(1)}%
                                            </td>

                                            <td className="p-4">{formatDate(c.createdAt)}</td>

                                            <td className="p-4">{c.boxes?.length || 0}</td>

                                            <td className="p-4">
                                                <button
                                                    onClick={() => handleViewCase(c)}
                                                    className="px-3 py-1.5 rounded-lg bg-[var(--primary-dark)] text-white text-sm font-medium"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </main>
    );
}

function getReadableFirestoreError(err: any) {
    const code = err?.code || "";

    if (code.includes("permission-denied")) {
        return "Permission denied while reading Firestore data. Check Firestore rules.";
    }

    if (code.includes("failed-precondition")) {
        return "Firestore index or query requirement not satisfied. Create the required composite index for userId + createdAt.";
    }

    if (code.includes("unavailable")) {
        return "Firestore is temporarily unavailable.";
    }

    return "Unable to fetch case history.";
}

function HistoryStatCard({
    title,
    value,
    icon,
    color,
}: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
}) {
    return (
        <div className="rounded-[24px] bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
            <div className={`inline-flex rounded-2xl p-3 ${color}`}>{icon}</div>
            <p className="mt-4 text-sm text-[var(--text-soft)]">{title}</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--foreground)]">
                {value}
            </p>
        </div>
    );
}

function InfoMini({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <p className="text-xs text-[var(--text-soft)]">{label}</p>
            <p className="mt-1 truncate font-medium text-[var(--foreground)]">
                {value}
            </p>
        </div>
    );
}