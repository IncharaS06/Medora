"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function UploadPage() {
  const router = useRouter();

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
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

    if (!selected.type.startsWith("image/")) {
      setError("Only image files allowed");
      return;
    }

    setFile(selected);

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string); // ✅ FULL DATA URL
    };
    reader.readAsDataURL(selected);
  };

  const analyzeImage = async () => {
    if (!file || !firebaseUser) return;

    setLoading(true);

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

      const data = await res.json();

      const docRef = await addDoc(collection(db, "cases"), {
        userId: firebaseUser.uid,
        prediction: data.prediction,
        confidence: data.confidence,

        // ✅ FIX: STORE FULL IMAGE (NOT STRIPPED)
        originalImageBase64: preview,

        annotatedImageBase64: data.annotatedImageBase64,
        gradCamBase64: data.gradCamBase64,

        createdAt: serverTimestamp(),
      });

      router.push(`/report/${docRef.id}`);
    } catch (err: any) {
      setError(err.message);
    }

    setLoading(false);
  };

  if (authLoading) return <div>Loading...</div>;

  return (
    <main className="p-6">
      <input type="file" onChange={handleFile} />

      {preview && (
        <img src={preview} className="mt-4 w-64 rounded" />
      )}

      <button onClick={analyzeImage} className="mt-4 bg-black text-white px-4 py-2">
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {error && <p className="text-red-500">{error}</p>}
    </main>
  );
}
