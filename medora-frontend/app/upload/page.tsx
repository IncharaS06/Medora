"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { auth } from "@/lib/firebase";

import {
  onAuthStateChanged,
  User,
} from "firebase/auth";

export default function UploadPage() {

  const router = useRouter();

  const [firebaseUser, setFirebaseUser] =
    useState<User | null>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState("");

  const [authLoading, setAuthLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // ─────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // FILE INPUT
  // ─────────────────────────────────────────────
  const handleFile = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    const selected =
      e.target.files?.[0];

    if (!selected) return;

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

    setError("");

    setFile(selected);

    const reader = new FileReader();

    reader.onload = () => {

      setPreview(
        reader.result as string
      );
    };

    reader.readAsDataURL(selected);
  };

  // ─────────────────────────────────────────────
  // REDIRECT
  // ─────────────────────────────────────────────
  const openModel = () => {

    if (!file) {

      setError(
        "Please upload an image first."
      );

      return;
    }

    // save image temporarily
    localStorage.setItem(
      "uploadedXray",
      preview
    );

    // redirect to HF model
    window.location.href =
      "https://huggingface.co/spaces/inchara07/medora-model";
  };

  // ─────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────
  if (authLoading) {

    return (
      <div className="min-h-screen flex items-center justify-center">

        <p className="text-[var(--primary-dark)] font-semibold">
          Loading...
        </p>

      </div>
    );
  }

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  return (

    <main className="p-6">

      <div className="max-w-xl mx-auto bg-white rounded-[28px] shadow-[var(--shadow-card)] p-6 sm:p-10 flex flex-col gap-6">

        {/* Header */}
        <div>

          <h1 className="text-2xl font-bold text-[var(--primary-dark)]">

            Upload X-Ray

          </h1>

          <p className="text-sm text-[var(--text-soft)] mt-2">

            Upload a pediatric wrist X-ray image.
            MEDORA AI will analyze fracture detection.

          </p>

        </div>

        {/* Upload */}
        <div className="flex flex-col gap-3">

          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="
              rounded-xl
              border
              border-[var(--border)]
              px-4
              py-3
              text-sm
              bg-[var(--background)]
            "
          />

          {/* Preview */}
          {preview && (

            <img
              src={preview}
              alt="Preview"
              className="
                rounded-2xl
                border
                border-[var(--border)]
                max-h-80
                object-contain
              "
            />
          )}

        </div>

        {/* Error */}
        {error && (

          <div className="
            rounded-xl
            bg-red-50
            border
            border-red-200
            px-4
            py-3
            text-sm
            text-red-700
          ">

            {error}

          </div>
        )}

        {/* Button */}
        <button
          onClick={openModel}
          disabled={!file}
          className="
            rounded-xl
            bg-[var(--primary-dark)]
            text-white
            font-semibold
            py-3
            text-sm
            hover:bg-[var(--primary)]
            disabled:opacity-50
            disabled:cursor-not-allowed
            transition-colors
          "
        >

          Open MEDORA AI Model

        </button>

      </div>

    </main>
  );
}
