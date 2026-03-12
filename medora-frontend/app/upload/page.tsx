"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  UploadCloud,
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

  // ✅ ONLY WRIST XRAY VALIDATION
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError("");

    // only image
    if (!selected.type.startsWith("image/")) {
      setError("Only image files allowed");
      return;
    }

    // only png jpg jpeg
    const allowed = ["image/png", "image/jpeg", "image/jpg"];

    if (!allowed.includes(selected.type)) {
      setError("Only PNG/JPG X-ray allowed");
      return;
    }

    // filename check
    const name = selected.name.toLowerCase();

    if (!name.includes("wrist") && !name.includes("xray")) {
      setError("Upload only WRIST X-ray image");
      return;
    }

    setFile(selected);

    const reader = new FileReader();

    reader.onload = () => {
      setPreview(reader.result as string);
    };

    reader.onerror = () => {
      setError("Failed to read image");
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
      return dataUrl.split(",")[1] || "";
    }

    return dataUrl;
  };

  const analyzeImage = async () => {
    if (!firebaseUser) {
      setError("User not logged in");
      return;
    }

    if (!file) {
      setError("Upload wrist X-ray first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/analyze`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data: AnalyzeResponse & { detail?: string } =
        await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Analysis failed");
      }

      const docRef = await addDoc(collection(db, "cases"), {
        userId: firebaseUser.uid,
        userEmail: firebaseUser.email || "",

        patientName: "Unknown",

        prediction: data.prediction || "Unknown",
        confidence:
          typeof data.confidence === "number"
            ? data.confidence
            : 0,
        riskLevel: data.riskLevel || "",

        boxes: Array.isArray(data.boxes) ? data.boxes : [],

        originalImageBase64: base64DataOnly(preview),
        annotatedImageBase64: data.annotatedImageBase64 || "",
        gradCamBase64: data.gradCamBase64 || "",

        modelName:
          data.modelName || "EfficientNet-B3 + YOLOv8",

        summary:
          data.summary ||
          ((data.prediction || "").toLowerCase() ===
          "fracture"
            ? "Suspicious fracture detected in wrist."
            : "No fracture detected."),

        recommendation:
          data.recommendation ||
          ((data.prediction || "").toLowerCase() ===
          "fracture"
            ? "Clinical review recommended."
            : "Still verify clinically."),

        status: "Completed",

        createdAt: serverTimestamp(),
      });

      router.push(`/report/${docRef.id}`);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Analysis failed. Check backend"
      );
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">

      <div className="max-w-5xl mx-auto flex justify-between">

        <h1 className="text-xl font-bold">
          MEDORA Upload
        </h1>

        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 bg-black text-white"
        >
          <ArrowLeft />
          Back
        </button>

      </div>

      <div className="max-w-3xl mx-auto mt-10 bg-white p-8 rounded">

        {error && (
          <div className="text-red-600 mb-4">
            {error}
          </div>
        )}

        <label className="border-2 border-dashed p-10 text-center cursor-pointer">

          <input
            type="file"
            accept=".png,.jpg,.jpeg"
            onChange={handleFile}
            className="hidden"
          />

          {!preview ? (
            <div>
              <UploadCloud />
              <p>Upload WRIST X-ray</p>
            </div>
          ) : (
            <img
              src={preview}
              className="max-h-72 mx-auto"
            />
          )}

        </label>

        <div className="flex gap-4 mt-6">

          {file && (
            <button
              onClick={removeImage}
              className="px-4 py-2 border"
            >
              <Trash2 />
              Remove
            </button>
          )}

          <button
            onClick={analyzeImage}
            disabled={loading}
            className="px-6 py-3 bg-black text-white"
          >
            <ScanSearch />
            {loading
              ? "Analyzing..."
              : "Analyze Wrist X-ray"}
          </button>

        </div>

      </div>

    </main>
  );
}
