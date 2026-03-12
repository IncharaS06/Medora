"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import {
    ArrowLeft,
    Download,
    Eye,
    FileText,
    Brain,
    ScanLine,
    AlertTriangle,
    CalendarDays,
    ShieldAlert,
} from "lucide-react";

type RawBoxType =
    | {
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
    }
    | number[];

type BoxType = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

type ResultType = {
    id?: string;
    userId?: string;
    userEmail?: string;
    patientName?: string;
    prediction: string;
    confidence: number;
    boxes?: RawBoxType[];
    originalImageBase64?: string;
    annotatedImageBase64?: string;
    gradCamBase64?: string;
    riskLevel?: string;
    modelName?: string;
    summary?: string;
    recommendation?: string;
    createdAt?: Timestamp | string | null;
};

function normalizeBoxes(boxes?: RawBoxType[]): BoxType[] {
    if (!Array.isArray(boxes)) return [];

    return boxes
        .map((box) => {
            if (Array.isArray(box)) {
                return {
                    x1: Number(box[0] ?? 0),
                    y1: Number(box[1] ?? 0),
                    x2: Number(box[2] ?? 0),
                    y2: Number(box[3] ?? 0),
                };
            }

            return {
                x1: Number(box?.x1 ?? 0),
                y1: Number(box?.y1 ?? 0),
                x2: Number(box?.x2 ?? 0),
                y2: Number(box?.y2 ?? 0),
            };
        })
        .filter(
            (box) =>
                Number.isFinite(box.x1) &&
                Number.isFinite(box.y1) &&
                Number.isFinite(box.x2) &&
                Number.isFinite(box.y2)
        );
}

function getImageSrc(value?: string) {
    if (!value) return "";

    const trimmed = value.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("data:image/")) return trimmed;

    const looksLikeBase64 =
        trimmed.length > 100 &&
        !trimmed.includes("http://") &&
        !trimmed.includes("https://") &&
        !trimmed.includes("\\") &&
        !trimmed.includes(" ");

    if (looksLikeBase64) {
        return `data:image/jpeg;base64,${trimmed}`;
    }

    return "";
}

function formatDate(value?: Timestamp | string | null) {
    if (!value) return new Date().toLocaleString();

    if (typeof value === "string") {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
    }

    if (typeof value === "object" && value && "toDate" in value) {
        try {
            return value.toDate().toLocaleString();
        } catch {
            return new Date().toLocaleString();
        }
    }

    return new Date().toLocaleString();
}

export default function ReportPage() {
    const router = useRouter();
    const params = useParams();

    const id =
        typeof params?.id === "string"
            ? params.id
            : Array.isArray(params?.id)
                ? params.id[0]
                : "";

    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [authResolved, setAuthResolved] = useState(false);
    const [result, setResult] = useState<ResultType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) {
                setAuthResolved(true);
                router.push("/auth");
                return;
            }

            setFirebaseUser(user);
            setAuthResolved(true);
        });

        return () => unsub();
    }, [router]);

    useEffect(() => {
        if (!authResolved) return;
        if (!firebaseUser) return;
        if (!id) return;

        const fetchCase = async () => {
            setLoading(true);
            setError("");

            try {
                const ref = doc(db, "cases", id);
                const snap = await getDoc(ref);

                if (!snap.exists()) {
                    setError("Case not found in database.");
                    setResult(null);
                    return;
                }

                const data = snap.data() as Omit<ResultType, "id">;

                if (data.userId && data.userId !== firebaseUser.uid) {
                    setError("You do not have permission to view this report.");
                    setResult(null);
                    return;
                }

                const payload: ResultType = {
                    id: snap.id,
                    userId: data.userId || "",
                    userEmail: data.userEmail || "",
                    patientName: data.patientName || "Unknown",
                    prediction: data.prediction || "Unknown",
                    confidence: typeof data.confidence === "number" ? data.confidence : 0,
                    boxes: Array.isArray(data.boxes) ? data.boxes : [],
                    originalImageBase64: data.originalImageBase64 || "",
                    annotatedImageBase64: data.annotatedImageBase64 || "",
                    gradCamBase64: data.gradCamBase64 || "",
                    riskLevel: data.riskLevel || "",
                    modelName: data.modelName || "EfficientNet-B3 + YOLOv8",
                    summary: data.summary || "",
                    recommendation: data.recommendation || "",
                    createdAt: data.createdAt || null,
                };

                setResult(payload);
            } catch (err) {
                console.error("Failed to fetch report:", err);
                setError("Failed to load report from database.");
                setResult(null);
            } finally {
                setLoading(false);
            }
        };

        fetchCase();
    }, [authResolved, firebaseUser, id]);

    const safeBoxes = useMemo(() => normalizeBoxes(result?.boxes), [result]);

    const originalSrc = useMemo(
        () => getImageSrc(result?.originalImageBase64),
        [result]
    );

    const annotatedSrc = useMemo(
        () => getImageSrc(result?.annotatedImageBase64),
        [result]
    );

    const gradCamSrc = useMemo(
        () => getImageSrc(result?.gradCamBase64),
        [result]
    );

    const reportDate = useMemo(() => formatDate(result?.createdAt), [result]);

    const riskLevel = useMemo(() => {
        if (result?.riskLevel) return result.riskLevel;
        const c = result?.confidence || 0;
        if (c >= 0.8) return "High";
        if (c >= 0.5) return "Moderate";
        return "Low";
    }, [result]);

    const summary = useMemo(() => {
        if (result?.summary) return result.summary;
        return result?.prediction === "Fracture"
            ? "Suspicious fracture-related region detected in the wrist radiograph."
            : "No strong fracture-related localization detected by the model.";
    }, [result]);

    const recommendation = useMemo(() => {
        if (result?.recommendation) return result.recommendation;
        return result?.prediction === "Fracture"
            ? "Clinical review recommended. Correlate with radiologist interpretation."
            : "Model suggests a normal case, but clinical review is still advised.";
    }, [result]);

    const downloadReport = () => {
        window.print();
    };

    if (!authResolved || loading || !id) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
                <div className="rounded-[28px] bg-white px-8 py-6 shadow-[var(--shadow-soft)]">
                    <p className="text-[var(--primary-dark)] font-semibold text-lg">
                        Loading report from database...
                    </p>
                    <div className="mt-4 h-2 w-56 overflow-hidden rounded-full bg-[var(--secondary)]/40">
                        <div className="h-full rounded-full bg-[var(--primary)] animate-progress-loading" />
                    </div>
                </div>
            </main>
        );
    }

    if (error || !result) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
                <div className="rounded-[28px] bg-white px-8 py-6 shadow-[var(--shadow-soft)] text-center">
                    <p className="text-red-600 font-semibold">
                        {error || "Report not available."}
                    </p>
                    <button
                        onClick={() => router.push("/history")}
                        className="mt-4 rounded-xl bg-[var(--primary-dark)] px-5 py-2.5 text-white font-semibold"
                    >
                        Go to History
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6 print:bg-white">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" className="w-10 h-10" alt="MEDORA" />
                    <div>
                        <h1 className="text-xl font-bold text-[var(--primary-dark)]">
                            MEDORA Report
                        </h1>
                        <p className="text-sm text-[var(--text-soft)]">
                            AI-assisted pediatric wrist fracture diagnostic report
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => router.push("/history")}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary-dark)] text-white font-semibold hover:bg-[var(--primary)]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to History
                </button>
            </div>

            <div className="max-w-6xl mx-auto mt-8 bg-white p-5 sm:p-8 rounded-[28px] shadow-[var(--shadow-card)] print:shadow-none print:rounded-none print:p-0">
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-6">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" className="w-12 h-12" alt="MEDORA" />
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--foreground)]">
                                Diagnostic Report
                            </h2>
                            <p className="text-sm text-[var(--text-soft)] mt-1">
                                MEDORA Clinical Decision-Support Output
                            </p>
                        </div>
                    </div>

                    <div className="text-right text-sm text-[var(--text-soft)]">
                        <p>Report Date</p>
                        <p className="font-semibold text-[var(--foreground)] mt-1">
                            {reportDate}
                        </p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <ReportStat
                        icon={<FileText className="h-5 w-5" />}
                        label="Case ID"
                        value={result.id || "Not available"}
                    />
                    <ReportStat
                        icon={<ScanLine className="h-5 w-5" />}
                        label="Prediction"
                        value={result.prediction || "Unknown"}
                        valueClassName={
                            result.prediction === "Fracture"
                                ? "text-red-600"
                                : "text-green-600"
                        }
                    />
                    <ReportStat
                        icon={<Brain className="h-5 w-5" />}
                        label="Confidence"
                        value={`${((result.confidence || 0) * 100).toFixed(1)}%`}
                    />
                    <ReportStat
                        icon={<AlertTriangle className="h-5 w-5" />}
                        label="Risk Level"
                        value={riskLevel}
                        valueClassName={
                            riskLevel === "High"
                                ? "text-red-600"
                                : riskLevel === "Moderate"
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                        }
                    />
                </div>

                <div className="grid lg:grid-cols-3 gap-6 mt-8">
                    <ReportImageCard
                        title="Uploaded Radiograph"
                        content={
                            originalSrc ? (
                                <img
                                    src={originalSrc}
                                    alt="Uploaded radiograph"
                                    className="rounded-xl shadow w-full object-contain max-h-[320px] bg-white"
                                />
                            ) : (
                                <EmptyReportImage text="Original radiograph not stored in database" />
                            )
                        }
                    />

                    <ReportImageCard
                        title="Annotated Detection Output"
                        content={
                            annotatedSrc ? (
                                <img
                                    src={annotatedSrc}
                                    alt="Annotated result"
                                    className="rounded-xl shadow w-full object-contain max-h-[320px] bg-white"
                                />
                            ) : (
                                <EmptyReportImage text="Annotated image not available" />
                            )
                        }
                    />

                    <ReportImageCard
                        title="Grad-CAM Heatmap"
                        content={
                            gradCamSrc ? (
                                <img
                                    src={gradCamSrc}
                                    alt="Grad-CAM result"
                                    className="rounded-xl shadow w-full object-contain max-h-[320px] bg-white"
                                />
                            ) : (
                                <EmptyReportImage text="Grad-CAM heatmap not available" />
                            )
                        }
                    />
                </div>

                <div className="grid lg:grid-cols-2 gap-6 mt-8">
                    <div className="rounded-2xl bg-[var(--card)] p-5">
                        <div className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-[var(--primary)]" />
                            <h3 className="text-lg font-bold text-[var(--foreground)]">
                                AI Summary
                            </h3>
                        </div>

                        <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">
                            {summary}
                        </p>

                        <div className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                                Recommendation
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                                {recommendation}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-[var(--card)] p-5">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-[var(--primary)]" />
                            <h3 className="text-lg font-bold text-[var(--foreground)]">
                                Technical Details
                            </h3>
                        </div>

                        <div className="mt-4 space-y-4">
                            <DetailRow label="Patient" value={result.patientName || "Unknown"} />
                            <DetailRow
                                label="Model"
                                value={result.modelName || "EfficientNet-B3 + YOLOv8"}
                            />
                            <DetailRow label="Detected Regions" value={`${safeBoxes.length}`} />
                            <DetailRow
                                label="Explainability"
                                value={gradCamSrc ? "Grad-CAM + Bounding Boxes" : "Bounding Boxes"}
                            />
                            <DetailRow label="Generated On" value={reportDate} />
                        </div>

                        <div className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-[var(--primary)]" />
                                <p className="text-sm font-semibold text-[var(--foreground)]">
                                    Medical Disclaimer
                                </p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                                MEDORA is an AI-based clinical decision-support system. It
                                assists clinicians in identifying potential pediatric wrist
                                fractures and should not replace professional medical diagnosis.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 rounded-2xl bg-[var(--card)] p-5">
                    <h3 className="text-lg font-bold text-[var(--foreground)]">
                        Detected Region Coordinates
                    </h3>

                    {safeBoxes.length > 0 ? (
                        <div className="mt-4 grid gap-3">
                            {safeBoxes.map((box, index) => (
                                <div
                                    key={index}
                                    className="rounded-xl bg-white border border-[var(--border)] p-4 text-sm text-[var(--foreground)]"
                                >
                                    <span className="font-semibold text-[var(--primary-dark)]">
                                        Region {index + 1}
                                    </span>

                                    <div className="mt-3 grid sm:grid-cols-4 gap-3">
                                        <MiniCoord label="x1" value={box.x1} />
                                        <MiniCoord label="y1" value={box.y1} />
                                        <MiniCoord label="x2" value={box.x2} />
                                        <MiniCoord label="y2" value={box.y2} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-3 text-sm text-[var(--text-soft)]">
                            No suspicious fracture regions were localized.
                        </p>
                    )}
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-4 print:hidden">
                    <button
                        onClick={downloadReport}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary-dark)] text-white font-semibold hover:bg-[var(--primary)]"
                    >
                        <Download className="h-4 w-4" />
                        Download PDF
                    </button>

                    <button
                        onClick={() => router.push("/viewer")}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] font-semibold hover:bg-[var(--card)]"
                    >
                        <Eye className="h-4 w-4" />
                        Open Viewer
                    </button>
                </div>
            </div>
        </main>
    );
}

function ReportStat({
    icon,
    label,
    value,
    valueClassName = "text-[var(--foreground)]",
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    valueClassName?: string;
}) {
    return (
        <div className="rounded-2xl bg-[var(--background)] border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 text-[var(--primary)]">
                {icon}
                <span className="text-sm font-medium">{label}</span>
            </div>
            <p className={`mt-3 text-xl font-bold break-words ${valueClassName}`}>
                {value}
            </p>
        </div>
    );
}

function ReportImageCard({
    title,
    content,
}: {
    title: string;
    content: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl bg-[var(--card)] p-4">
            <h3 className="text-sm font-medium text-[var(--text-soft)] mb-3">
                {title}
            </h3>
            {content}
        </div>
    );
}

function EmptyReportImage({ text }: { text: string }) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-white min-h-[220px] flex items-center justify-center text-sm text-[var(--text-soft)] text-center px-4">
            {text}
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
            <span className="text-[var(--text-soft)] text-sm">{label}</span>
            <span className="font-medium text-[var(--foreground)] text-sm text-right break-words">
                {value}
            </span>
        </div>
    );
}

function MiniCoord({ label, value }: { label: string; value: number }) {
    const safeValue = Number.isFinite(value) ? value : 0;

    return (
        <div className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
            <p className="text-xs text-[var(--text-soft)]">{label}</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
                {safeValue.toFixed(1)}
            </p>
        </div>
    );
}