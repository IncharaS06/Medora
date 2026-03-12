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
  boxes?: any[];
  annotatedImageBase64?: string;
  gradCamBase64?: string;
};

export default function UploadPage() {
  const router = useRouter();

  const [firebaseUser, setFirebaseUser] =
    useState<User | null>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // auth
  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) {
          router.push("/auth");
          return;
        }

        setFirebaseUser(user);
        setAuthLoading(false);
      }
    );

    return () => unsub();
  }, [router]);

  // ✅ MOBILE SAFE FILE HANDLER
  const handleFile = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected =
      e.target.files?.[0];

    if (!selected) return;

    setError("");

    // allow all image types
    if (
      !selected.type.startsWith(
        "image/"
      )
    ) {
      setError(
        "Only image files allowed"
      );
      return;
    }

    setFile(selected);

    const reader =
      new FileReader();

    reader.onload = () => {
      setPreview(
        reader.result as string
      );
    };

    reader.onerror = () => {
      setError(
        "Failed to read image"
      );
    };

    reader.readAsDataURL(
      selected
    );
  };

  const removeImage = () => {
    setFile(null);
    setPreview("");
    setError("");
  };

  const base64DataOnly = (
    dataUrl: string
  ) => {
    if (!dataUrl) return "";

    if (
      dataUrl.startsWith(
        "data:image/"
      )
    ) {
      return dataUrl.split(
        ","
      )[1];
    }

    return dataUrl;
  };

  const analyzeImage =
    async () => {
      if (!firebaseUser) return;
      if (!file) return;

      setLoading(true);
      setError("");

      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        const res =
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/analyze`,
            {
              method: "POST",
              body: formData,
            }
          );

        const data:
          AnalyzeResponse & {
            detail?: string;
          } =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "Analysis failed"
          );
        }

        const docRef =
          await addDoc(
            collection(
              db,
              "cases"
            ),
            {
              userId:
                firebaseUser.uid,

              userEmail:
                firebaseUser.email ||
                "",

              prediction:
                data.prediction ||
                "Unknown",

              confidence:
                data.confidence ||
                0,

              riskLevel:
                data.riskLevel ||
                "",

              originalImageBase64:
                base64DataOnly(
                  preview
                ),

              annotatedImageBase64:
                data.annotatedImageBase64 ||
                "",

              gradCamBase64:
                data.gradCamBase64 ||
                "",

              createdAt:
                serverTimestamp(),
            }
          );

        router.push(
          `/report/${docRef.id}`
        );
      } catch (err: any) {
        setError(
          err.message
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
    <main className="min-h-screen bg-[var(--background)] p-4 sm:p-6">

      {/* HEADER */}

      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">

        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            className="w-10 h-10"
          />

          <h1 className="text-xl font-bold text-[var(--primary-dark)]">
            MEDORA Upload
          </h1>
        </div>

        <button
          onClick={() =>
            router.push(
              "/dashboard"
            )
          }
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary-dark)] text-white"
        >
          <ArrowLeft
            size={16}
          />
          Back
        </button>
      </div>

      {/* CARD */}

      <div className="max-w-3xl mx-auto mt-8 bg-white p-5 sm:p-8 rounded-[24px] shadow-[var(--shadow-card)]">

        {error && (
          <div className="mb-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* UPLOAD */}

        <label className="block border-2 border-dashed border-[var(--primary)] rounded-[20px] p-6 sm:p-10 text-center cursor-pointer">

          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={
              handleFile
            }
            className="hidden"
          />

          {!preview ? (
            <div className="flex flex-col items-center">

              <UploadCloud
                size={36}
                className="text-[var(--primary)]"
              />

              <p className="mt-3 font-semibold text-lg">
                Upload X-ray
              </p>

              <p className="text-sm text-gray-500">
                Camera /
                Gallery /
                PNG /
                JPG /
                HEIC
              </p>

            </div>
          ) : (
            <img
              src={preview}
              className="max-h-64 mx-auto rounded-xl shadow"
            />
          )}
        </label>

        {/* BUTTONS */}

        <div className="flex flex-col sm:flex-row gap-3 mt-6">

          {file && (
            <button
              onClick={
                removeImage
              }
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border"
            >
              <Trash2
                size={16}
              />
              Remove
            </button>
          )}

          <button
            onClick={
              analyzeImage
            }
            disabled={
              loading
            }
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary-dark)] text-white"
          >
            <ScanSearch
              size={16}
            />

            {loading
              ? "Analyzing..."
              : "Analyze X-ray"}
          </button>

        </div>

      </div>

    </main>
  );
}
