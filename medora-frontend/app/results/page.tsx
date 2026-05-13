"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, getDoc, doc, query, orderBy, limit } from "firebase/firestore";
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

// --- Exact types from your Firestore document ---
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

// Helper: ensure data URL is valid
function getValidImageSrc(url: string | undefined): string {
    if (!url) return "";
    if (url.startsWith("data:image/")) return url;
    if (url.match(/^[A-Za-z0-9+/=]+$/)) {
        return `data:image/jpeg;base64,${url}`;
    }
    return url;
}

export default function ResultsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const caseIdParam = searchParams.get("case_id");

    const [user, setUser] = useState<User | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string>("");

    // Auth
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (!firebaseUser) router.push("/auth");
            else setUser(firebaseUser);
        });
        return () => unsubscribe();
    }, [router]);

    // Process a single document
    const processDocument = (docId: string, data: any) => {
        console.log("Processing document:", docId);
        console.log("Data keys:", Object.keys(data));
        
        const imageUrls = data.image_urls || {};
        console.log("Image URLs object:", imageUrls);
        
        if (!imageUrls.original_url) {
            console.warn("No original_url found in document");
        }
        if (!imageUrls.yolo_annotated_url) {
            console.warn("No yolo_annotated_url found");
        }
        if (!imageUrls.gradcam_overlay_url) {
            console.warn("No gradcam_overlay_url found");
        }

        const stage1 = data.stage1_efficientnet || {};
        const stage2 = data.stage2_yolo || {};

        let detections: Detection[] = [];
        if (Array.isArray(data.detections)) detections = data.detections;
        else if (stage2.detections && Array.isArray(stage2.detections)) detections = stage2.detections;

        const resultData: AnalysisResult = {
            id: docId,
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
        setDebugInfo(`✅ Loaded document: ${docId}`);
    };

    // Fetch the specific document by case_id or the most recent one with image_urls
    const fetchLatestResult = async () => {
        if (!user) return;

        try {
            setError("");
            setRefreshing(true);
            setLoading(true);
            setDebugInfo("Fetching documents from server...");

            // First, try to get by case_id if provided (force server)
            if (caseIdParam) {
                setDebugInfo(`Looking for case_id: ${caseIdParam}`);
                const docRef = doc(db, "cases", caseIdParam);
                const docSnap = await getDoc(docRef, { source: 'server' });
                if (docSnap.exists()) {
                    processDocument(docSnap.id, docSnap.data());
                    return;
                } else {
                    setDebugInfo(`Document with case_id ${caseIdParam} not found, falling back to full scan`);
                }
            }

            // Get most recent documents (ordered by timestamp desc) and pick first with valid image_urls
            const casesRef = collection(db, "cases");
            const q = query(casesRef, orderBy("timestamp", "desc"), limit(20));
            const snapshot = await getDocs(q, { source: 'server' });
            console.log(`Total docs in recent query: ${snapshot.size}`);
            setDebugInfo(`Fetched ${snapshot.size} most recent documents`);

            if (snapshot.empty) {
                setError("No analysis results found.");
                return;
            }

            // Find the newest document that has image_urls with actual data
            let bestDoc = null;
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const urls = data.image_urls;
                if (urls && urls.original_url && urls.original_url.length > 0) {
                    bestDoc = { id: docSnap.id, data };
                    console.log("Found document with valid image URLs:", docSnap.id);
                    setDebugInfo(`Using most recent document with images: ${docSnap.id}`);
                    break;
                }
            }

            // Fallback to any document that has any image_urls
            if (!bestDoc) {
                for (const docSnap of snapshot.docs) {
                    const data = docSnap.data();
                    if (data.image_urls && data.image_urls.original_url) {
                        bestDoc = { id: docSnap.id, data };
                        console.log("Fallback to document with some image URLs:", docSnap.id);
                        setDebugInfo(`Fallback document: ${docSnap.id}`);
                        break;
                    }
                }
            }

            // Last resort: first document in the list (most recent)
            if (!bestDoc && snapshot.docs.length > 0) {
                bestDoc = { id: snapshot.docs[0].id, data: snapshot.docs[0].data() };
                console.warn("No document with image_urls found, using first document");
                setDebugInfo(`Using first document (may lack images): ${bestDoc.id}`);
            }

            if (bestDoc) {
                processDocument(bestDoc.id, bestDoc.data);
            } else {
                setError("No valid document found.");
            }
        } catch (err: any) {
            console.error("Fetch error:", err);
            setError(`Firestore error: ${err.message}`);
            setDebugInfo(`Error: ${err.message}`);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (user) fetchLatestResult();
    }, [user, caseIdParam]);

    // Memoized image sources with validation
    const originalSrc = useMemo(() => getValidImageSrc(result?.image_urls?.original_url), [result]);
    const annotatedSrc = useMemo(() => getValidImageSrc(result?.image_urls?.yolo_annotated_url), [result]);
    const gradCamSrc = useMemo(() => getValidImageSrc(result?.image_urls?.gradcam_overlay_url), [result]);

    console.log("Original URL length:", originalSrc?.length);
    console.log("Annotated URL length:", annotatedSrc?.length);
    console.log("GradCAM URL length:", gradCamSrc?.length);

    const handleRefresh = () => fetchLatestResult();

    if (loading) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="bg-white rounded-3xl px-8 py-6 shadow-lg text-center">
                    <p className="font-semibold text-lg text-[var(--primary-dark)]">Loading results...</p>
                    <div className="mt-4 h-2 w-56 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full bg-[var(--primary)] animate-progress-loading rounded-full" />
                    </div>
                    {debugInfo && <p className="mt-4 text-xs text-gray-400">{debugInfo}</p>}
                </div>
            </main>
        );
    }

    if (error || !result) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
                <div className="bg-white rounded-3xl p-8 shadow-lg text-center max-w-md">
                    <p className="text-red-600 font-semibold mb-2">{error || "Result not available"}</p>
                    {debugInfo && <p className="text-xs text-gray-500 mb-4">Debug: {debugInfo}</p>}
                    <button onClick={() => router.push("/upload")} className="px-5 py-2 rounded-xl bg-[var(--primary-dark)] text-white font-semibold">
                        Go to Upload
                    </button>
                    <button onClick={handleRefresh} className="ml-3 px-5 py-2 rounded-xl border border-gray-300 bg-white font-semibold">
                        Retry
                    </button>
                </div>
            </main>
        );
    }

    // ------------------------------
    // Success UI (completely unchanged)
    // ------------------------------
    return (
        <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="MEDORA" className="w-10 h-10" />
                    <h1 className="text-2xl font-bold text-[var(--primary-dark)]">MEDORA Results</h1>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleRefresh} disabled={refreshing} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
                    </button>
                    <button onClick={() => router.push("/dashboard")} className="px-4 py-2 rounded-xl bg-[var(--primary-dark)] text-white font-semibold">
                        Dashboard
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto mt-8 bg-white rounded-[30px] p-6 sm:p-8 shadow-[var(--shadow-card)]">
                <div>
                    <h2 className="text-3xl font-bold text-[var(--foreground)]">Pediatric Wrist Fracture Analysis</h2>
                    <p className="mt-2 text-[var(--text-soft)]">AI-assisted fracture detection with two‑stage pipeline (EfficientNet‑B3 + YOLOv8).</p>
                    {debugInfo && <p className="mt-2 text-xs text-gray-400">{debugInfo}</p>}
                </div>

                {/* Summary Cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                    <SummaryCard icon={<Activity className="w-5 h-5" />} label="Final Result" value={result.final_result} valueClassName={result.is_fracture ? "text-red-600" : "text-green-600"} />
                    <SummaryCard icon={<FileBarChart2 className="w-5 h-5" />} label="Fracture Probability" value={`${result.fracture_probability.toFixed(1)}%`} />
                    <SummaryCard icon={<AlertTriangle className="w-5 h-5" />} label="Risk Level" value={result.risk_level} valueClassName={result.risk_level === "High" ? "text-red-600" : result.risk_level === "Moderate" ? "text-amber-600" : "text-emerald-600"} />
                    <SummaryCard icon={<ScanLine className="w-5 h-5" />} label="Detections" value={`${result.detections_count}`} />
                </div>

                {result.severity && <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm">⚠️ {result.severity}</div>}

                {/* Images */}
                <div className="grid lg:grid-cols-3 gap-6 mt-8">
                    <ImagePanel title="Uploaded Image">
                        {originalSrc ? (
                            <img 
                                src={originalSrc} 
                                alt="Original X-ray" 
                                className="rounded-2xl shadow w-full object-contain max-h-[420px]" 
                                onError={(e) => {
                                    console.error("Original image failed to load. URL starts with:", originalSrc.substring(0, 50));
                                    e.currentTarget.src = "";
                                    e.currentTarget.alt = "Image failed to load";
                                }}
                                onLoad={() => console.log("Original image loaded successfully")}
                            />
                        ) : (
                            <EmptyImageMessage text="Original image URL missing" />
                        )}
                    </ImagePanel>

                    <ImagePanel title="YOLO Annotated Image">
                        {annotatedSrc ? (
                            <img 
                                src={annotatedSrc} 
                                alt="YOLO detections" 
                                className="rounded-2xl shadow w-full object-contain max-h-[420px]" 
                                onError={(e) => {
                                    console.error("YOLO image failed to load. URL starts with:", annotatedSrc.substring(0, 50));
                                    e.currentTarget.src = "";
                                }}
                                onLoad={() => console.log("YOLO image loaded successfully")}
                            />
                        ) : (
                            <EmptyImageMessage text="YOLO annotated image not available" />
                        )}
                    </ImagePanel>

                    <ImagePanel title="Grad‑CAM Heatmap">
                        {gradCamSrc ? (
                            <img 
                                src={gradCamSrc} 
                                alt="Grad-CAM heatmap" 
                                className="rounded-2xl shadow w-full object-contain max-h-[420px]" 
                                onError={(e) => {
                                    console.error("GradCAM image failed to load. URL starts with:", gradCamSrc.substring(0, 50));
                                    e.currentTarget.src = "";
                                }}
                                onLoad={() => console.log("GradCAM image loaded successfully")}
                            />
                        ) : (
                            <EmptyImageMessage text="Grad‑CAM heatmap not available" />
                        )}
                    </ImagePanel>
                </div>

                {/* AI Interpretation + Technical Details */}
                <div className="grid lg:grid-cols-2 gap-6 mt-8">
                    <div className="rounded-3xl bg-[var(--card)] p-6">
                        <div className="flex items-center gap-2"><Brain className="w-5 h-5 text-[var(--primary)]" /><h3 className="text-xl font-bold">AI Interpretation</h3></div>
                        <p className="mt-5 text-sm leading-7 text-[var(--foreground)]">{result.summary}</p>
                        <div className="mt-6 rounded-2xl bg-white border border-[var(--border)] p-5">
                            <p className="font-semibold">Recommendation</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{result.recommendation}</p>
                        </div>
                    </div>
                    <div className="rounded-3xl bg-[var(--card)] p-6">
                        <div className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[var(--primary)]" /><h3 className="text-xl font-bold">Technical Details</h3></div>
                        <div className="mt-5 space-y-4">
                            <DetailRow label="Case ID" value={result.case_id} />
                            <DetailRow label="Filename" value={result.filename} />
                            <DetailRow label="Timestamp" value={result.timestamp} />
                            <DetailRow label="Aspect Ratio" value={result.aspect_ratio} />
                            <DetailRow label="Image Size" value={`${result.image_width} × ${result.image_height}`} />
                            <DetailRow label="File Size" value={`${result.file_size_kb} KB`} />
                            <DetailRow label="Normal Probability" value={`${result.normal_probability.toFixed(2)}%`} />
                            <DetailRow label="YOLO Max Confidence" value={`${result.yolo_confidence.toFixed(2)}%`} />
                        </div>
                        <div className="mt-6 rounded-2xl bg-white border border-[var(--border)] p-5">
                            <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-[var(--primary)]" /><p className="font-semibold text-sm">Two‑Stage Pipeline</p></div>
                            <div className="mt-3 text-sm text-[var(--text-soft)] space-y-1">
                                <p>📊 EfficientNet‑B3: {result.stage1_efficientnet.confidence_level} confidence</p>
                                <p>🎯 YOLOv8: {result.detections_count} region{result.detections_count !== 1 ? "s" : ""} localized</p>
                            </div>
                        </div>
                        <div className="mt-6 rounded-2xl bg-white border border-[var(--border)] p-5">
                            <div className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-[var(--primary)]" /><p className="font-semibold text-sm">Clinical Note</p></div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">MEDORA is an AI decision‑support system. Final diagnosis must be validated by a radiologist or clinician.</p>
                        </div>
                    </div>
                </div>

                {/* Detection Details */}
                <div className="mt-8 rounded-3xl bg-[var(--card)] p-6">
                    <h3 className="text-xl font-bold text-[var(--foreground)]">Detection Details</h3>
                    {result.detections.length > 0 ? (
                        <div className="mt-5 grid gap-4">
                            {result.detections.map((det, idx) => (
                                <div key={idx} className="bg-white rounded-2xl border border-[var(--border)] p-5">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <h4 className="font-bold text-[var(--primary-dark)]">Region {idx + 1}</h4>
                                        <span className="text-sm font-semibold text-red-600">{det.confidence.toFixed(2)}%</span>
                                    </div>
                                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                                        <MiniDetail label="Center X" value={det.center_x.toString()} />
                                        <MiniDetail label="Center Y" value={det.center_y.toString()} />
                                        <MiniDetail label="Width" value={`${det.width_px}px`} />
                                        <MiniDetail label="Height" value={`${det.height_px}px`} />
                                    </div>
                                    {det.bbox && <div className="mt-4 rounded-xl bg-[var(--background)] border border-[var(--border)] p-4"><p className="text-xs text-[var(--text-soft)]">Bounding Box</p><p className="mt-1 text-sm font-medium break-all">[{det.bbox.join(", ")}]</p></div>}
                                </div>
                            ))}
                        </div>
                    ) : <p className="mt-4 text-sm text-[var(--text-soft)]">No detections available.</p>}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                    <button onClick={() => router.push("/upload")} className="px-5 py-3 rounded-2xl border border-[var(--border)] bg-white font-medium">Analyze Another</button>
                    <button onClick={() => window.print()} className="px-5 py-3 rounded-2xl bg-[var(--primary-dark)] text-white font-semibold">Download Report</button>
                </div>
            </div>
        </main>
    );
}

// Helper components (unchanged)
function SummaryCard({ icon, label, value, valueClassName = "text-[var(--foreground)]" }: { icon: React.ReactNode; label: string; value: string; valueClassName?: string }) {
    return <div className="rounded-2xl bg-[var(--background)] border border-[var(--border)] p-5"><div className="flex items-center gap-2 text-[var(--primary)]">{icon}<span className="text-sm font-medium">{label}</span></div><p className={`mt-4 text-2xl font-bold ${valueClassName}`}>{value}</p></div>;
}

function ImagePanel({ title, children }: { title: string; children: React.ReactNode }) {
    return <div className="rounded-3xl bg-[var(--card)] p-5"><h3 className="text-sm font-medium text-[var(--text-soft)] mb-4">{title}</h3>{children}</div>;
}

function EmptyImageMessage({ text }: { text: string }) {
    return <div className="min-h-[250px] rounded-2xl border border-[var(--border)] bg-white flex items-center justify-center text-center px-4 text-sm text-[var(--text-soft)]">{text}</div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3"><span className="text-[var(--text-soft)]">{label}</span><span className="font-medium text-right break-all">{value}</span></div>;
}

function MiniDetail({ label, value }: { label: string; value: string }) {
    return <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3"><p className="text-xs text-[var(--text-soft)]">{label}</p><p className="mt-1 font-semibold text-sm">{value}</p></div>;
}
