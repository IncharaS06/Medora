"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
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
    ChevronRight,
} from "lucide-react";

// --- Types (same as results page) ---
type Detection = {
    bbox: number[];
    center_x: number;
    center_y: number;
    confidence: number;
    height_px: number;
    width_px: number;
    label: string;
};

type StageEfficientNet = {
    confidence_level: string;
    fracture_probability: number;
    normal_probability: number;
};

type StageYOLO = {
    detections: Detection[];
    detections_count: number;
    max_confidence: number;
    ran: boolean;
};

type ImageUrls = {
    original_url: string;
    yolo_annotated_url: string;
    gradcam_overlay_url: string;
    heatmap_url: string;
};

type AnalysisResult = {
    id: string;
    aspect_ratio: string;
    case_id: string;
    detections: Detection[];
    detections_count: number;
    file_size_kb: number;
    filename: string;
    final_result: string;
    fracture_probability: number;
    image_height: number;
    image_urls: ImageUrls;
    image_width: number;
    is_fracture: boolean;
    normal_probability: number;
    recommendation: string;
    risk_level: string;
    severity: string;
    stage1_efficientnet: StageEfficientNet;
    stage2_yolo: StageYOLO;
    summary: string;
    timestamp: string;
    yolo_confidence: number;
};

function getValidImageSrc(url: string | undefined): string {
    if (!url) return "";
    if (url.startsWith("data:image/")) return url;
    if (url.match(/^[A-Za-z0-9+/=]+$/)) {
        return `data:image/jpeg;base64,${url}`;
    }
    return url;
}

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [debugInfo, setDebugInfo] = useState("");

    // Auth
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) router.push("/auth");
            else setUser(firebaseUser);
        });
        return () => unsubscribe();
    }, [router]);

    const fetchLatestResult = async () => {
        if (!user) return;

        try {
            setError("");
            setRefreshing(true);
            setLoading(true);
            setDebugInfo("Fetching latest analysis...");

            const casesRef = collection(db, "cases");
            const snapshot = await getDocs(casesRef);
            console.log(`Dashboard: ${snapshot.size} documents found`);

            if (snapshot.empty) {
                setError("No analysis results found. Upload a scan first.");
                return;
            }

            // Find document with complete image_urls (second one in your logs)
            let bestDoc = null;
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const urls = data.image_urls;
                if (urls && urls.original_url && urls.original_url.startsWith("data:image")) {
                    bestDoc = { id: docSnap.id, data };
                    console.log("Dashboard using doc with images:", docSnap.id);
                    setDebugInfo(`Loaded: ${docSnap.id}`);
                    break;
                }
            }

            // Fallback to any doc with image_urls
            if (!bestDoc) {
                for (const docSnap of snapshot.docs) {
                    if (docSnap.data().image_urls) {
                        bestDoc = { id: docSnap.id, data: docSnap.data() };
                        console.log("Dashboard fallback doc:", docSnap.id);
                        break;
                    }
                }
            }

            // Last resort: first document
            if (!bestDoc && snapshot.docs.length > 0) {
                bestDoc = { id: snapshot.docs[0].id, data: snapshot.docs[0].data() };
                console.warn("Dashboard using first document (may lack images)");
            }

            if (bestDoc) {
                const data = bestDoc.data;
                const imageUrls = data.image_urls || {};
                const stage1 = data.stage1_efficientnet || {};
                const stage2 = data.stage2_yolo || {};

                let detections: Detection[] = [];
                if (Array.isArray(data.detections)) detections = data.detections;
                else if (stage2.detections && Array.isArray(stage2.detections)) detections = stage2.detections;

                const resultData: AnalysisResult = {
                    id: bestDoc.id,
                    aspect_ratio: data.aspect_ratio || "",
                    case_id: data.case_id || "",
                    detections,
                    detections_count: data.detections_count ?? stage2.detections_count ?? detections.length,
                    file_size_kb: data.file_size_kb || 0,
                    filename: data.filename || "",
                    final_result: data.final_result || "Unknown",
                    fracture_probability: data.fracture_probability ?? stage1.fracture_probability ?? 0,
                    image_height: data.image_height || 0,
                    image_urls: {
                        original_url: imageUrls.original_url || "",
                        yolo_annotated_url: imageUrls.yolo_annotated_url || "",
                        gradcam_overlay_url: imageUrls.gradcam_overlay_url || "",
                        heatmap_url: imageUrls.heatmap_url || "",
                    },
                    image_width: data.image_width || 0,
                    is_fracture: Boolean(data.is_fracture),
                    normal_probability: data.normal_probability ?? stage1.normal_probability ?? 0,
                    recommendation: data.recommendation || "",
                    risk_level: data.risk_level || "Unknown",
                    severity: data.severity || "",
                    stage1_efficientnet: {
                        confidence_level: stage1.confidence_level || "N/A",
                        fracture_probability: stage1.fracture_probability ?? 0,
                        normal_probability: stage1.normal_probability ?? 0,
                    },
                    stage2_yolo: {
                        detections: stage2.detections || [],
                        detections_count: stage2.detections_count ?? 0,
                        max_confidence: stage2.max_confidence ?? 0,
                        ran: stage2.ran ?? false,
                    },
                    summary: data.summary || "",
                    timestamp: data.timestamp || "",
                    yolo_confidence: data.yolo_confidence ?? stage2.max_confidence ?? 0,
                };
                setResult(resultData);
            } else {
                setError("No valid analysis document found.");
            }
        } catch (err: any) {
            console.error("Dashboard fetch error:", err);
            setError(`Error: ${err.message}`);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (user) fetchLatestResult();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const originalSrc = useMemo(() => getValidImageSrc(result?.image_urls?.original_url), [result]);
    const annotatedSrc = useMemo(() => getValidImageSrc(result?.image_urls?.yolo_annotated_url), [result]);
    const gradCamSrc = useMemo(() => getValidImageSrc(result?.image_urls?.gradcam_overlay_url), [result]);

    const handleRefresh = () => fetchLatestResult();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary-dark)] mx-auto"></div>
                    <p className="mt-4 text-sm text-[var(--text-soft)]">Loading dashboard data...</p>
                    {debugInfo && <p className="text-xs text-gray-400 mt-2">{debugInfo}</p>}
                </div>
            </div>
        );
    }

    if (error || !result) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="bg-white rounded-2xl p-8 text-center max-w-md shadow-sm border border-[var(--border)]">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-[var(--foreground)]">No Data Available</h2>
                    <p className="text-[var(--text-soft)] mt-2">{error || "No analysis results found."}</p>
                    <div className="flex gap-3 mt-6 justify-center">
                        <button
                            onClick={handleRefresh}
                            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Retry
                        </button>
                        <button
                            onClick={() => router.push("/upload")}
                            className="px-4 py-2 rounded-xl bg-[var(--primary-dark)] text-white font-semibold"
                        >
                            Upload Scan
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with refresh */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-[var(--foreground)]">Dashboard</h2>
                    <p className="text-sm text-[var(--text-soft)] mt-1">
                        Latest AI analysis overview
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="px-4 py-2 rounded-xl bg-white border border-[var(--border)] text-[var(--text-soft)] font-semibold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 transition"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* Summary Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                    icon={<Activity className="w-5 h-5" />}
                    label="Final Result"
                    value={result.final_result}
                    valueClassName={result.is_fracture ? "text-red-600" : "text-green-600"}
                />
                <SummaryCard
                    icon={<FileBarChart2 className="w-5 h-5" />}
                    label="Fracture Probability"
                    value={`${result.fracture_probability.toFixed(1)}%`}
                />
                <SummaryCard
                    icon={<AlertTriangle className="w-5 h-5" />}
                    label="Risk Level"
                    value={result.risk_level}
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
                    label="Regions Detected"
                    value={`${result.detections_count}`}
                />
            </div>

            {/* Severity Banner */}
            {result.severity && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm">
                    ⚠️ {result.severity}
                </div>
            )}

            {/* Three image previews */}
            <div className="grid lg:grid-cols-3 gap-5">
                <ImageTile title="Original X-Ray" src={originalSrc} />
                <ImageTile title="YOLO Detection" src={annotatedSrc} />
                <ImageTile title="Grad-CAM Heatmap" src={gradCamSrc} />
            </div>

            {/* AI Interpretation + Quick Actions */}
            <div className="grid md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-[var(--border)] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Brain className="w-5 h-5 text-[var(--primary)]" />
                        <h3 className="font-bold text-lg">AI Interpretation</h3>
                    </div>
                    <p className="text-sm text-[var(--foreground)] leading-relaxed">
                        {result.summary}
                    </p>
                    <div className="mt-5 pt-4 border-t border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wide">Recommendation</p>
                        <p className="text-sm mt-1">{result.recommendation}</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-[var(--border)] p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Layers className="w-5 h-5 text-[var(--primary)]" />
                        <h3 className="font-bold text-lg">Technical Summary</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <p><span className="font-semibold">Case ID:</span> {result.case_id}</p>
                        <p><span className="font-semibold">Filename:</span> {result.filename}</p>
                        <p><span className="font-semibold">Analysis Date:</span> {result.timestamp}</p>
                        <p><span className="font-semibold">EfficientNet Confidence:</span> {result.stage1_efficientnet.confidence_level}</p>
                        <p><span className="font-semibold">YOLO Max Confidence:</span> {result.yolo_confidence.toFixed(2)}%</p>
                    </div>
                    <div className="mt-5 flex justify-end">
                        <button
                            onClick={() => router.push("/results")}
                            className="text-sm font-semibold text-[var(--primary-dark)] flex items-center gap-1 hover:underline"
                        >
                            View full report <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Detection Details (if any) */}
            {result.detections.length > 0 && (
                <div className="bg-white rounded-2xl border border-[var(--border)] p-5 shadow-sm">
                    <h3 className="font-bold text-lg mb-4">Detection Details</h3>
                    <div className="grid gap-3">
                        {result.detections.map((det, idx) => (
                            <div key={idx} className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-4">
                                <div className="flex justify-between items-center flex-wrap gap-2">
                                    <span className="font-bold text-[var(--primary-dark)]">Region {idx + 1}</span>
                                    <span className="text-sm font-semibold text-red-600">{det.confidence.toFixed(1)}% confidence</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
                                    <div><span className="text-[var(--text-soft)]">Center:</span> ({det.center_x}, {det.center_y})</div>
                                    <div><span className="text-[var(--text-soft)]">Size:</span> {det.width_px}×{det.height_px} px</div>
                                    <div className="col-span-2"><span className="text-[var(--text-soft)]">BBox:</span> [{det.bbox.join(", ")}]</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Clinical disclaimer */}
            <div className="rounded-xl bg-gray-50 border border-[var(--border)] px-4 py-3 text-xs text-[var(--text-soft)] text-center">
                🧠 MEDORA is an AI decision‑support system. Final diagnosis must be validated by a radiologist or clinician.
            </div>
        </div>
    );
}

// --- Helper Components ---
function SummaryCard({ icon, label, value, valueClassName = "text-[var(--foreground)]" }: { icon: React.ReactNode; label: string; value: string; valueClassName?: string }) {
    return (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[var(--primary)]">
                {icon}
                <span className="text-sm font-medium">{label}</span>
            </div>
            <p className={`mt-3 text-2xl font-bold ${valueClassName}`}>{value}</p>
        </div>
    );
}

function ImageTile({ title, src }: { title: string; src: string }) {
    return (
        <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--background)]">
                <h3 className="font-semibold text-sm">{title}</h3>
            </div>
            <div className="p-3 flex items-center justify-center min-h-[220px] bg-gray-50">
                {src ? (
                    <img
                        src={src}
                        alt={title}
                        className="max-h-[200px] w-auto object-contain rounded"
                        onError={(e) => {
                            console.error(`Failed to load ${title}`);
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextSibling?.style?.setProperty("display", "flex");
                        }}
                        onLoad={(e) => console.log(`${title} loaded`)}
                    />
                ) : null}
                {!src && (
                    <div className="text-center text-[var(--text-soft)] text-sm">
                        <p>No image available</p>
                    </div>
                )}
                {/* Fallback div if img fails */}
                <div style={{ display: "none" }} className="text-center text-[var(--text-soft)] text-sm">
                    <p>⚠️ Failed to load image</p>
                </div>
            </div>
        </div>
    );
}
