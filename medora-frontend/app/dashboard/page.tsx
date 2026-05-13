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
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileImage,
  LogOut,
  RefreshCw,
  ScanLine,
  UserRound,
  ChevronRight,
  FolderKanban,
  BarChart3,
  ShieldCheck,
  Bell,
  Sparkles,
  Brain,
  TrendingUp,
  CalendarDays,
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
  riskLevel: string;
  originalImageUrl: string;
  annotatedImageUrl: string;
  gradCamUrl: string;
  summary: string;
  recommendation: string;
  boxes: { x1: number; y1: number; x2: number; y2: number }[];
  filename?: string;
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function getReadableFirestoreError(err: any) {
  const code = err?.code || "";
  if (code.includes("permission-denied"))
    return "Permission denied. Check Firestore rules.";
  if (code.includes("unavailable"))
    return "Firestore is temporarily unavailable.";
  return "Unable to load dashboard data.";
}

function normalizeBoxes(detections: any[]): { x1: number; y1: number; x2: number; y2: number }[] {
  if (!Array.isArray(detections)) return [];
  return detections
    .map((det: any) => ({
      x1: det.center_x - det.width_px / 2,
      y1: det.center_y - det.height_px / 2,
      x2: det.center_x + det.width_px / 2,
      y2: det.center_y + det.height_px / 2,
    }))
    .filter(
      (box) =>
        Number.isFinite(box.x1) &&
        Number.isFinite(box.y1) &&
        Number.isFinite(box.x2) &&
        Number.isFinite(box.y2)
    );
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
      setUserName(user.displayName || user.email?.split("@")[0] || "User");
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!firebaseUser) return;

    setLoading(true);
    const q = query(collection(db, "cases"), orderBy("timestamp", "desc"));

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

            const createdAt = data.timestamp || null;
            const imageUrls = data.image_urls || {};
            const originalImageUrl = imageUrls.original_url || "";
            const annotatedImageUrl = imageUrls.yolo_annotated_url || "";
            const gradCamUrl = imageUrls.gradcam_overlay_url || "";

            const riskLevel = data.risk_level || "";
            const summary = data.summary || "";
            const recommendation = data.recommendation || "";
            const boxes = normalizeBoxes(data.detections || []);

            return {
              id: doc.id,
              prediction,
              confidence,
              createdAt,
              status: data.status || "Completed",
              riskLevel,
              originalImageUrl,
              annotatedImageUrl,
              gradCamUrl,
              summary,
              recommendation,
              boxes,
              filename: data.filename || "",
            };
          });

          setCases(fetchedCases);
          setError("");
        } catch (e) {
          console.error("Dashboard parse error:", e);
          setError("Dashboard data format is invalid in some documents.");
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      (err) => {
        console.error("Firestore fetch error:", err);
        setError(getReadableFirestoreError(err));
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubCases();
  }, [firebaseUser]);

  const stats = useMemo(() => {
    const total = cases.length;
    const fractures = cases.filter((item) => item.prediction === "Fracture").length;
    const normal = cases.filter((item) => item.prediction === "Normal").length;
    const pending = cases.filter((item) => {
      const status = (item.status || "").toLowerCase();
      return status === "pending" || status === "review" || status === "needs review";
    }).length;
    const avgConfidence =
      total > 0
        ? cases.reduce((sum, item) => sum + item.confidence * 100, 0) / total
        : 0;
    return { total, fractures, normal, pending, avgConfidence };
  }, [cases]);

  const recentCases = useMemo(() => cases.slice(0, 5), [cases]);

  const monthlyChartData = useMemo(() => {
    const map = new Map<string, { name: string; Fracture: number; Normal: number; Pending: number }>();
    cases.forEach((item) => {
      const date = parseDate(item.createdAt);
      if (!date) return;
      const monthKey = date.toLocaleString("en-US", { month: "short" });
      if (!map.has(monthKey)) {
        map.set(monthKey, { name: monthKey, Fracture: 0, Normal: 0, Pending: 0 });
      }
      const row = map.get(monthKey)!;
      if (item.prediction === "Fracture") row.Fracture += 1;
      else if (item.prediction === "Normal") row.Normal += 1;
      const statusLow = (item.status || "").toLowerCase();
      if (statusLow === "pending" || statusLow === "review" || statusLow === "needs review") {
        row.Pending += 1;
      }
    });
    const result = Array.from(map.values());
    return result.length ? result.slice(-6) : [{ name: "Jan", Fracture: 0, Normal: 0, Pending: 0 }];
  }, [cases]);

  const distributionData = useMemo(
    () => [
      { name: "Fracture", value: stats.fractures, color: "#ef4444" },
      { name: "Normal", value: stats.normal, color: "#10b981" },
      { name: "Pending", value: stats.pending, color: "#f59e0b" },
    ],
    [stats]
  );

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = parseDate(value);
    return date ? date.toLocaleDateString() : "—";
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleViewCase = (item: CaseItem) => {
    router.push(`/report/${item.id}`);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="rounded-[28px] bg-[var(--white)] px-8 py-6 shadow-[var(--shadow-soft)] animate-fade-in-up">
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
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 animate-fade-in-up">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--secondary)]/50 shadow-sm">
              <img src="/logo.png" alt="MEDORA" className="h-8 w-8 object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-[var(--primary)] sm:text-xl">
                MEDORA Dashboard
              </h1>
              <p className="truncate text-xs text-[var(--text-soft)] sm:text-sm">
                Welcome back, {userName}
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
            <button
              onClick={handleRefresh}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--card)] sm:flex-none"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin-slow" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] sm:flex-none"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Hero + Profile row */}
        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[var(--primary)] via-[var(--primary-dark)] to-[#8c7ef1] p-5 text-white shadow-[var(--shadow-soft)] animate-fade-in-up sm:p-8">
            <div className="absolute -right-10 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl animate-pulse-slower" />
            <div className="absolute bottom-0 right-8 h-24 w-24 rounded-full bg-[var(--accent)]/30 blur-2xl animate-float-subtle" />
            <div className="relative">
              <div className="flex items-center gap-2 text-white/90">
                <Activity className="h-5 w-5" />
                <span className="text-sm font-medium">Clinical AI Overview</span>
              </div>
              <h2 className="mt-4 max-w-2xl text-xl font-bold leading-tight sm:text-3xl">
                Monitor your scans, review your fracture detections, and manage your pediatric wrist workflow in one place.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base sm:leading-7">
                MEDORA combines EfficientNet-B3 screening and YOLOv8 localization to support radiology review, case management, and research evaluation.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button onClick={() => router.push("/upload")} className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--card)]">
                  Upload New Scan
                </button>
                <button onClick={() => router.push("/history")} className="rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20">
                  View Case History
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] animate-fade-in-up sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--secondary)]/40">
                <UserRound className="h-6 w-6 text-[var(--primary)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">Research Profile</h3>
                <p className="text-sm text-[var(--text-soft)]">Active MEDORA workspace</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-[var(--card)] p-4">
                <p className="text-sm text-[var(--text-soft)]">Signed in as</p>
                <p className="mt-1 break-words font-semibold text-[var(--foreground)]">{firebaseUser?.email || userName}</p>
              </div>
              <div className="rounded-2xl bg-[var(--card)] p-4">
                <p className="text-sm text-[var(--text-soft)]">Average confidence</p>
                <p className="mt-1 text-2xl font-bold text-[var(--primary)]">{stats.avgConfidence.toFixed(1)}%</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <QuickLinkCard title="Viewer" icon={<ScanLine className="h-5 w-5" />} onClick={() => router.push("/viewer")} />
                <QuickLinkCard title="Reports" icon={<FolderKanban className="h-5 w-5" />} onClick={() => router.push("/history")} />
              </div>
            </div>
          </div>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard title="Total Scans" value={stats.total} icon={<FileImage className="h-5 w-5" />} color="bg-[var(--secondary)]/35 text-[var(--primary)]" />
          <StatCard title="Fractures" value={stats.fractures} icon={<AlertTriangle className="h-5 w-5" />} color="bg-red-50 text-red-600" />
          <StatCard title="Normal" value={stats.normal} icon={<CheckCircle2 className="h-5 w-5" />} color="bg-emerald-50 text-emerald-600" />
          <StatCard title="Pending" value={stats.pending} icon={<Clock3 className="h-5 w-5" />} color="bg-amber-50 text-amber-600" />
        </div>

        {/* Info strips */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <InfoStripCard title="Total reviewed trend" value={stats.total} icon={<TrendingUp className="h-5 w-5" />} note="Live case volume from your Firestore data" />
          <InfoStripCard title="Latest activity" value={recentCases.length} icon={<CalendarDays className="h-5 w-5" />} note="Recent cases shown below" />
          <InfoStripCard title="AI safety note" value="Assistive" icon={<ShieldCheck className="h-5 w-5" />} note="Not a replacement for clinician review" />
        </div>

        {/* Charts row */}
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <div className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] xl:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="text-lg font-bold text-[var(--foreground)]">Monthly Scan Overview</h3>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Fracture" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Normal" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Pending" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="text-lg font-bold text-[var(--foreground)]">Case Distribution</h3>
            </div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {distributionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-2">
              {distributionData.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-xl bg-[var(--card)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-[var(--foreground)]">{item.name}</span>
                  </div>
                  <span className="text-sm text-[var(--text-soft)]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========== REMOVED: Recent Case Confidence chart and insight cards ========== */}

        {/* Action cards */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <ActionCard title="Upload Radiograph" desc="Start a new pediatric wrist fracture analysis." cta="Open Upload" onClick={() => router.push("/upload")} />
          <ActionCard title="Research Panel" desc="Inspect metrics, performance, and evaluation outputs." cta="Open Research" onClick={() => router.push("/research")} />
          <ActionCard title="Settings" desc="Manage model preferences, thresholds, and profile options." cta="Open Settings" onClick={() => router.push("/settings")} />
        </div>

        {/* Mobile shortcuts */}
        <div className="mt-8 md:hidden">
          <div className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="text-lg font-bold text-[var(--foreground)]">Quick Mobile Actions</h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ShortcutButton label="Upload" onClick={() => router.push("/upload")} icon={<FileImage className="h-5 w-5" />} />
              <ShortcutButton label="History" onClick={() => router.push("/history")} icon={<FolderKanban className="h-5 w-5" />} />
              <ShortcutButton label="Viewer" onClick={() => router.push("/viewer")} icon={<ScanLine className="h-5 w-5" />} />
              <ShortcutButton label="Research" onClick={() => router.push("/research")} icon={<BarChart3 className="h-5 w-5" />} />
            </div>
          </div>
        </div>

        {/* Recent Cases Table */}
        <div className="mt-8 rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">Recent Cases</h2>
              <p className="mt-1 text-sm text-[var(--text-soft)]">Latest analyses fetched from your Firestore cases in real time.</p>
            </div>
            <button onClick={() => router.push("/history")} className="flex items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:underline">
              See all <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile cards */}
          <div className="space-y-4 md:hidden">
            {recentCases.length === 0 ? (
              <EmptyState onUpload={() => router.push("/upload")} />
            ) : (
              recentCases.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/45 p-4 animate-fade-in-up">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-soft)]">Case ID</p>
                      <p className="truncate font-semibold text-[var(--foreground)]">{item.id}</p>
                    </div>
                    <StatusBadge prediction={item.prediction} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <InfoMini label="Filename" value={item.filename || "Unknown"} />
                    <InfoMini label="Confidence" value={`${(item.confidence * 100).toFixed(1)}%`} />
                    <InfoMini label="Date" value={formatDate(item.createdAt)} />
                    <InfoMini label="Status" value={item.status || "Completed"} />
                  </div>
                  <button onClick={() => handleViewCase(item)} className="mt-4 w-full rounded-lg bg-[var(--primary-dark)] px-4 py-2 text-sm font-semibold text-white">
                    View
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--border)] md:block">
            {recentCases.length === 0 ? (
              <div className="p-8">
                <EmptyState onUpload={() => router.push("/upload")} />
              </div>
            ) : (
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-[var(--secondary)]/45 text-[var(--foreground)]">
                  <tr>
                    <th className="px-4 py-4 text-left font-semibold">Case ID</th>
                    <th className="px-4 py-4 text-left font-semibold">Filename</th>
                    <th className="px-4 py-4 text-left font-semibold">Prediction</th>
                    <th className="px-4 py-4 text-left font-semibold">Confidence</th>
                    <th className="px-4 py-4 text-left font-semibold">Date</th>
                    <th className="px-4 py-4 text-left font-semibold">Status</th>
                    <th className="px-4 py-4 text-left font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--border)] bg-white hover:bg-[var(--card)]/35">
                      <td className="p-4 font-medium text-[var(--foreground)]">{item.id}</td>
                      <td className="p-4 text-[var(--text-soft)]">{item.filename || "Unknown"}</td>
                      <td className="p-4"><StatusBadge prediction={item.prediction} /></td>
                      <td className="p-4 text-[var(--foreground)]">{(item.confidence * 100).toFixed(1)}%</td>
                      <td className="p-4 text-[var(--text-soft)]">{formatDate(item.createdAt)}</td>
                      <td className="p-4 text-[var(--text-soft)]">{item.status || "Completed"}</td>
                      <td className="p-4">
                        <button onClick={() => handleViewCase(item)} className="rounded-lg bg-[var(--primary-dark)] px-3 py-1.5 text-sm font-semibold text-white">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Workflow + Notes */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] bg-white p-6 shadow-[var(--shadow-card)]">
            <h3 className="text-lg font-bold text-[var(--foreground)]">Workflow Snapshot</h3>
            <div className="mt-4 space-y-4">
              <WorkflowRow step="1" title="Upload" desc="Import wrist radiographs." />
              <WorkflowRow step="2" title="Screen" desc="EfficientNet-B3 estimates fracture probability." />
              <WorkflowRow step="3" title="Localize" desc="YOLOv8 highlights suspected fracture regions." />
              <WorkflowRow step="4" title="Review" desc="Clinicians inspect, validate, and export reports." />
            </div>
          </div>
          <div className="rounded-[28px] bg-white p-6 shadow-[var(--shadow-card)]">
            <h3 className="text-lg font-bold text-[var(--foreground)]">Platform Notes</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--text-soft)]">
              <p>MEDORA is a clinical decision‑support platform for pediatric wrist fracture detection and localization.</p>
              <p>Dashboard values are derived from your Firestore <b>cases</b> collection, ordered by timestamp descending.</p>
              <p>Recent cases display original radiographs, YOLO annotations, Grad‑CAM heatmaps, and detection details from your backend pipeline.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 md:hidden">
          <div className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[var(--primary)]" />
              <h3 className="text-lg font-bold text-[var(--foreground)]">Daily Reminder</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
              Review pending cases regularly and verify AI outputs with clinician judgment before making any diagnostic conclusion.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

// ---------- Helper components (unchanged) ----------
function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-[24px] bg-white p-4 shadow-[var(--shadow-card)] animate-fade-in-up sm:p-5">
      <div className="flex items-center justify-between">
        <div className={`rounded-2xl p-3 ${color}`}>{icon}</div>
      </div>
      <p className="mt-4 text-sm text-[var(--text-soft)]">{title}</p>
      <p className="mt-1 text-xl font-bold text-[var(--foreground)] sm:text-3xl">{value}</p>
    </div>
  );
}

function InfoStripCard({ title, value, icon, note }: { title: string; value: string | number; icon: React.ReactNode; note: string }) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[var(--secondary)]/35 p-3 text-[var(--primary)]">{icon}</div>
        <div>
          <p className="text-sm text-[var(--text-soft)]">{title}</p>
          <p className="text-lg font-bold text-[var(--foreground)]">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--text-soft)]">{note}</p>
    </div>
  );
}

function ActionCard({ title, desc, cta, onClick }: { title: string; desc: string; cta: string; onClick: () => void }) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[var(--shadow-card)] animate-fade-in-up">
      <h3 className="text-lg font-bold text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{desc}</p>
      <button onClick={onClick} className="mt-5 rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-dark)]">
        {cta}
      </button>
    </div>
  );
}

function QuickLinkCard({ title, icon, onClick }: { title: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl bg-[var(--secondary)]/35 p-4 text-left hover:bg-[var(--secondary)]/55">
      <div className="flex items-center gap-2 text-[var(--primary)]">
        {icon}
        <span className="font-semibold">{title}</span>
      </div>
    </button>
  );
}

function WorkflowRow({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--secondary)]/50 text-sm font-bold text-[var(--primary)]">{step}</div>
      <div>
        <p className="font-semibold text-[var(--foreground)]">{title}</p>
        <p className="text-sm text-[var(--text-soft)]">{desc}</p>
      </div>
    </div>
  );
}

function StatusBadge({ prediction }: { prediction?: string }) {
  const normalized = (prediction || "unknown").toLowerCase();
  if (normalized === "fracture")
    return <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">Fracture</span>;
  if (normalized === "normal")
    return <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">Normal</span>;
  return <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">Unknown</span>;
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-[var(--text-soft)]">{label}</p>
      <p className="mt-1 truncate font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--card)]/35 p-8 text-center">
      <FileImage className="h-10 w-10 text-[var(--primary)]" />
      <h3 className="mt-4 text-lg font-bold text-[var(--foreground)]">No cases available</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--text-soft)]">
        Start by uploading a pediatric wrist radiograph to generate your first AI‑assisted case result.
      </p>
      <button onClick={onUpload} className="mt-5 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--primary-dark)]">
        Upload First Scan
      </button>
    </div>
  );
}

function MobileInsightCard({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[var(--shadow-card)] animate-fade-in-up">
      <div className="flex items-center gap-3 text-[var(--primary)]">
        <div className="rounded-2xl bg-[var(--secondary)]/35 p-3">{icon}</div>
        <h3 className="font-bold text-[var(--foreground)]">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{desc}</p>
    </div>
  );
}

function ShortcutButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-2xl bg-[var(--card)] px-4 py-4 text-left hover:bg-[var(--secondary)]/35">
      <div className="flex flex-col items-start gap-2 text-[var(--primary)]">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
      </div>
    </button>
  );
}
