"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, DocumentData } from "firebase/firestore";
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

type BoxType = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

type ResultType = {
    id: string;
    prediction: string;          // "Fracture" or "Normal"
    confidence: number;          // 0-1
    boxes: BoxType[];
    originalImageUrl: string;
    annotatedImageUrl: string;
    gradCamUrl: string;
    riskLevel: string;
    modelName: string;
    summary: string;
    recommendation: string;
    timestamp: string;
    filename: string;
};

function getImageSrc(url: string | undefined): string {
    if (!url) return "";
    if (url.startsWith("data:image/")) return url;
    // If it's a raw base64 string, add data prefix
    if (typeof url === "string" && /^[A-Za-z0-9+/=]+$/.test(url)) {
        return `data:image/jpeg;base64,${url}`;
    }
    return url;
}

function formatDate(timestamp?: string) {
    if (!timestamp) return "Not available";
    const date = new Date(timestamp.replace(" ", "T"));
    return isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

export default function ReportPage() {
    const router = useRouter();
    const params = useParams();

    const id = typeof params?.id === "string" ? params.id : "";

    const [user, setUser] = useState<User | null>(null);
    const [authResolved, setAuthResolved] = useState(false);
    const [result, setResult] = useState<ResultType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) {
                router.push("/auth");
                return;
            }
            setUser(firebaseUser);
            setAuthResolved(true);
        });
        return () => unsub();
    }, [router]);

    // Fetch case data
    useEffect(() => {
        if (!authResolved || !user) return;
        if (!id) {
            setError("No case ID provided.");
            setLoading(false);
            return;
        }

        const fetchCase = async () => {
            setLoading(true);
            setError("");

            try {
                const docRef = doc(db, "cases", id);
                const snap = await getDoc(docRef);

                if (!snap.exists()) {
                    setError("Case not found.");
                    setResult(null);
                    return;
                }

                const data = snap.data() as DocumentData;

                // Map fields from Firestore
                const rawResult = data.final_result || "Unknown";
                const prediction = rawResult.toLowerCase() === "fracture" ? "Fracture" : rawResult.toLowerCase() === "normal" ? "Normal" : "Unknown";

                const fractureProb = typeof data.fracture_probability === "number" ? data.fracture_probability : 0;
                const confidence = fractureProb / 100;

                const imageUrls = data.image_urls || {};
                const originalImageUrl = imageUrls.original_url || "";
                const annotatedImageUrl = imageUrls.yolo_annotated_url || "";
                const gradCamUrl = imageUrls.gradcam_overlay_url || "";

                // Convert detections to boxes
                let boxes: BoxType[] = [];
                const detections = data.detections;
                if (Array.isArray(detections)) {
                    boxes = detections.map((det: any) => ({
                        x1: det.center_x - det.width_px / 2,
                        y1: det.center_y - det.height_px / 2,
                        x2: det.center_x + det.width_px / 2,
                        y2: det.center_y + det.height_px / 2,
                    }));
                }

                const riskLevel = data.risk_level || "";
                const summary = data.summary || "";
                const recommendation = data.recommendation || "";
                const timestamp = data.timestamp || "";
                const filename = data.filename || "";

                setResult({
                    id: snap.id,
                    prediction,
                    confidence,
                    boxes,
                    originalImageUrl,
                    annotatedImageUrl,
                    gradCamUrl,
                    riskLevel,
                    modelName: "EfficientNet-B3 + YOLOv8",
                    summary,
                    recommendation,
                    timestamp,
                    filename,
                });
            } catch (err) {
                console.error("Fetch error:", err);
                setError("Failed to load report.");
            } finally {
                setLoading(false);
            }
        };

        fetchCase();
    }, [authResolved, user, id]);

    const safeBoxes = useMemo(() => result?.boxes || [], [result]);
    const originalSrc = useMemo(() => getImageSrc(result?.originalImageUrl), [result]);
    const annotatedSrc = useMemo(() => getImageSrc(result?.annotatedImageUrl), [result]);
    const gradCamSrc = useMemo(() => getImageSrc(result?.gradCamUrl), [result]);

    const riskLevel = useMemo(() => {
        if (result?.riskLevel) return result.riskLevel;
        const c = result?.confidence || 0;
        if (c >= 0.8) return "High";
        if (c >= 0.5) return "Moderate";
        return "Low";
    }, [result]);

    const downloadReport = () => {
        window.print();
    };

    if (!authResolved || loading) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
                <div className="rounded-[28px] bg-white px-8 py-6 shadow-[var(--shadow-soft)]">
                    <p className="text-[var(--primary-dark)] font-semibold text-lg">
                        Loading report...
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
                    <p className="text-red-600 font-semibold">{error || "Report not available."}</p>
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
                        <h1 className="text-xl font-bold text-[var(--primary-dark)]">MEDORA Report</h1>
                        <p className="text-sm text-[var(--text-soft)]">AI-assisted pediatric wrist fracture diagnostic report</p>
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
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-6">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" className="w-12 h-12" alt="MEDORA" />
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--foreground)]">Diagnostic Report</h2>
                            <p className="text-sm text-[var(--text-soft)] mt-1">MEDORA Clinical Decision-Support Output</p>
                        </div>
                    </div>
                    <div className="text-right text-sm text-[var(--text-soft)]">
                        <p>Report Date</p>
                        <p className="font-semibold text-[var(--foreground)] mt-1">{formatDate(result.timestamp)}</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <ReportStat icon={<FileText className="h-5 w-5" />} label="Case ID" value={result.id} />
                    <ReportStat
                        icon={<ScanLine className="h-5 w-5" />}
                        label="Prediction"
                        value={result.prediction}
                        valueClassName={result.prediction === "Fracture" ? "text-red-600" : "text-green-600"}
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
                            riskLevel === "High" ? "text-red-600" : riskLevel === "Moderate" ? "text-amber-600" : "text-emerald-600"
                        }
                    />
                </div>

                {/* Images */}
                <div className="grid lg:grid-cols-3 gap-6 mt-8">
                    <ReportImageCard title="Uploaded Radiograph" content={
                        originalSrc ? (
                            <img src={originalSrc} alt="Original" className="rounded-xl shadow w-full object-contain max-h-[320px] bg-white" />
                        ) : (
                            <EmptyReportImage text="Original image not available" />
                        )
                    } />
                    <ReportImageCard title="YOLO Annotated" content={
                        annotatedSrc ? (
                            <img src={annotatedSrc} alt="Annotated" className="rounded-xl shadow w-full object-contain max-h-[320px] bg-white" />
                        ) : (
                            <EmptyReportImage text="Annotated image not available" />
                        )
                    } />
                    <ReportImageCard title="Grad-CAM Heatmap" content={
                        gradCamSrc ? (
                            <img src={gradCamSrc} alt="Grad-CAM" className="rounded-xl shadow w-full object-contain max-h-[320px] bg-white" />
                        ) : (
                            <EmptyReportImage text="Grad-CAM heatmap not available" />
                        )
                    } />
                </div>

                {/* AI Summary + Technical Details */}
                <div className="grid lg:grid-cols-2 gap-6 mt-8">
                    <div className="rounded-2xl bg-[var(--card)] p-5">
                        <div className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-[var(--primary)]" />
                            <h3 className="text-lg font-bold text-[var(--foreground)]">AI Summary</h3>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">{result.summary}</p>
                        <div className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4">
                            <p className="text-sm font-semibold text-[var(--foreground)]">Recommendation</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{result.recommendation}</p>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-[var(--card)] p-5">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-[var(--primary)]" />
                            <h3 className="text-lg font-bold text-[var(--foreground)]">Technical Details</h3>
                        </div>
                        <div className="mt-4 space-y-4">
                            <DetailRow label="Filename" value={result.filename || "Unknown"} />
                            <DetailRow label="Model" value={result.modelName} />
                            <DetailRow label="Detected Regions" value={`${safeBoxes.length}`} />
                            <DetailRow label="Explainability" value={gradCamSrc ? "Grad-CAM + Bounding Boxes" : "Bounding Boxes"} />
                            <DetailRow label="Generated On" value={formatDate(result.timestamp)} />
                        </div>
                        <div className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-[var(--primary)]" />
                                <p className="text-sm font-semibold text-[var(--foreground)]">Medical Disclaimer</p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                                MEDORA is an AI-based clinical decision‑support system. It assists clinicians in
                                identifying potential pediatric wrist fractures and should not replace professional medical diagnosis.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bounding Box Coordinates */}
                <div className="mt-8 rounded-2xl bg-[var(--card)] p-5">
                    <h3 className="text-lg font-bold text-[var(--foreground)]">Detected Region Coordinates</h3>
                    {safeBoxes.length > 0 ? (
                        <div className="mt-4 grid gap-3">
                            {safeBoxes.map((box, index) => (
                                <div key={index} className="rounded-xl bg-white border border-[var(--border)] p-4 text-sm">
                                    <span className="font-semibold text-[var(--primary-dark)]">Region {index + 1}</span>
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
                        <p className="mt-3 text-sm text-[var(--text-soft)]">No suspicious fracture regions were localized.</p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex flex-col sm:flex-row gap-4 print:hidden">
                    <button onClick={downloadReport} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary-dark)] text-white font-semibold hover:bg-[var(--primary)]">
                        <Download className="h-4 w-4" /> Download PDF
                    </button>
                    <button onClick={() => router.push("/viewer")} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] font-semibold hover:bg-[var(--card)]">
                        <Eye className="h-4 w-4" /> Open Viewer
                    </button>
                </div>
            </div>
        </main>
    );
}

// ----- UI Components (unchanged) -----
function ReportStat({ icon, label, value, valueClassName = "text-[var(--foreground)]" }: { icon: React.ReactNode; label: string; value: string; valueClassName?: string }) {
    return (
        <div className="rounded-2xl bg-[var(--background)] border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 text-[var(--primary)]">{icon}<span className="text-sm font-medium">{label}</span></div>
            <p className={`mt-3 text-xl font-bold break-words ${valueClassName}`}>{value}</p>
        </div>
    );
}

function ReportImageCard({ title, content }: { title: string; content: React.ReactNode }) {
    return (
        <div className="rounded-2xl bg-[var(--card)] p-4">
            <h3 className="text-sm font-medium text-[var(--text-soft)] mb-3">{title}</h3>
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
            <span className="font-medium text-[var(--foreground)] text-sm text-right break-words">{value}</span>
        </div>
    );
}

function MiniCoord({ label, value }: { label: string; value: number }) {
    const safeValue = Number.isFinite(value) ? value : 0;
    return (
        <div className="rounded-lg bg-[var(--background)] border border-[var(--border)] px-3 py-2">
            <p className="text-xs text-[var(--text-soft)]">{label}</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">{safeValue.toFixed(1)}</p>
        </div>
    );
}
