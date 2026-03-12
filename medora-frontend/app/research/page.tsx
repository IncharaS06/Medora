"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
    collection,
    getDocs,
    query,
    Timestamp,
    where,
} from "firebase/firestore";
import {
    ArrowLeft,
    Activity,
    Brain,
    FileBarChart2,
    ShieldCheck,
    ScanLine,
    Target,
    TrendingUp,
    Microscope,
    AlertTriangle,
    FlaskConical,
} from "lucide-react";
import {
    ResponsiveContainer,
    CartesianGrid,
    Tooltip,
    XAxis,
    YAxis,
    LineChart,
    Line,
    BarChart,
    Bar,
} from "recharts";

type RawBoxType =
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
    prediction?: string;
    confidence?: number;
    boxes?: RawBoxType[];
    originalImageBase64?: string;
    annotatedImageBase64?: string;
    gradCamBase64?: string;
    riskLevel?: string;
    modelName?: string;
    summary?: string;
    recommendation?: string;
    createdAt?: Timestamp | string | null;
    groundTruth?: string;
    actualLabel?: string;
    trueLabel?: string;
};

type BoxType = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

function getImageSrc(value?: string) {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("data:image/")) return trimmed;

    if (
        trimmed.length > 100 &&
        !trimmed.includes("http://") &&
        !trimmed.includes("https://") &&
        !trimmed.includes("\\") &&
        !trimmed.includes(" ")
    ) {
        return `data:image/jpeg;base64,${trimmed}`;
    }

    return "";
}

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
            (b) =>
                Number.isFinite(b.x1) &&
                Number.isFinite(b.y1) &&
                Number.isFinite(b.x2) &&
                Number.isFinite(b.y2)
        );
}

function getSortableTime(value?: Timestamp | string | null) {
    if (!value) return 0;

    if (typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }

    if (typeof value === "object" && value && "toDate" in value) {
        try {
            return value.toDate().getTime();
        } catch {
            return 0;
        }
    }

    return 0;
}

function normalizeBinaryLabel(value?: string) {
    const v = (value || "").trim().toLowerCase();

    if (v === "fracture" || v === "positive" || v === "1") return 1;
    if (v === "normal" || v === "negative" || v === "0") return 0;

    return null;
}

function getGroundTruth(item: CaseItem) {
    return normalizeBinaryLabel(
        item.groundTruth || item.actualLabel || item.trueLabel
    );
}

function computeBinaryMetrics(cases: CaseItem[]) {
    const evaluated = cases
        .map((item) => {
            const gt = getGroundTruth(item);
            const score = Number(item.confidence ?? 0);
            const predLabel = normalizeBinaryLabel(item.prediction);

            return {
                gt,
                score,
                predLabel: predLabel !== null ? predLabel : score >= 0.5 ? 1 : 0,
            };
        })
        .filter((x) => x.gt !== null);

    let tp = 0;
    let tn = 0;
    let fp = 0;
    let fn = 0;

    for (const row of evaluated) {
        if (row.gt === 1 && row.predLabel === 1) tp++;
        else if (row.gt === 0 && row.predLabel === 0) tn++;
        else if (row.gt === 0 && row.predLabel === 1) fp++;
        else if (row.gt === 1 && row.predLabel === 0) fn++;
    }

    const total = tp + tn + fp + fn;
    const accuracy = total ? (tp + tn) / total : 0;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const specificity = tn + fp ? tn / (tn + fp) : 0;
    const f1 =
        precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

    return {
        evaluatedCount: total,
        tp,
        tn,
        fp,
        fn,
        accuracy,
        precision,
        recall,
        specificity,
        f1,
    };
}

function computeRocCurve(rows: { gt: number | null; score: number }[]) {
    const valid = rows.filter(
        (r) => r.gt !== null
    ) as { gt: number; score: number }[];

    const thresholds = Array.from({ length: 101 }, (_, i) => i / 100);

    return thresholds.map((threshold) => {
        let tp = 0;
        let tn = 0;
        let fp = 0;
        let fn = 0;

        for (const row of valid) {
            const pred = row.score >= threshold ? 1 : 0;

            if (row.gt === 1 && pred === 1) tp++;
            else if (row.gt === 0 && pred === 0) tn++;
            else if (row.gt === 0 && pred === 1) fp++;
            else if (row.gt === 1 && pred === 0) fn++;
        }

        const tpr = tp + fn ? tp / (tp + fn) : 0;
        const fpr = fp + tn ? fp / (fp + tn) : 0;

        return {
            threshold: Number(threshold.toFixed(2)),
            tpr,
            fpr,
        };
    });
}

function computePrCurve(rows: { gt: number | null; score: number }[]) {
    const valid = rows.filter(
        (r) => r.gt !== null
    ) as { gt: number; score: number }[];

    const thresholds = Array.from({ length: 101 }, (_, i) => i / 100);

    return thresholds.map((threshold) => {
        let tp = 0;
        let fp = 0;
        let fn = 0;

        for (const row of valid) {
            const pred = row.score >= threshold ? 1 : 0;

            if (row.gt === 1 && pred === 1) tp++;
            else if (row.gt === 0 && pred === 1) fp++;
            else if (row.gt === 1 && pred === 0) fn++;
        }

        const precision = tp + fp ? tp / (tp + fp) : 1;
        const recall = tp + fn ? tp / (tp + fn) : 0;

        return {
            threshold: Number(threshold.toFixed(2)),
            precision,
            recall,
        };
    });
}

function getReadableFirestoreError(err: any) {
    const code = err?.code || "";

    if (code.includes("permission-denied")) {
        return "Permission denied while reading Firestore data. Check Firestore rules.";
    }

    if (code.includes("unavailable")) {
        return "Firestore is temporarily unavailable.";
    }

    return "Failed to fetch research data from Firestore.";
}

export default function ResearchPage() {
    const router = useRouter();

    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [cases, setCases] = useState<CaseItem[]>([]);
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
        const fetchCases = async () => {
            try {
                if (!firebaseUser) return;

                const q = query(
                    collection(db, "cases"),
                    where("userId", "==", firebaseUser.uid)
                );

                const snap = await getDocs(q);

                const items: CaseItem[] = snap.docs.map((doc) => ({
                    id: doc.id,
                    ...(doc.data() as Omit<CaseItem, "id">),
                }));

                items.sort(
                    (a, b) => getSortableTime(b.createdAt) - getSortableTime(a.createdAt)
                );

                setCases(items);
                setError("");
            } catch (err) {
                console.error(err);
                setError(getReadableFirestoreError(err));
            } finally {
                setLoading(false);
            }
        };

        fetchCases();
    }, [firebaseUser]);

    const latestCase = useMemo(() => {
        if (!cases.length) return null;
        return cases[0];
    }, [cases]);

    const safeBoxes = useMemo(() => normalizeBoxes(latestCase?.boxes), [latestCase]);

    const annotatedSrc = useMemo(
        () => getImageSrc(latestCase?.annotatedImageBase64),
        [latestCase]
    );

    const gradCamSrc = useMemo(
        () => getImageSrc(latestCase?.gradCamBase64),
        [latestCase]
    );

    const binaryMetrics = useMemo(() => computeBinaryMetrics(cases), [cases]);

    const rocData = useMemo(
        () =>
            computeRocCurve(
                cases.map((c) => ({
                    gt: getGroundTruth(c),
                    score: Number(c.confidence ?? 0),
                }))
            ),
        [cases]
    );

    const prData = useMemo(
        () =>
            computePrCurve(
                cases.map((c) => ({
                    gt: getGroundTruth(c),
                    score: Number(c.confidence ?? 0),
                }))
            ),
        [cases]
    );

    const confusionData = useMemo(
        () => [
            { name: "TP", value: binaryMetrics.tp },
            { name: "FP", value: binaryMetrics.fp },
            { name: "TN", value: binaryMetrics.tn },
            { name: "FN", value: binaryMetrics.fn },
        ],
        [binaryMetrics]
    );

    const confidenceHistogram = useMemo(() => {
        const bins = [
            { range: "0.0-0.2", count: 0 },
            { range: "0.2-0.4", count: 0 },
            { range: "0.4-0.6", count: 0 },
            { range: "0.6-0.8", count: 0 },
            { range: "0.8-1.0", count: 0 },
        ];

        for (const item of cases) {
            const c = Number(item.confidence ?? 0);

            if (c < 0.2) bins[0].count++;
            else if (c < 0.4) bins[1].count++;
            else if (c < 0.6) bins[2].count++;
            else if (c < 0.8) bins[3].count++;
            else bins[4].count++;
        }

        return bins;
    }, [cases]);

    const latestConfidence = Number(latestCase?.confidence ?? 0);

    const latestRisk =
        latestCase?.riskLevel ||
        (latestConfidence >= 0.8
            ? "High"
            : latestConfidence >= 0.5
                ? "Moderate"
                : "Low");

    const hasGroundTruth = binaryMetrics.evaluatedCount > 0;

    if (loading) {
        return (
            <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
                <div className="rounded-[28px] bg-white px-8 py-6 shadow-[var(--shadow-soft)]">
                    <p className="text-[var(--primary-dark)] font-semibold text-lg">
                        Loading research panel...
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
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" className="w-10 h-10" alt="MEDORA" />
                    <div>
                        <h1 className="text-xl font-bold text-[var(--primary-dark)]">
                            MEDORA Research Panel
                        </h1>
                        <p className="text-sm text-[var(--text-soft)]">
                            Real evaluation metrics computed from your Firestore cases
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

            {error && (
                <div className="max-w-7xl mx-auto mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {!error && !hasGroundTruth && cases.length > 0 && (
                <div className="max-w-7xl mx-auto mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Add a Firestore field <b>groundTruth</b> with value <b>Fracture</b> or{" "}
                    <b>Normal</b> in your own case documents to enable full real evaluation
                    for confusion matrix, ROC, and PR curves.
                </div>
            )}

            <div className="max-w-7xl mx-auto mt-8">
                <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[var(--primary)] via-[var(--primary-dark)] to-[#8c7ef1] p-6 sm:p-8 text-white shadow-[var(--shadow-soft)]">
                    <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
                    <div className="absolute bottom-0 right-10 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

                    <div className="relative">
                        <div className="flex items-center gap-2 text-white/90">
                            <Microscope className="h-5 w-5" />
                            <span className="text-sm font-medium">AI Evaluation Workspace</span>
                        </div>

                        <h2 className="mt-4 max-w-3xl text-2xl sm:text-3xl font-bold leading-tight">
                            Real classification and explainability analytics from your stored
                            cases.
                        </h2>

                        <p className="mt-3 max-w-3xl text-sm sm:text-base leading-7 text-white/85">
                            This panel uses your Firestore case data directly to compute
                            confusion matrix, ROC, precision-recall, confidence distribution,
                            and latest-case explainability.
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto mt-8 grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
                <MetricCard
                    label="Cases"
                    value={`${cases.length}`}
                    icon={<Activity className="h-5 w-5" />}
                />
                <MetricCard
                    label="Evaluated"
                    value={`${binaryMetrics.evaluatedCount}`}
                    icon={<FileBarChart2 className="h-5 w-5" />}
                />
                <MetricCard
                    label="Accuracy"
                    value={`${(binaryMetrics.accuracy * 100).toFixed(1)}%`}
                    icon={<Target className="h-5 w-5" />}
                />
                <MetricCard
                    label="Recall"
                    value={`${(binaryMetrics.recall * 100).toFixed(1)}%`}
                    icon={<TrendingUp className="h-5 w-5" />}
                />
                <MetricCard
                    label="Precision"
                    value={`${(binaryMetrics.precision * 100).toFixed(1)}%`}
                    icon={<Brain className="h-5 w-5" />}
                />
                <MetricCard
                    label="F1"
                    value={`${(binaryMetrics.f1 * 100).toFixed(1)}%`}
                    icon={<ShieldCheck className="h-5 w-5" />}
                />
                <MetricCard
                    label="Latest Conf."
                    value={`${(latestConfidence * 100).toFixed(1)}%`}
                    icon={<ScanLine className="h-5 w-5" />}
                />
                <MetricCard
                    label="Risk"
                    value={latestRisk}
                    icon={<AlertTriangle className="h-5 w-5" />}
                />
            </div>

            <div className="max-w-7xl mx-auto mt-10 grid md:grid-cols-2 gap-6">
                <RealChartCard title="Confusion Matrix Counts">
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={confusionData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#7c6ee6" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </RealChartCard>

                <RealChartCard title="Confidence Distribution">
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={confidenceHistogram}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="range" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#8c7ef1" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </RealChartCard>

                <RealChartCard title="ROC Curve">
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={rocData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="fpr"
                                    type="number"
                                    domain={[0, 1]}
                                    tickFormatter={(v: number) => v.toFixed(1)}
                                />
                                <YAxis
                                    dataKey="tpr"
                                    type="number"
                                    domain={[0, 1]}
                                    tickFormatter={(v: number) => v.toFixed(1)}
                                />
                                <Tooltip formatter={(value: any) => Number(value).toFixed(3)} />
                                <Line type="monotone" dataKey="tpr" stroke="#7c6ee6" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </RealChartCard>

                <RealChartCard title="Precision-Recall Curve">
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={prData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="recall"
                                    type="number"
                                    domain={[0, 1]}
                                    tickFormatter={(v: number) => v.toFixed(1)}
                                />
                                <YAxis
                                    dataKey="precision"
                                    type="number"
                                    domain={[0, 1]}
                                    tickFormatter={(v: number) => v.toFixed(1)}
                                />
                                <Tooltip formatter={(value: any) => Number(value).toFixed(3)} />
                                <Line
                                    type="monotone"
                                    dataKey="precision"
                                    stroke="#5b4fd8"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </RealChartCard>
            </div>

            <div className="max-w-7xl mx-auto mt-10 grid xl:grid-cols-[1.1fr_0.9fr] gap-6">
                <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-[var(--shadow-card)]">
                    <div className="flex items-center gap-2">
                        <FlaskConical className="h-5 w-5 text-[var(--primary)]" />
                        <h3 className="text-xl font-bold text-[var(--foreground)]">
                            Explainability Review
                        </h3>
                    </div>

                    <p className="mt-2 text-sm text-[var(--text-soft)]">
                        Latest case from your Firestore data.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <ExplainCard
                            title="YOLO Annotated Result"
                            image={annotatedSrc}
                            fallback="Annotated image not available"
                        />
                        <ExplainCard
                            title="Grad-CAM Heatmap"
                            image={gradCamSrc}
                            fallback="Grad-CAM output not available"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-[var(--shadow-card)]">
                    <h3 className="text-xl font-bold text-[var(--foreground)]">
                        Latest Case Analysis
                    </h3>

                    <p className="mt-2 text-sm text-[var(--text-soft)]">
                        Real latest-case details from your Firestore data.
                    </p>

                    <div className="mt-5 space-y-4">
                        <DetailRow label="Case ID" value={latestCase?.id || "Not available"} />
                        <DetailRow
                            label="Prediction"
                            value={latestCase?.prediction || "Not available"}
                        />
                        <DetailRow
                            label="Confidence"
                            value={`${(latestConfidence * 100).toFixed(1)}%`}
                        />
                        <DetailRow label="Risk Level" value={latestRisk} />
                        <DetailRow
                            label="Model"
                            value={latestCase?.modelName || "EfficientNet-B3 + YOLOv8"}
                        />
                        <DetailRow label="Detected Regions" value={`${safeBoxes.length}`} />
                    </div>

                    <div className="mt-6 rounded-2xl bg-[var(--card)] p-4">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                            AI Summary
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                            {latestCase?.summary || "No live case summary available."}
                        </p>
                    </div>

                    <div className="mt-4 rounded-2xl bg-[var(--card)] p-4">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                            Recommendation
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                            {latestCase?.recommendation ||
                                "Clinical correlation and radiologist review are recommended for all AI-generated findings."}
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}

function MetricCard({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="bg-white p-5 rounded-2xl shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 text-[var(--primary)]">
                {icon}
                <p className="text-sm text-[var(--text-soft)]">{label}</p>
            </div>
            <p className="text-2xl font-bold mt-3 text-[var(--foreground)]">
                {value}
            </p>
        </div>
    );
}

function RealChartCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white p-6 rounded-[28px] shadow-[var(--shadow-card)]">
            <h3 className="font-bold text-lg text-[var(--foreground)]">{title}</h3>
            <div className="mt-5 rounded-2xl bg-[var(--card)] p-4">{children}</div>
        </div>
    );
}

function ExplainCard({
    title,
    image,
    fallback,
}: {
    title: string;
    image: string;
    fallback: string;
}) {
    return (
        <div className="rounded-2xl bg-[var(--card)] p-4">
            <h4 className="text-sm font-medium text-[var(--text-soft)] mb-3">
                {title}
            </h4>

            {image ? (
                <img
                    src={image}
                    alt={title}
                    className="rounded-xl shadow w-full object-contain max-h-[320px] bg-white"
                />
            ) : (
                <div className="rounded-xl border border-[var(--border)] bg-white min-h-[220px] flex items-center justify-center text-sm text-[var(--text-soft)] text-center px-4">
                    {fallback}
                </div>
            )}
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
            <span className="text-sm text-[var(--text-soft)]">{label}</span>
            <span className="text-sm font-medium text-[var(--foreground)] text-right break-words">
                {value}
            </span>
        </div>
    );
}