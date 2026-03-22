"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const router = useRouter();

  // If already logged in, push to dashboard
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("smartapi_token");
      if (token) {
        router.push("/dashboard");
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !pin) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:8000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Login request failed");
      }

      // Securely store token (using localStorage for client-side demo)
      localStorage.setItem("smartapi_token", data.auth_token);
      
      // Redirect to main protected page
      router.push("/dashboard");

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 font-sans">
      <main className="max-w-md w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-8 backdrop-blur-xl">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            SmartAPI Next
          </h1>
          <p className="text-zinc-400 text-sm font-medium">
            Log in to your Angel One developer platform
          </p>
        </div>

        <form onSubmit={handleLogin} className="w-full space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-widest font-bold text-zinc-500 pl-1">
              Client ID
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. S273572"
              required
              className="w-full h-12 px-4 rounded-xl bg-black/50 border border-zinc-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-zinc-700"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-widest font-bold text-zinc-500 pl-1">
              Angel One PIN
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full h-12 px-4 rounded-xl bg-black/50 border border-zinc-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-zinc-700"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !pin}
            className="w-full h-12 mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transform hover:-translate-y-0.5"
          >
            {loading ? (
              <span className="animate-pulse">Authenticating Base...</span>
            ) : (
              <span>Secure Login Entry</span>
            )}
          </button>
        </form>

        {error && (
          <div className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-in fade-in slide-in-from-bottom-2">
            <p className="font-bold flex items-center gap-2 mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              Authentication Failed
            </p>
            <p className="break-words opacity-90 pl-6">{error}</p>
          </div>
        )}
      </main>
    </div>
  );
}
