"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  ArrowLeft,
  Bell,
  Brain,
  LogOut,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [threshold, setThreshold] = useState(0.5);
  const [notifications, setNotifications] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth");
        return;
      }

      setFirebaseUser(user);

      try {
        const settingsRef = doc(db, "users", user.uid, "preferences", "settings");
        const snap = await getDoc(settingsRef);

        if (snap.exists()) {
          const data = snap.data();
          setThreshold(
            typeof data.threshold === "number" ? data.threshold : 0.5
          );
          setNotifications(
            typeof data.notifications === "boolean" ? data.notifications : true
          );
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        setError("Failed to load settings from database.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const handleSave = async () => {
    if (!firebaseUser) return;

    setSaving(true);
    setSuccess("");
    setError("");

    try {
      const settingsRef = doc(db, "users", firebaseUser.uid, "preferences", "settings");

      await setDoc(
        settingsRef,
        {
          threshold,
          notifications,
          updatedAt: serverTimestamp(),
          userId: firebaseUser.uid,
          userEmail: firebaseUser.email || "",
        },
        { merge: true }
      );

      setSuccess("Settings saved successfully.");
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut(auth);
      router.push("/auth");
    } catch (err) {
      console.error("Logout failed:", err);
      setError("Failed to logout.");
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="rounded-[28px] bg-white px-8 py-6 shadow-[var(--shadow-soft)]">
          <p className="text-[var(--primary-dark)] font-semibold text-lg">
            Loading settings...
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
      <div className="max-w-5xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" className="w-10 h-10" alt="MEDORA" />
          <div>
            <h1 className="text-xl font-bold text-[var(--primary-dark)]">
              MEDORA Settings
            </h1>
            <p className="text-sm text-[var(--text-soft)]">
              Manage your personal system preferences
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

      <div className="max-w-5xl mx-auto mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--secondary)]/35 p-3 text-[var(--primary)]">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">
                System Preferences
              </h2>
              <p className="text-sm text-[var(--text-soft)]">
                Personalized settings for your MEDORA workspace
              </p>
            </div>
          </div>

          {success && (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 rounded-2xl bg-[var(--card)] p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-[var(--primary)]">
                <SlidersHorizontal className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <p className="font-semibold text-[var(--foreground)]">
                  Fracture Detection Threshold
                </p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  Adjust the model confidence threshold used for screening.
                </p>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="mt-5 w-full"
                />

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-[var(--text-soft)]">Sensitive</span>
                  <span className="font-semibold text-[var(--primary-dark)]">
                    {threshold.toFixed(2)}
                  </span>
                  <span className="text-[var(--text-soft)]">Strict</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-[var(--card)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-3 text-[var(--primary)]">
                  <Bell className="h-5 w-5" />
                </div>

                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    Notifications
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Receive alerts when analysis is completed.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setNotifications((prev) => !prev)}
                className={`relative h-7 w-14 rounded-full transition ${notifications ? "bg-[var(--primary)]" : "bg-gray-300"
                  }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${notifications ? "left-8" : "left-1"
                    }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-dark)] px-5 py-3 text-white font-semibold hover:bg-[var(--primary)] disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-white font-semibold hover:bg-red-600 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>

        <div className="grid gap-5">
          <InfoCard
            icon={<Brain className="h-5 w-5" />}
            title="Model Control"
            desc="Fine-tune how sensitive the fracture screening behaves for your workflow."
          />
          <InfoCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Secure User Preferences"
            desc="Your settings are stored under your own Firebase user account."
          />
          <InfoCard
            icon={<Bell className="h-5 w-5" />}
            title="Notification Control"
            desc="Choose whether you want completion alerts during analysis sessions."
          />
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 text-[var(--primary)]">
        <div className="rounded-2xl bg-[var(--secondary)]/35 p-3">{icon}</div>
        <h3 className="font-bold text-[var(--foreground)]">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{desc}</p>
    </div>
  );
}
