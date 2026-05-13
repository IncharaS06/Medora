"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  DocumentData,
} from "firebase/firestore";

import {
  Activity,
  RefreshCw,
  LogOut,
  UserRound,
  ScanLine,
  FileImage,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FolderKanban,
  TrendingUp,
  CalendarDays,
  ShieldCheck,
  BarChart3,
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

type CaseItem = {
  id: string;
  prediction: string;
  confidence: number;
  createdAt: string | null;
  status: string;
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function getReadableFirestoreError(err: any) {
  const code = err?.code || "";

  if (code.includes("permission-denied")) {
    return "Permission denied. Check Firestore rules.";
  }

  if (code.includes("unavailable")) {
    return "Firestore is temporarily unavailable.";
  }

  return "Unable to load dashboard data.";
}

export default function DashboardPage() {
  const router = useRouter();

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("User");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/auth");
        return;
      }

      setFirebaseUser(user);
      setUserName(
        user.displayName || user.email?.split("@")[0] || "User"
      );
    });

    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!firebaseUser) return;

    setLoading(true);

    const q = query(
      collection(db, "cases"),
      orderBy("timestamp", "desc")
    );

    const unsubCases = onSnapshot(
      q,
      (snapshot) => {
        try {
          const fetchedCases: CaseItem[] = snapshot.docs.map((doc) => {
            const data = doc.data() as DocumentData;

            const rawResult = data.final_result || "Unknown";

            const prediction =
              rawResult.toLowerCase() === "fracture"
                ? "Fracture"
                : rawResult.toLowerCase() === "normal"
                ? "Normal"
                : "Unknown";

            const fractureProb =
              typeof data.fracture_probability === "number"
                ? data.fracture_probability
                : 0;

            const confidence = fractureProb / 100;

            return {
              id: doc.id,
              prediction,
              confidence,
              createdAt: data.timestamp || null,
              status: data.status || "Completed",
            };
          });

          setCases(fetchedCases);
          setError("");
        } catch (e) {
          console.error(e);
          setError("Dashboard data format is invalid.");
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      (err) => {
        console.error(err);
        setError(getReadableFirestoreError(err));
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubCases();
  }, [firebaseUser]);

  const stats = useMemo(() => {
    const total = cases.length;

    const fractures = cases.filter(
      (item) => item.prediction === "Fracture"
    ).length;

    const normal = cases.filter(
      (item) => item.prediction === "Normal"
    ).length;

    const pending = cases.filter((item) => {
      const status = (item.status || "").toLowerCase();

      return (
        status === "pending" ||
        status === "review" ||
        status === "needs review"
      );
    }).length;

    const avgConfidence =
      total > 0
        ? cases.reduce(
            (sum, item) => sum + item.confidence * 100,
            0
          ) / total
        : 0;

    return {
      total,
      fractures,
      normal,
      pending,
      avgConfidence,
    };
  }, [cases]);

  const monthlyChartData = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        Fracture: number;
        Normal: number;
        Pending: number;
      }
    >();

    cases.forEach((item) => {
      const date = parseDate(item.createdAt);

      if (!date) return;

      const monthKey = date.toLocaleString("en-US", {
        month: "short",
      });

      if (!map.has(monthKey)) {
        map.set(monthKey, {
          name: monthKey,
          Fracture: 0,
          Normal: 0,
          Pending: 0,
        });
      }

      const row = map.get(monthKey)!;

      if (item.prediction === "Fracture") {
        row.Fracture += 1;
      } else if (item.prediction === "Normal") {
        row.Normal += 1;
      }

      const statusLow = (item.status || "").toLowerCase();

      if (
        statusLow === "pending" ||
        statusLow === "review" ||
        statusLow === "needs review"
      ) {
        row.Pending += 1;
      }
    });

    const result = Array.from(map.values());

    return result.length
      ? result.slice(-6)
      : [
          {
            name: "Jan",
            Fracture: 0,
            Normal: 0,
            Pending: 0,
          },
        ];
  }, [cases]);

  const distributionData = useMemo(
    () => [
      {
        name: "Fracture",
        value: stats.fractures,
        color: "#ef4444",
      },
      {
        name: "Normal",
        value: stats.normal,
        color: "#10b981",
      },
      {
        name: "Pending",
        value: stats.pending,
        color: "#f59e0b",
      },
    ],
    [stats]
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);

    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="rounded-[28px] bg-white px-8 py-6 shadow-[var(--shadow-soft)]">
          <p className="text-[var(--primary)] text-lg font-semibold">
            Loading MEDORA dashboard...
          </p>

          <div className="mt-4 h-2 w-56 overflow-hidden rounded-full bg-[var(--secondary)]/40">
            <div className="h-full rounded-full bg-[var(--primary)] animate-progress-loading" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--secondary)]/50 shadow-sm">
              <img
                src="/logo.png"
                alt="MEDORA"
                className="h-8 w-8 object-contain"
              />
            </div>

            <div>
              <h1 className="text-base font-bold text-[var(--primary)] sm:text-xl">
                MEDORA Dashboard
              </h1>

              <p className="text-xs text-[var(--text-soft)] sm:text-sm">
                Welcome back, {userName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--card)]"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />

              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)]"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* HERO */}
        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[var(--primary)] via-[var(--primary-dark)] to-[#8c7ef1] p-5 text-white shadow-[var(--shadow-soft)] sm:p-8">
            <div className="relative">
              <div className="flex items-center gap-2 text-white/90">
                <Activity className="h-5 w-5" />
                <span className="text-sm font-medium">
                  Clinical AI Overview
                </span>
              </div>

              <h2 className="mt-4 max-w-2xl text-xl font-bold leading-tight sm:text-3xl">
                Monitor your scans and manage your pediatric
                wrist workflow in one place.
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
                MEDORA combines EfficientNet-B3 screening and
                YOLOv8 localization for fracture analysis.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => router.push("/upload")}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)]"
                >
                  Upload New Scan
                </button>

                <button
                  onClick={() => router.push("/history")}
                  className="rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
                >
                  View History
                </button>
              </div>
            </div>
          </div>

          {/* PROFILE */}
          <div className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--secondary)]/40">
                <UserRound className="h-6 w-6 text-[var(--primary)]" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  Research Profile
                </h3>

                <p className="text-sm text-[var(--text-soft)]">
                  Active MEDORA workspace
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-[var(--card)] p-4">
                <p className="text-sm text-[var(--text-soft)]">
                  Signed in as
                </p>

                <p className="mt-1 break-words font-semibold text-[var(--foreground)]">
                  {firebaseUser?.email || userName}
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--card)] p-4">
                <p className="text-sm text-[var(--text-soft)]">
                  Average confidence
                </p>

                <p className="mt-1 text-2xl font-bold text-[var(--primary)]">
                  {stats.avgConfidence.toFixed(1)}%
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <QuickLinkCard
                  title="Viewer"
                  icon={<ScanLine className="h-5 w-5" />}
                  onClick={() => router.push("/viewer")}
                />

                <QuickLinkCard
                  title="Reports"
                  icon={<FolderKanban className="h-5 w-5" />}
                  onClick={() => router.push("/history")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* STATS */}
        <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            title="Total Scans"
            value={stats.total}
            icon={<FileImage className="h-5 w-5" />}
            color="bg-[var(--secondary)]/35 text-[var(--primary)]"
          />

          <StatCard
            title="Fractures"
            value={stats.fractures}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="bg-red-50 text-red-600"
          />

          <StatCard
            title="Normal"
            value={stats.normal}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="bg-emerald-50 text-emerald-600"
          />

          <StatCard
            title="Pending"
            value={stats.pending}
            icon={<Clock3 className="h-5 w-5" />}
            color="bg-amber-50 text-amber-600"
          />
        </div>

        {/* INFO STRIPS */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <InfoStripCard
            title="Total reviewed trend"
            value={stats.total}
            icon={<TrendingUp className="h-5 w-5" />}
            note="Live case volume from Firestore"
          />

          <InfoStripCard
            title="AI safety note"
            value="Assistive"
            icon={<ShieldCheck className="h-5 w-5" />}
            note="Not a replacement for clinician review"
          />

          <InfoStripCard
            title="Monthly analytics"
            value="Live"
            icon={<CalendarDays className="h-5 w-5" />}
            note="Charts update automatically"
          />
        </div>

        {/* CHARTS */}
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <div className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] xl:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[var(--primary)]" />

              <h3 className="text-lg font-bold text-[var(--foreground)]">
                Monthly Scan Overview
              </h3>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />

                  <Bar
                    dataKey="Fracture"
                    fill="#ef4444"
                    radius={[8, 8, 0, 0]}
                  />

                  <Bar
                    dataKey="Normal"
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                  />

                  <Bar
                    dataKey="Pending"
                    fill="#f59e0b"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-[var(--primary)]" />

              <h3 className="text-lg font-bold text-[var(--foreground)]">
                Case Distribution
              </h3>
            </div>

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {distributionData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.color}
                      />
                    ))}
                  </Pie>

                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* COMPONENTS */

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-[24px] bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <div className={`rounded-2xl p-3 ${color}`}>
          {icon}
        </div>
      </div>

      <p className="mt-4 text-sm text-[var(--text-soft)]">
        {title}
      </p>

      <p className="mt-1 text-xl font-bold text-[var(--foreground)] sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function InfoStripCard({
  title,
  value,
  icon,
  note,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  note: string;
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[var(--secondary)]/35 p-3 text-[var(--primary)]">
          {icon}
        </div>

        <div>
          <p className="text-sm text-[var(--text-soft)]">
            {title}
          </p>

          <p className="text-lg font-bold text-[var(--foreground)]">
            {value}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-[var(--text-soft)]">
        {note}
      </p>
    </div>
  );
}

function QuickLinkCard({
  title,
  icon,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-[var(--secondary)]/35 p-4 text-left hover:bg-[var(--secondary)]/55"
    >
      <div className="flex items-center gap-2 text-[var(--primary)]">
        {icon}

        <span className="font-semibold">{title}</span>
      </div>
    </button>
  );
}
