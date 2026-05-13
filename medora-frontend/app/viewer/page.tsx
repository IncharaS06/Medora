"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    DocumentData,
} from "firebase/firestore";
import {
    ArrowLeft,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    ScanLine,
    Image as ImageIcon,
    Flame,
    Eye,
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
    prediction: string;          // from final_result
    confidence: number;          // normalized 0-1 from fracture_probability
    boxes?: RawBoxType[];        // converted from detections
    originalImageUrl: string;
    annotatedImageUrl: string;
    gradCamUrl: string;
    riskLevel?: string;          // from risk_level
    modelName?: string;
    summary?: string;
    recommendation?: string;
    timestamp?: string;
};

type ViewMode = "original" | "annotated" | "gradcam";

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

function getImageSrc(url: string | undefined): string {
    if (!url) return "";
    if (url.startsWith("data:image/")) return url;
    if (typeof url === "string" && /^[A-Za-z0-9+/=]+$/.test(url)) {
        return `data:image/jpeg;base64,${url}`;
    }
    return url;
}

function getReadableFirestoreError(err: any) {
    const code = err?.code || "";
    if (code.includes("permission-denied"))
        return "Permission denied. Check Firestore rules.";
    if (code.includes("unavailable"))
        return "Firestore is temporarily unavailable.";
    return "Failed to load viewer data.";
}

export default function ViewerPage() {
    const router = useRouter();

    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [zoom, setZoom] = useState(1);
    const [mode, setMode] = useState<ViewMode>("annotated");
    const [result, setResult] = useState<ResultType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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

    useEffect(() => {
        const fetchLatestCase = async () => {
            try {
                if (!firebaseUser) return;

                // Query all cases, order by timestamp descending, limit 1
                const q = query(
                    collection(db, "cases"),
                    orderBy("timestamp", "desc"),
                    limit(1)
                );

                const snap = await getDocs(q);

                if (snap.empty) {
                    setError("No analysis result found in database.");
                    setLoading(false);
                    return;
                }

                const docSnap = snap.docs[0];
                const data = docSnap.data() as DocumentData;

                // --- Transform backend fields to UI expected fields ---
                // 1. prediction from final_result
                const rawResult = data.final_result || "Unknown";
                const prediction =
                    rawResult.toLowerCase() === "fracture"
                        ? "Fracture"
                        : rawResult.toLowerCase() === "normal"
                        ? "Normal"
                        : "Unknown";

                // 2. confidence from fracture_probability (0-100) -> 0-1
                const fractureProb =
                    typeof data.fracture_probability === "number"
                        ? data.fracture_probability
                        : 0;
                const confidence = fractureProb / 100;

                // 3. timestamp string
                const timestamp = data.timestamp || "";

                // 4. image URLs from nested object
                const imageUrls = data.image_urls || {};
                const originalImageUrl = imageUrls.original_url || "";
                const annotatedImageUrl = imageUrls.yolo_annotated_url || "";
                const gradCamUrl = imageUrls.gradcam_overlay_url || "";

                // 5. convert detections to boxes
                let boxes: RawBoxType[] = [];
                const detections = data.detections;
                if (Array.isArray(detections)) {
                    boxes = detections.map((det: any) => ({
                        x1: det.center_x - det.width_px / 2,
                        y1: det.center_y - det.height_px / 2,
                        x2: det.center_x + det.width_px / 2,
                        y2: det.center_y + det.height_px / 2,
                    }));
                }

                // 6. risk level, summary, recommendation
                const riskLevel = data.risk_level || "";
                const summary = data.summary || "";
                const recommendation = data.recommendation || "";

                const payload: ResultType = {
                    id: docSnap.id,
                    prediction,
                    confidence,
                    boxes,
                    originalImageUrl,
                    annotatedImageUrl,
                    gradCamUrl,
                    riskLevel,
                    modelName: data.modelName || "EfficientNet-B3 + YOLOv8",
                    summary,
                    recommendation,
                    timestamp,
                };

                setResult(payload);
            } catch (err) {
                console.error("Failed to fetch viewer case:", err);
                setError(getReadableFirestoreError(err));
            } finally {
                setLoading(false);
            }
        };

        fetchLatestCase();
    }, [firebaseUser]);

    const safeBoxes = useMemo(() => normalizeBoxes(result?.boxes), [result]);

    const originalSrc = useMemo(() => getImageSrc(result?.originalImageUrl), [result]);
    const annotatedSrc = useMemo(() => getImageSrc(result?.annotatedImageUrl), [result]);
    const gradCamSrc = useMemo(() => getImageSrc(result?.gradCamUrl), [result]);

    const currentImage = useMemo(() => {
        if (mode === "original") return originalSrc;
        if (mode === "gradcam") return gradCamSrc;
        return annotatedSrc;
    }, [mode, originalSrc, gradCamSrc, annotatedSrc]);

    const currentTitle = useMemo(() => {
        if (mode === "original") return "Original Radiograph";
        if (mode === "gradcam") return "Grad-CAM Heatmap";
        return "YOLO Annotated Result";
    }, [mode]);

    const zoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 3));
    const zoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.6));
    const resetView = () => setZoom(1);

    if (loading) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
                <div className="rounded-[28px] bg-white px-8 py-6 shadow-[var(--shadow-soft)]">
                    <p className="text-[var(--primary-dark)] font-semibold text-lg">
                        Loading viewer...
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
                        {error || "Viewer data not available."}
                    </p>
                    <button
                        onClick={() => router.push("/upload")}
                        className="mt-4 rounded-xl bg-[var(--primary-dark)] px-5 py-2.5 text-white font-semibold"
                    >
                        Go to Upload
                    </button>
                </div>
            </main>
        );
    }

    const computedRisk =
        result.riskLevel ||
        (result.confidence >= 0.8
            ? "High"
            : result.confidence >= 0.5
            ? "Moderate"
            : "Low");

    return (
        <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="MEDORA" className="w-10 h-10" />
                    <div>
                        <h1 className="text-xl font-bold text-[var(--primary-dark)]">
                            MEDORA Viewer
                        </h1>
                        <p className="text-sm text-[var(--text-soft)]">
                            Interactive radiology image viewer
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => router.push("/dashboard")}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary-dark)] text-white font-semibold hover:bg-[var(--primary)]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Dashboard
                </button>
            </div>

            <div className="max-w-7xl mx-auto mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
                <div className="bg-white rounded-[28px] p-5 sm:p-8 shadow-[var(--shadow-card)]">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
                                Radiology Viewer
                            </h2>
                            <p className="mt-1 text-sm text-[var(--text-soft)]">
                                Inspect original, annotated, and explainability outputs.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setMode("original")}
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border ${
                                    mode === "original"
                                        ? "bg-[var(--primary-dark)] text-white border-[var(--primary-dark)]"
                                        : "bg-white text-[var(--foreground)] border-[var(--border)]"
                                }`}
                            >
                                <ImageIcon className="h-4 w-4" />
                                Original
                            </button>

                            <button
                                onClick={() => setMode("annotated")}
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border ${
                                    mode === "annotated"
                                        ? "bg-[var(--primary-dark)] text-white border-[var(--primary-dark)]"
                                        : "bg-white text-[var(--foreground)] border-[var(--border)]"
                                }`}
                            >
                                <ScanLine className="h-4 w-4" />
                                Annotated
                            </button>

                            <button
                                onClick={() => setMode("gradcam")}
                                disabled={!gradCamSrc}
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border disabled:opacity-50 ${
                                    mode === "gradcam"
                                        ? "bg-[var(--primary-dark)] text-white border-[var(--primary-dark)]"
                                        : "bg-white text-[var(--foreground)] border-[var(--border)]"
                                }`}
                            >
                                <Flame className="h-4 w-4" />
                                Grad-CAM
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            onClick={zoomIn}
                            className="inline-flex items-center gap-2 px-4 py-2 border rounded-xl bg-white hover:bg-[var(--card)]"
                        >
                            <ZoomIn className="h-4 w-4" />
                            Zoom In
                        </button>

                        <button
                            onClick={zoomOut}
                            className="inline-flex items-center gap-2 px-4 py-2 border rounded-xl bg-white hover:bg-[var(--card)]"
                        >
                            <ZoomOut className="h-4 w-4" />
                            Zoom Out
                        </button>

                        <button
                            onClick={resetView}
                            className="inline-flex items-center gap-2 px-4 py-2 border rounded-xl bg-white hover:bg-[var(--card)]"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Reset
                        </button>

                        <div className="inline-flex items-center px-4 py-2 rounded-xl bg-[var(--card)] text-sm font-medium text-[var(--foreground)]">
                            Zoom: {(zoom * 100).toFixed(0)}%
                        </div>
                    </div>

                    <div className="mt-6">
                        <p className="text-sm font-medium text-[var(--text-soft)]">
                            Current View
                        </p>
                        <h3 className="text-lg font-bold text-[var(--foreground)] mt-1">
                            {currentTitle}
                        </h3>
                    </div>

                    <div className="mt-6 rounded-[24px] bg-[var(--card)] p-4 sm:p-6 overflow-auto">
                        <div className="min-h-[320px] sm:min-h-[520px] flex items-center justify-center">
                            {currentImage ? (
                                <img
                                    src={currentImage}
                                    alt={currentTitle}
                                    style={{
                                        transform: `scale(${zoom})`,
                                        transformOrigin: "center center",
                                    }}
                                    className="transition duration-300 rounded-xl shadow max-w-full object-contain bg-white"
                                />
                            ) : (
                                <div className="rounded-xl border border-[var(--border)] bg-white min-h-[220px] w-full flex items-center justify-center text-sm text-[var(--text-soft)]">
                                    Image not available for this mode
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl bg-[var(--card)] p-4">
                        <div className="flex items-start gap-3">
                            <Eye className="h-5 w-5 text-[var(--primary)] mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-[var(--foreground)]">
                                    Viewer Guidance
                                </h3>
                                <p className="mt-1 text-sm leading-6 text-[var(--text-soft)]">
                                    Use the original view to inspect the raw radiograph, the annotated
                                    view to inspect YOLO localization, and the Grad-CAM view to examine
                                    classifier attention. These outputs support clinical review and are
                                    not a substitute for professional diagnosis.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-[var(--shadow-card)] h-fit">
                    <h3 className="text-lg font-bold text-[var(--foreground)]">
                        Case Summary
                    </h3>

                    <div className="mt-5 space-y-4">
                        <SideStat
                            label="Prediction"
                            value={result.prediction}
                            valueClassName={
                                result.prediction === "Fracture"
                                    ? "text-red-600"
                                    : "text-green-600"
                            }
                        />

                        <SideStat
                            label="Confidence"
                            value={`${((result.confidence || 0) * 100).toFixed(1)}%`}
                        />

                        <SideStat
                            label="Detected Regions"
                            value={`${safeBoxes.length}`}
                        />

                        <SideStat
                            label="Risk Level"
                            value={computedRisk}
                            valueClassName={
                                computedRisk === "High"
                                    ? "text-red-600"
                                    : computedRisk === "Moderate"
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                            }
                        />
                    </div>

                    <div className="mt-6 rounded-2xl bg-[var(--card)] p-4">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                            Detection Boxes
                        </p>

                        {safeBoxes.length > 0 ? (
                            <div className="mt-3 space-y-3">
                                {safeBoxes.map((box, index) => (
                                    <div
                                        key={index}
                                        className="rounded-xl border border-[var(--border)] bg-white p-3"
                                    >
                                        <p className="text-sm font-semibold text-[var(--primary-dark)]">
                                            Region {index + 1}
                                        </p>
                                        <p className="mt-2 text-xs text-[var(--text-soft)]">
                                            x1: {box.x1.toFixed(1)} | y1: {box.y1.toFixed(1)}
                                        </p>
                                        <p className="text-xs text-[var(--text-soft)]">
                                            x2: {box.x2.toFixed(1)} | y2: {box.y2.toFixed(1)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-3 text-sm text-[var(--text-soft)]">
                                No localized regions available.
                            </p>
                        )}
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            onClick={() => router.push("/history")}
                            className="rounded-xl bg-[var(--primary-dark)] px-4 py-3 text-white font-semibold hover:bg-[var(--primary)]"
                        >
                            Back to History
                        </button>

                        <button
                            onClick={() => router.push("/upload")}
                            className="rounded-xl border border-[var(--border)] px-4 py-3 font-semibold text-[var(--foreground)] hover:bg-[var(--card)]"
                        >
                            Analyze Another
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}

function SideStat({
    label,
    value,
    valueClassName = "text-[var(--foreground)]",
}: {
    label: string;
    value: string;
    valueClassName?: string;
}) {
    return (
        <div className="rounded-2xl bg-[var(--card)] p-4">
            <p className="text-sm text-[var(--text-soft)]">{label}</p>
            <p className={`mt-2 text-xl font-bold ${valueClassName}`}>{value}</p>
        </div>
    );
}


              
