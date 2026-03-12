"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotError, setForgotError] = useState("");

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // SERVICE WORKER REGISTRATION
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered:", registration.scope);
        })
        .catch((err) => {
          console.error("SW registration failed:", err);
        });
    }
  }, []);

  const validate = () => {
    if (!email.includes("@")) {
      setError("Enter a valid email");
      return false;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }

    if (mode === "register" && !fullName.trim()) {
      setError("Enter your full name");
      return false;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const createUserProfileInFirestore = async ({
    uid,
    fullName,
    email,
  }: {
    uid: string;
    fullName: string;
    email: string;
  }) => {
    const userRef = doc(db, "users", uid);

    await setDoc(userRef, {
      uid,
      fullName,
      email,
      role: "user",
      createdAt: serverTimestamp(),
    });
  };

  const ensureUserProfileExists = async ({
    uid,
    fullName,
    email,
  }: {
    uid: string;
    fullName: string;
    email: string;
  }) => {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        fullName,
        email,
        role: "user",
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleAuth = async () => {
    setError("");
    setSuccess("");

    if (!validate()) return;

    setLoading(true);

    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        await updateProfile(cred.user, {
          displayName: fullName.trim(),
        });

        await createUserProfileInFirestore({
          uid: cred.user.uid,
          fullName: fullName.trim(),
          email: cred.user.email || email,
        });

        setSuccess("Account created successfully! Redirecting...");
        setTimeout(() => router.push("/dashboard"), 1200);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);

        await ensureUserProfileExists({
          uid: cred.user.uid,
          fullName: cred.user.displayName || "User",
          email: cred.user.email || email,
        });

        setSuccess("Login successful! Redirecting...");
        setTimeout(() => router.push("/dashboard"), 1200);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotError("");
    setForgotSuccess("");

    if (!forgotEmail.includes("@")) {
      setForgotError("Enter a valid email");
      return;
    }

    setForgotLoading(true);

    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotSuccess("Password reset link sent to your email!");

      setTimeout(() => {
        setShowForgotModal(false);
        setForgotEmail("");
        setForgotSuccess("");
      }, 2000);
    } catch (err: any) {
      setForgotError(err.message || "Failed to send reset email");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F8F7FF] via-white to-[#F1EEFF] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-6 md:left-20 w-56 md:w-72 h-56 md:h-72 bg-[#7C6EE6]/10 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-10 right-6 md:right-20 w-72 md:w-96 h-72 md:h-96 bg-[#FFB7C5]/10 rounded-full blur-3xl animate-float-slower" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div
          className={`w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 rounded-[32px] overflow-hidden shadow-2xl border border-white/40 bg-white/60 backdrop-blur-xl transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="relative bg-gradient-to-br from-[#7C6EE6] via-[#8D7FF0] to-[#A99CF7] p-8 md:p-12 flex flex-col justify-center items-center text-white min-h-[320px] lg:min-h-[700px]">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-10 left-10 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute bottom-16 right-12 w-32 h-32 bg-pink-200/20 rounded-full blur-2xl" />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="animate-float-image">
                <img
                  src="/auth-doctors.png"
                  alt="Medical team"
                  className="w-52 sm:w-64 md:w-72 lg:w-80 object-contain drop-shadow-2xl"
                />
              </div>

              <h2 className="mt-6 text-2xl md:text-3xl font-bold">
                Welcome to MEDORA
              </h2>
              <p className="mt-3 text-sm md:text-base text-white/90 max-w-md leading-relaxed">
                Smart AI-powered pediatric fracture detection platform designed
                to assist clinicians with faster and more reliable screening.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 md:p-10 lg:p-12 flex items-center justify-center bg-white/70">
            <div className="w-full max-w-md">
              <Link href="/" className="flex flex-col items-center text-center group">
                <div className="relative mb-3">
                  <img
                    src="/logo.png"
                    alt="MEDORA logo"
                    className="w-16 h-16 object-contain"
                  />
                </div>
                <h1 className="text-2xl font-bold text-[#7C6EE6]">MEDORA</h1>
                <p className="text-xs text-[#6F6A8A]">
                  AI Pediatric Fracture Detection
                </p>
              </Link>

              <div className="mt-6 flex bg-[#F1EEFF] rounded-xl p-1">
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setSuccess("");
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    mode === "login"
                      ? "bg-white text-[#7C6EE6] shadow-sm"
                      : "text-[#6F6A8A] hover:text-[#7C6EE6]"
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    setMode("register");
                    setError("");
                    setSuccess("");
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    mode === "register"
                      ? "bg-white text-[#7C6EE6] shadow-sm"
                      : "text-[#6F6A8A] hover:text-[#7C6EE6]"
                  }`}
                >
                  Register
                </button>
              </div>

              <div className="mt-6 text-center">
                <h2 className="text-xl sm:text-2xl font-bold text-[#2E2E3A]">
                  {mode === "login" ? "Welcome Back" : "Create Account"}
                </h2>
                <p className="text-sm text-[#6F6A8A] mt-1">
                  {mode === "login"
                    ? "Login to continue to your dashboard"
                    : "Create your account to get started"}
                </p>
              </div>

              {success && (
                <div className="mt-4 bg-green-50 border border-green-200 text-green-600 rounded-xl p-3 text-sm">
                  {success}
                </div>
              )}

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm break-words">
                  {error}
                </div>
              )}

              <div className="mt-6 space-y-4">
                {mode === "register" && (
                  <input
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 border border-[#C8C3FF]/30 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C6EE6]/20 focus:border-[#7C6EE6]"
                  />
                )}

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-[#C8C3FF]/30 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C6EE6]/20 focus:border-[#7C6EE6]"
                />

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-[#C8C3FF]/30 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C6EE6]/20 focus:border-[#7C6EE6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-4 flex items-center text-[#6F6A8A] hover:text-[#7C6EE6]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {mode === "register" && (
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-[#C8C3FF]/30 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C6EE6]/20 focus:border-[#7C6EE6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 px-4 flex items-center text-[#6F6A8A] hover:text-[#7C6EE6]"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                )}

                {mode === "login" && (
                  <button
                    onClick={() => {
                      setShowForgotModal(true);
                      setForgotEmail(email);
                    }}
                    className="text-xs text-[#6F6A8A] hover:text-[#7C6EE6] transition-colors"
                  >
                    Forgot password?
                  </button>
                )}

                <button
                  onClick={handleAuth}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#7C6EE6] text-white font-semibold hover:bg-[#6B5DDA] transition-all disabled:opacity-50"
                >
                  {loading
                    ? "Please wait..."
                    : mode === "login"
                    ? "Login"
                    : "Create Account"}
                </button>
              </div>

              <p className="mt-6 text-center text-xs text-[#6F6A8A]/70">
                MEDORA assists clinicians with AI fracture detection.
              </p>

              <div className="mt-2 text-center">
                <Link
                  href="/"
                  className="text-xs text-[#7C6EE6]/50 hover:text-[#7C6EE6] transition-colors"
                >
                  ← Back to home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-bold text-[#2E2E3A]">Reset Password</h3>
            <p className="text-sm text-[#6F6A8A] mt-1">
              Enter your email to receive a password reset link.
            </p>

            {forgotError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm">
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="mt-4 bg-green-50 border border-green-200 text-green-600 rounded-xl p-3 text-sm">
                {forgotSuccess}
              </div>
            )}

            <div className="mt-4">
              <input
                type="email"
                placeholder="Email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full px-4 py-3 border border-[#C8C3FF]/30 rounded-xl bg-white text-sm focus:outline-none focus:border-[#7C6EE6]"
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                className="flex-1 py-3 rounded-xl bg-[#7C6EE6] text-white font-semibold hover:bg-[#6B5DDA] transition disabled:opacity-50"
              >
                {forgotLoading ? "Sending..." : "Send Link"}
              </button>
              <button
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotEmail("");
                  setForgotError("");
                  setForgotSuccess("");
                }}
                className="flex-1 py-3 rounded-xl border border-[#C8C3FF]/30 bg-white text-[#6F6A8A] font-semibold hover:border-[#7C6EE6] hover:text-[#7C6EE6] transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes float-slow {
          0%, 100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(20px, -20px);
          }
        }

        @keyframes float-slower {
          0%, 100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(-30px, 30px);
          }
        }

        @keyframes float-image {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
        }

        .animate-float-slow {
          animation: float-slow 15s ease-in-out infinite;
        }

        .animate-float-slower {
          animation: float-slower 20s ease-in-out infinite;
        }

        .animate-float-image {
          animation: float-image 4s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
alter and give
