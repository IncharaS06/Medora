"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  UploadCloud,
  ImagePlus,
  ArrowLeft,
  Trash2,
  ScanSearch,
} from "lucide-react";

type AnalyzeResponse = {
  prediction?: string;
  confidence?: number;
  riskLevel?: string;
  boxes?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }[];
  annotatedImageBase64?: string;
  gradCamBase64?: string;
  modelName?: string;
  summary?: string;
  recommendation?: string;
};

export default function UploadPage() {
  const router = useRouter();

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/auth");
        return;
      }

      setFirebaseUser(user);
      setAuthLoading(false);
    });

    return () => unsub();
  }, [router]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError("");
    setFile(selected);

    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;
      setPreview(base64);
    };

    reader.onerror = () => {
      setError("Failed to read uploaded image.");
    };

    reader.readAsDataURL(selected);
  };

  const removeImage = () => {
    setFile(null);
    setPreview("");
    setError("");
  };

  const base64DataOnly = (dataUrl: string) => {
    if (!dataUrl) return "";

    if (dataUrl.startsWith("data:image/")) {
      const parts = dataUrl.split(",");
      return parts[1] || "";
    }

    return dataUrl;
  };

  const analyzeImage = async () => {
    if (!firebaseUser) {
      setError("User not logged in.");
      return;
    }

    if (!file) {
      setError("Upload an image first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        body: formData,
      });

      const data: AnalyzeResponse & { detail?: string } = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Analysis failed");
      }

      // SAVE TO FIRESTORE
      const docRef = await addDoc(collection(db, "cases"), {
        userId: firebaseUser.uid,
        userEmail: firebaseUser.email || "",

        patientName: "Unknown",

        prediction: data.prediction || "Unknown",
        confidence: typeof data.confidence === "number" ? data.confidence : 0,
        riskLevel: data.riskLevel || "",

        boxes: Array.isArray(data.boxes) ? data.boxes : [],

        originalImageBase64: base64DataOnly(preview),
        annotatedImageBase64: data.annotatedImageBase64 || "",
        gradCamBase64: data.gradCamBase64 || "",

        modelName: data.modelName || "EfficientNet-B3 + YOLOv8",

        summary:
          data.summary ||
          ((data.prediction || "").toLowerCase() === "fracture"
            ? "Suspicious fracture-related region detected in the wrist radiograph."
            : "No strong fracture-related localization detected by the model."),

        recommendation:
          data.recommendation ||
          ((data.prediction || "").toLowerCase() === "fracture"
            ? "Clinical review recommended. Correlate with radiologist interpretation."
            : "Model suggests a normal case, but clinical review is still advised."),

        status: "Completed",

        createdAt: serverTimestamp(),
      });

      // IMPORTANT: redirect using document ID
      router.push(`/report/${docRef.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Analysis failed. Check backend server.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="rounded-[28px] bg-white px-8 py-6 shadow-[var(--shadow-soft)]">
          <p className="text-[var(--primary-dark)] font-semibold text-lg">
            Loading upload page...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" className="w-10 h-10" alt="MEDORA" />
          <h1 className="text-xl font-bold text-[var(--primary-dark)]">
            MEDORA Upload
          </h1>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary-dark)] text-white text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <div className="max-w-3xl mx-auto mt-10 bg-white p-8 rounded-[28px] shadow-[var(--shadow-card)]">

        {error && (
          <div className="mb-4 text-red-600 text-sm font-medium">{error}</div>
        )}

        <label className="block border-2 border-dashed border-[var(--primary)] rounded-[24px] p-10 text-center cursor-pointer">

          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />

          {!preview ? (
            <div className="flex flex-col items-center">
              <UploadCloud className="h-10 w-10 text-[var(--primary)]" />
              <p className="mt-4 font-semibold text-lg">
                Click to upload radiograph
              </p>
            </div>
          ) : (
            <img
              src={preview}
              className="max-h-72 mx-auto rounded-xl shadow"
            />
          )}
        </label>

        <div className="flex gap-4 mt-6">

          {file && (
            <button
              onClick={removeImage}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          )}

          <button
            onClick={analyzeImage}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary-dark)] text-white"
          >
            <ScanSearch className="h-4 w-4" />
            {loading ? "Analyzing..." : "Analyze & Open Report"}
          </button>
        </div>
      </div>
    </main>
  );
}