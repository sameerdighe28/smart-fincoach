"use client";
import { useState } from "react";
import { Shield, Eye, EyeOff, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";

interface LoginPageProps {
  onLogin: (token: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.loginStep1(email, password);
      setSessionToken(res.session_token);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.loginStep2(email, otp, sessionToken);
      localStorage.setItem("fc_token", res.access_token);
      onLogin(res.access_token);
    } catch (err: any) {
      setError(err.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            ₹
          </div>
          <h1 className="text-2xl font-bold">FinCoach</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Smart Finance Ledger</p>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] space-y-4">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Access — Step {step} of 2</span>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${step >= 1 ? "bg-brand-500" : "bg-white/20"}`} />
            <div className={`w-8 h-0.5 ${step >= 2 ? "bg-brand-500" : "bg-white/10"}`} />
            <div className={`w-2 h-2 rounded-full ${step >= 2 ? "bg-brand-500" : "bg-white/20"}`} />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/50"
                  placeholder="admin@example.com"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/50 pr-10"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {loading ? "Verifying..." : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-[var(--muted)]">Enter your verification code</p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Logged in as{" "}
                  <span className="text-brand-400">
                    {email}
                  </span>
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">OTP Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/50 tracking-[0.3em] text-center font-mono text-lg"
                  placeholder="••••••"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 4}
                className="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Verifying..." : "Verify & Login"}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setOtp(""); setError(""); }}
                className="w-full py-2 text-xs text-[var(--muted)] hover:text-white flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
