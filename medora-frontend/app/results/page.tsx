"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
    collection,
    getDocs,
    orderBy,
    query,
    Timestamp,
    where,
    limit,
} from "firebase/firestore";
import {
    Activity,
    AlertTriangle,
    Brain,
    CalendarDays,
    FileBarChart2,
    ScanLine,
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
    riskLevel?: string;
    boxes?: RawBoxType[];
    originalImageBase64?: string;
    annotatedImageBase64?: string;
    gradCamBase64?: string;
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
    if (!value) return "Not available";

    if (typeof value === "string") {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
    }

    if (typeof value === "object" && value && "toDate" in value) {
        try {
            return value.toDate().toLocaleString();
        } catch {
            return "Not available";
        }
    }

    return "Not available";
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

    return "Failed to load latest result from database.";
}

export default function ResultsPage() {
    const router = useRouter();

    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [result, setResult] = useState<ResultType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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
        const fetchLatestResult = async () => {
            try {
                if (!firebaseUser) return;

                const q = query(
                    collection(db, "cases"),
                    where("userId", "==", firebaseUser.uid),
                    orderBy("createdAt", "desc"),
                    limit(1)
                );

                const snap = await getDocs(q);

                if (snap.empty) {
                    setError("No analysis result found in database.");
                    setLoading(false);
                    return;
                }

                const docSnap = snap.docs[0];
                const data = docSnap.data() as Omit<ResultType, "id">;

                const payload: ResultType = {
                    id: docSnap.id,
                    userId: data.userId || "",
                    userEmail: data.userEmail || "",
                    patientName: data.patientName || "Unknown",
                    prediction: data.prediction || "Unknown",
                    confidence: typeof data.confidence === "number" ? data.confidence : 0,
                    riskLevel: data.riskLevel || "",
                    boxes: Array.isArray(data.boxes) ? data.boxes : [],
                    originalImageBase64: data.originalImageBase64 || "",
                    annotatedImageBase64: data.annotatedImageBase64 || "",
                    gradCamBase64: data.gradCamBase64 || "",
                    modelName: data.modelName || "EfficientNet-B3 + YOLOv8",
                    summary: data.summary || "",
                    recommendation: data.recommendation || "",
                    createdAt: data.createdAt || null,
                };

                setResult(payload);
            } catch (err) {
                console.error("Failed to fetch latest result:", err);
                setError(getReadableFirestoreError(err));
            } finally {
                setLoading(false);
            }
        };

        fetchLatestResult();
    }, [firebaseUser]);

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

    if (loading) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
                <div className="rounded-[28px] bg-white px-8 py-6 shadow-[var(--shadow-soft)]">
                    <p className="text-[var(--primary-dark)] font-semibold text-lg">
                        Loading results...
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
                        {error || "Result not available."}
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

    const detectedRegions = safeBoxes.length;
    const riskLevel =
        result.riskLevel ||
        (result.confidence >= 0.8
            ? "High"
            : result.confidence >= 0.5
                ? "Moderate"
                : "Low");

    const formattedDate = formatDate(result.createdAt);

    return (
        <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="MEDORA" className="w-10 h-10" />
                    <h1 className="text-xl font-bold text-[var(--primary-dark)]">
                        MEDORA Detailed Results
                    </h1>
                </div>

                <button
                    onClick={() => router.push("/dashboard")}
                    className="px-4 py-2 rounded-lg bg-[var(--primary-dark)] text-white text-sm font-semibold hover:bg-[var(--primary)]"
                >
                    Dashboard
                </button>
            </div>

            <div className="max-w-7xl mx-auto mt-8 bg-white rounded-[28px] p-5 sm:p-8 shadow-[var(--shadow-card)]">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold text-[var(--foreground)]">
                        Pediatric Wrist Fracture Analysis
                    </h2>
                    <p className="text-[var(--text-soft)]">
                        Detailed AI-assisted result with localization and explainability.
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                    <SummaryCard
                        icon={<Activity className="h-5 w-5" />}
                        label="Prediction"
                        value={result.prediction}
                        valueClassName={
                            result.prediction === "Fracture"
                                ? "text-red-600"
                                : "text-green-600"
                        }
                    />

                    <SummaryCard
                        icon={<FileBarChart2 className="h-5 w-5" />}
                        label="Confidence"
                        value={`${((result.confidence || 0) * 100).toFixed(1)}%`}
                    />

                    <SummaryCard
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

                    <SummaryCard
                        icon={<ScanLine className="h-5 w-5" />}
                        label="Detected Regions"
                        value={`${detectedRegions}`}
                    />
                </div>

                <div className="grid lg:grid-cols-3 gap-6 mt-8">
                    <ImagePanel
                        title="Uploaded Image"
                        content={
                            originalSrc ? (
                                <img
                                    src={originalSrc}
                                    alt="Uploaded preview"
                                    className="rounded-xl shadow w-full object-contain max-h-[420px] bg-white"
                                />
                            ) : (
                                <EmptyImageMessage text="Original image not available in database" />
                            )
                        }
                    />

                    <ImagePanel
                        title="YOLO Annotated Result"
                        content={
                            annotatedSrc ? (
                                <img
                                    src={annotatedSrc}
                                    alt="Annotated result"
                                    className="rounded-xl shadow w-full object-contain max-h-[420px] bg-white"
                                />
                            ) : (
                                <EmptyImageMessage text="Annotated result not available" />
                            )
                        }
                    />

                    <ImagePanel
                        title="Grad-CAM Heatmap"
                        content={
                            gradCamSrc ? (
                                <img
                                    src={gradCamSrc}
                                    alt="Grad-CAM heatmap"
                                    className="rounded-xl shadow w-full object-contain max-h-[420px] bg-white"
                                />
                            ) : (
                                <EmptyImageMessage text="Grad-CAM heatmap not available yet" />
                            )
                        }
                    />
                </div>

                <div className="grid lg:grid-cols-2 gap-6 mt-8">
                    <div className="rounded-2xl bg-[var(--card)] p-5">
                        <div className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-[var(--primary)]" />
                            <h3 className="text-lg font-bold text-[var(--foreground)]">
                                AI Interpretation Summary
                            </h3>
                        </div>

                        <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">
                            {result.summary ||
                                "The model detected suspicious fracture-related regions in the wrist radiograph. Review the annotated output and correlate with clinical expertise."}
                        </p>

                        <div className="mt-5 rounded-xl bg-white border border-[var(--border)] p-4">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                                Recommendation
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                                {result.recommendation ||
                                    "Clinical review is recommended. This output should be used only as a decision-support signal and not as a standalone diagnosis."}
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

                        <div className="mt-4 space-y-4 text-sm">
                            <DetailRow
                                label="Case ID"
                                value={result.id || "Not available"}
                            />
                            <DetailRow
                                label="Patient"
                                value={result.patientName || "Unknown"}
                            />
                            <DetailRow
                                label="Model Used"
                                value={result.modelName || "EfficientNet-B3 + YOLOv8"}
                            />
                            <DetailRow
                                label="Timestamp"
                                value={formattedDate}
                            />
                            <DetailRow
                                label="Explainability"
                                value={gradCamSrc ? "Grad-CAM + Bounding Boxes" : "Bounding Boxes"}
                            />
                        </div>

                        <div className="mt-5 rounded-xl bg-white border border-[var(--border)] p-4">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-[var(--primary)]" />
                                <p className="text-sm font-semibold text-[var(--foreground)]">
                                    Clinical Note
                                </p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                                MEDORA is a decision-support system. Final interpretation must be
                                validated by a qualified clinician or radiologist.
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
                                    <div className="mt-2 grid sm:grid-cols-4 gap-2">
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
                            No suspicious fracture regions were localized by the detector.
                        </p>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                    <button
                        onClick={() => router.push("/upload")}
                        className="px-5 py-3 rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] font-medium hover:bg-[var(--card)]"
                    >
                        Analyze Another
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="px-5 py-3 rounded-xl bg-[var(--primary-dark)] text-white font-semibold hover:bg-[var(--primary)]"
                    >
                        Download Detailed Report
                    </button>
                </div>
            </div>
        </main>
    );
}

function SummaryCard({
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
        <div className="bg-[var(--background)] rounded-2xl p-4 border border-[var(--border)]">
            <div className="flex items-center gap-2 text-[var(--primary)]">
                {icon}
                <span className="text-sm font-medium">{label}</span>
            </div>
            <p className={`text-2xl font-bold mt-3 ${valueClassName}`}>{value}</p>
        </div>
    );
}

function ImagePanel({
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

function EmptyImageMessage({ text }: { text: string }) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-white min-h-[220px] flex items-center justify-center text-sm text-[var(--text-soft)] text-center px-4">
            {text}
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
            <span className="text-[var(--text-soft)]">{label}</span>
            <span className="font-medium text-[var(--foreground)] text-right break-words">
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