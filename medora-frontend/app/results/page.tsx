"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

import {
    collection,
    getDocs,
    query,
    limit,
    where,
    orderBy,
} from "firebase/firestore";

import {
    Activity,
    AlertTriangle,
    Brain,
    CalendarDays,
    FileBarChart2,
    ScanLine,
    ShieldAlert,
    Layers,
    RefreshCw,
} from "lucide-react";

type DetectionType = {
    bbox?: number[];
    center_x?: number;
    center_y?: number;
    confidence?: number;
    height_px?: number;
    width_px?: number;
    label?: string;
};

type StageEfficientNet = {
    confidence_level?: string;
    fracture_probability?: number;
    normal_probability?: number;
};

type StageYOLO = {
    detections?: DetectionType[];
    detections_count?: number;
    max_confidence?: number;
    ran?: boolean;
};

type ResultType = {
    id?: string;
    case_id?: string;
    filename?: string;
    aspect_ratio?: string;
    final_result?: string;
    fracture_probability?: number;
    normal_probability?: number;
    risk_level?: string;
    severity?: string;
    detections?: DetectionType[];
    detections_count?: number;
    image_width?: number;
    image_height?: number;
    recommendation?: string;
    summary?: string;
    timestamp?: string;
    yolo_confidence?: number;
    file_size_kb?: number;
    is_fracture?: boolean;
    originalImageBase64?: string;
    annotatedImageBase64?: string;
    gradCamBase64?: string;
    stage1_efficientnet?: StageEfficientNet;
    stage2_yolo?: StageYOLO;
};

function getImageSrc(value?: string) {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("data:image/")) return trimmed;
    const looksLikeBase64 =
        trimmed.length > 100 &&
        !trimmed.includes("http://") &&
        !trimmed.includes("https://");
    if (looksLikeBase64) {
        return `data:image/jpeg;base64,${trimmed}`;
    }
    return "";
}

function getReadableFirestoreError(err: any) {
    const code = err?.code || "";
    if (code.includes("permission-denied")) {
        return "Permission denied. Check Firestore rules.";
    }
    if (code.includes("failed-precondition")) {
        return "Missing Firestore index. Create the required index.";
    }
    return "Failed to load analysis result.";
}

export default function ResultsPage() {
    const router = useRouter();
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [result, setResult] = useState<ResultType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) {
                router.push("/auth");
                return;
            }
            setFirebaseUser(user);
        });
        return () => unsub();
    }, [router]);

    const fetchLatestResult = async () => {
        if (!firebaseUser) return;
        try {
            setError("");
            setRefreshing(true);

            // First try with userId
            let q = query(
                collection(db, "cases"),
                where("userId", "==", firebaseUser.uid),
                orderBy("timestamp", "desc"),
                limit(1)
            );
            let snap = await getDocs(q);

            // If no results, try userEmail
            if (snap.empty && firebaseUser.email) {
                console.warn("No cases with userId, trying userEmail");
                q = query(
                    collection(db, "cases"),
                    where("userEmail", "==", firebaseUser.email),
                    orderBy("timestamp", "desc"),
                    limit(1)
                );
                snap = await getDocs(q);
            }

            if (snap.empty) {
                setError("No analysis result found. Please upload a scan first.");
                setResult(null);
                return;
            }

            const docSnap = snap.docs[0];
            const data = docSnap.data();

            const stage1 = data.stage1_efficientnet as StageEfficientNet | undefined;
            const stage2 = data.stage2_yolo as StageYOLO | undefined;

            let detections: DetectionType[] = [];
            if (Array.isArray(data.detections)) {
                detections = data.detections;
            } else if (stage2?.detections && Array.isArray(stage2.detections)) {
                detections = stage2.detections;
            }

            const detectionsCount = data.detections_count ?? stage2?.detections_count ?? detections.length;
            const yoloConfidence = data.yolo_confidence ?? stage2?.max_confidence ?? 0;

            const payload: ResultType = {
                id: docSnap.id,
                case_id: data.case_id || "",
                filename: data.filename || "",
                aspect_ratio: data.aspect_ratio || "",
                final_result: data.final_result || "Unknown",
                fracture_probability: typeof data.fracture_probability === "number" ? data.fracture_probability : (stage1?.fracture_probability ?? 0),
                normal_probability: typeof data.normal_probability === "number" ? data.normal_probability : (stage1?.normal_probability ?? 0),
                risk_level: data.risk_level || "Unknown",
                severity: data.severity || "",
                detections: detections,
                detections_count: detectionsCount,
                image_width: typeof data.image_width === "number" ? data.image_width : 0,
                image_height: typeof data.image_height === "number" ? data.image_height : 0,
                recommendation: data.recommendation || "",
                summary: data.summary || "",
                timestamp: data.timestamp || "",
                yolo_confidence: yoloConfidence,
                file_size_kb: typeof data.file_size_kb === "number" ? data.file_size_kb : 0,
                is_fracture: Boolean(data.is_fracture),
                originalImageBase64: data.originalImageBase64 || "",
                annotatedImageBase64: data.annotatedImageBase64 || "",
                gradCamBase64: data.gradCamBase64 || "",
                stage1_efficientnet: stage1,
                stage2_yolo: stage2,
            };

            setResult(payload);
        } catch (err) {
            console.error("Fetch error:", err);
            setError(getReadableFirestoreError(err));
            setResult(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchLatestResult();
    }, [firebaseUser]);

    const originalSrc = useMemo(() => getImageSrc(result?.originalImageBase64), [result]);
    const annotatedSrc = useMemo(() => getImageSrc(result?.annotatedImageBase64), [result]);
    const gradCamSrc = useMemo(() => getImageSrc(result?.gradCamBase64), [result]);
    const detections = result?.detections || [];

    const handleRefresh = () => {
        fetchLatestResult();
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="bg-white rounded-3xl px-8 py-6 shadow-lg">
                    <p className="font-semibold text-lg text-[var(--primary-dark)]">
                        Loading results...
                    </p>
                    <div className="mt-4 h-2 w-56 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full bg-[var(--primary)] animate-progress-loading rounded-full" />
                    </div>
                </div>
            </main>
        );
    }

    if (error || !result) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
                <div className="bg-white rounded-3xl p-8 shadow-lg text-center max-w-md">
                    <p className="text-red-600 font-semibold">
                        {error || "Result not available"}
                    </p>
                    <button
                        onClick={() => router.push("/upload")}
                        className="mt-5 px-5 py-2 rounded-xl bg-[var(--primary-dark)] text-white font-semibold"
                    >
                        Go to Upload
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="MEDORA" className="w-10 h-10" />
                    <h1 className="text-2xl font-bold text-[var(--primary-dark)]">
                        MEDORA Results
                    </h1>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="px-4 py-2 rounded-xl bg-[var(--primary-dark)] text-white font-semibold"
                    >
                        Dashboard
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto mt-8 bg-white rounded-[30px] p-6 sm:p-8 shadow-[var(--shadow-card)]">
                <div>
                    <h2 className="text-3xl font-bold text-[var(--foreground)]">
                        Pediatric Wrist Fracture Analysis
                    </h2>
                    <p className="mt-2 text-[var(--text-soft)]">
                        AI-assisted fracture detection with two‑stage pipeline (EfficientNet‑B3 + YOLOv8).
                    </p>
                </div>

                {/* SUMMARY CARDS */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                    <SummaryCard
                        icon={<Activity className="w-5 h-5" />}
                        label="Final Result"
                        value={result.final_result || "Unknown"}
                        valueClassName={result.is_fracture ? "text-red-600" : "text-green-600"}
                    />
                    <SummaryCard
                        icon={<FileBarChart2 className="w-5 h-5" />}
                        label="Fracture Probability"
                        value={`${result.fracture_probability?.toFixed(1) ?? 0}%`}
                    />
                    <SummaryCard
                        icon={<AlertTriangle className="w-5 h-5" />}
                        label="Risk Level"
                        value={result.risk_level || "Unknown"}
                        valueClassName={
                            result.risk_level === "High"
                                ? "text-red-600"
                                : result.risk_level === "Moderate"
                                ? "text-amber-600"
                                : "text-emerald-600"
                        }
                    />
                    <SummaryCard
                        icon={<ScanLine className="w-5 h-5" />}
                        label="Detections"
                        value={`${result.detections_count || 0}`}
                    />
                </div>

                {/* SEVERITY */}
                {result.severity && (
                    <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm">
                        ⚠️ {result.severity}
                    </div>
                )}

                {/* IMAGES */}
                <div className="grid lg:grid-cols-3 gap-6 mt-8">
                    <ImagePanel
                        title="Uploaded Image"
                        content={
                            originalSrc ? (
                                <img src={originalSrc} alt="Original" className="rounded-2xl shadow w-full object-contain max-h-[420px]" />
                            ) : (
                                <EmptyImageMessage text="Original image not available" />
                            )
                        }
                    />
                    <ImagePanel
                        title="YOLO Annotated Image"
                        content={
                            annotatedSrc ? (
                                <img src={annotatedSrc} alt="Annotated" className="rounded-2xl shadow w-full object-contain max-h-[420px]" />
                            ) : (
                                <EmptyImageMessage text="Annotated image not available" />
                            )
                        }
                    />
                    <ImagePanel
                        title="Grad-CAM Heatmap"
                        content={
                            gradCamSrc ? (
                                <img src={gradCamSrc} alt="Gradcam" className="rounded-2xl shadow w-full object-contain max-h-[420px]" />
                            ) : (
                                <EmptyImageMessage text="Grad-CAM not available" />
                            )
                        }
                    />
                </div>

                {/* AI INTERPRETATION + TECHNICAL DETAILS */}
                <div className="grid lg:grid-cols-2 gap-6 mt-8">
                    <div className="rounded-3xl bg-[var(--card)] p-6">
                        <div className="flex items-center gap-2">
                            <Brain className="w-5 h-5 text-[var(--primary)]" />
                            <h3 className="text-xl font-bold">AI Interpretation</h3>
                        </div>
                        <p className="mt-5 text-sm leading-7 text-[var(--foreground)]">
                            {result.summary || "Suspicious fracture detected in wrist radiograph."}
                        </p>
                        <div className="mt-6 rounded-2xl bg-white border border-[var(--border)] p-5">
                            <p className="font-semibold">Recommendation</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                                {result.recommendation || "Clinical review recommended."}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-3xl bg-[var(--card)] p-6">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-[var(--primary)]" />
                            <h3 className="text-xl font-bold">Technical Details</h3>
                        </div>
                        <div className="mt-5 space-y-4">
                            <DetailRow label="Case ID" value={result.case_id || "N/A"} />
                            <DetailRow label="Filename" value={result.filename || "N/A"} />
                            <DetailRow label="Timestamp" value={result.timestamp || "N/A"} />
                            <DetailRow label="Aspect Ratio" value={result.aspect_ratio || "N/A"} />
                            <DetailRow label="Image Size" value={`${result.image_width} × ${result.image_height}`} />
                            <DetailRow label="File Size" value={`${result.file_size_kb} KB`} />
                            <DetailRow label="Normal Probability" value={`${result.normal_probability?.toFixed(2) ?? 0}%`} />
                            <DetailRow label="YOLO Max Confidence" value={`${result.yolo_confidence?.toFixed(2) ?? 0}%`} />
                        </div>

                        {/* Two-stage pipeline summary */}
                        <div className="mt-6 rounded-2xl bg-white border border-[var(--border)] p-5">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-[var(--primary)]" />
                                <p className="font-semibold text-sm">Two‑Stage Pipeline</p>
                            </div>
                            <div className="mt-3 text-sm text-[var(--text-soft)] space-y-1">
                                <p>📊 EfficientNet‑B3: {result.stage1_efficientnet?.confidence_level || "N/A"} confidence</p>
                                <p>🎯 YOLOv8: {result.detections_count} region{result.detections_count !== 1 ? "s" : ""} localized</p>
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl bg-white border border-[var(--border)] p-5">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-[var(--primary)]" />
                                <p className="font-semibold text-sm">Clinical Note</p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                                MEDORA is an AI decision-support system. Final diagnosis must be validated by a radiologist or clinician.
                            </p>
                        </div>
                    </div>
                </div>

                {/* DETECTION DETAILS */}
                <div className="mt-8 rounded-3xl bg-[var(--card)] p-6">
                    <h3 className="text-xl font-bold text-[var(--foreground)]">Detection Details</h3>
                    {detections.length > 0 ? (
                        <div className="mt-5 grid gap-4">
                            {detections.map((det, index) => (
                                <div key={index} className="bg-white rounded-2xl border border-[var(--border)] p-5">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <h4 className="font-bold text-[var(--primary-dark)]">Region {index + 1}</h4>
                                        <span className="text-sm font-semibold text-red-600">{det.confidence?.toFixed(2) || 0}%</span>
                                    </div>
                                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                                        <MiniDetail label="Center X" value={`${det.center_x ?? 0}`} />
                                        <MiniDetail label="Center Y" value={`${det.center_y ?? 0}`} />
                                        <MiniDetail label="Width" value={`${det.width_px ?? 0}px`} />
                                        <MiniDetail label="Height" value={`${det.height_px ?? 0}px`} />
                                    </div>
                                    {det.bbox && (
                                        <div className="mt-4 rounded-xl bg-[var(--background)] border border-[var(--border)] p-4">
                                            <p className="text-xs text-[var(--text-soft)]">Bounding Box</p>
                                            <p className="mt-1 text-sm font-medium break-all">
                                                [{det.bbox.join(", ")}]
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-[var(--text-soft)]">No detections available.</p>
                    )}
                </div>

                {/* ACTIONS */}
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                    <button onClick={() => router.push("/upload")} className="px-5 py-3 rounded-2xl border border-[var(--border)] bg-white font-medium">
                        Analyze Another
                    </button>
                    <button onClick={() => window.print()} className="px-5 py-3 rounded-2xl bg-[var(--primary-dark)] text-white font-semibold">
                        Download Report
                    </button>
                </div>
            </div>
        </main>
    );
}

// ---------- UI Components (unchanged) ----------
function SummaryCard({ icon, label, value, valueClassName = "text-[var(--foreground)]" }: { icon: React.ReactNode; label: string; value: string; valueClassName?: string }) {
    return (
        <div className="rounded-2xl bg-[var(--background)] border border-[var(--border)] p-5">
            <div className="flex items-center gap-2 text-[var(--primary)]">
                {icon}
                <span className="text-sm font-medium">{label}</span>
            </div>
            <p className={`mt-4 text-2xl font-bold ${valueClassName}`}>{value}</p>
        </div>
    );
}

function ImagePanel({ title, content }: { title: string; content: React.ReactNode }) {
    return (
        <div className="rounded-3xl bg-[var(--card)] p-5">
            <h3 className="text-sm font-medium text-[var(--text-soft)] mb-4">{title}</h3>
            {content}
        </div>
    );
}

function EmptyImageMessage({ text }: { text: string }) {
    return (
        <div className="min-h-[250px] rounded-2xl border border-[var(--border)] bg-white flex items-center justify-center text-center px-4 text-sm text-[var(--text-soft)]">
            {text}
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
            <span className="text-[var(--text-soft)]">{label}</span>
            <span className="font-medium text-right break-all">{value}</span>
        </div>
    );
}

function MiniDetail({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
            <p className="text-xs text-[var(--text-soft)]">{label}</p>
            <p className="mt-1 font-semibold text-sm">{value}</p>
        </div>
    );
}
