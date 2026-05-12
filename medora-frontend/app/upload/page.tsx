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

  const [authLoading, setAuthLoading] =
    useState(true);

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
  // REDIRECT TO MODEL
  // ─────────────────────────────────────────────
  const openModel = () => {

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

    <main className="min-h-screen flex items-center justify-center p-6">

      <div className="max-w-md w-full bg-white rounded-[28px] shadow-[var(--shadow-card)] p-8 flex flex-col gap-6 text-center">

        <div>

          <h1 className="text-2xl font-bold text-[var(--primary-dark)]">

            MEDORA AI

          </h1>

          <p className="text-sm text-[var(--text-soft)] mt-2">

            Open the pediatric wrist fracture
            detection model.

          </p>

        </div>

        <button
          onClick={openModel}
          className="
            rounded-xl
            bg-[var(--primary-dark)]
            text-white
            font-semibold
            py-3
            text-sm
            hover:bg-[var(--primary)]
            transition-colors
          "
        >

          Open MEDORA AI Model

        </button>

      </div>

    </main>
  );
}
