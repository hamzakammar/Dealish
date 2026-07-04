"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setSignUpSuccess(true);
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="Dealish" className="h-16 w-16 mx-auto mb-3 rounded-xl object-cover" />
          <h1 className="text-3xl font-bold text-gray-900">Dealish</h1>
          <p className="mt-2 text-gray-600">Restaurant Admin Dashboard</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            {showForgotPassword ? "Reset password" : isSignUp ? "Create account" : "Sign in"}
          </h2>

          {signUpSuccess ? (
            <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
              Account created! Check your email to confirm, then sign in.
            </div>
          ) : showForgotPassword ? (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                Enter your email and we will send you a password reset link.
              </p>
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                  placeholder="you@restaurant.com"
                />
              </div>
              {forgotError && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                  {forgotError}
                </div>
              )}
              {forgotSuccess && (
                <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
                  Reset link sent! Check your email inbox.
                </div>
              )}
              <button
                type="button"
                disabled={forgotLoading || !forgotEmail.trim()}
                onClick={async () => {
                  setForgotLoading(true);
                  setForgotError("");
                  setForgotSuccess(false);
                  const supabase = createClient();
                  const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim());
                  setForgotLoading(false);
                  if (resetError) {
                    setForgotError(resetError.message);
                  } else {
                    setForgotSuccess(true);
                  }
                }}
                className="w-full rounded-xl bg-[#FE902A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#e5811f] focus:outline-none focus:ring-2 focus:ring-[#FE902A] focus:ring-offset-2 disabled:opacity-60 transition-colors"
              >
                {forgotLoading ? "Sending..." : "Send Reset Link"}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setForgotError(""); setForgotSuccess(false); }}
                  className="text-sm text-[#FE902A] hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                  placeholder="you@restaurant.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#FE902A] focus:outline-none focus:ring-1 focus:ring-[#FE902A]"
                  placeholder={isSignUp ? "Create a password (min 6 chars)" : "Enter your password"}
                  minLength={6}
                />
              </div>

              {!isSignUp && (
                <div className="text-right -mt-2">
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setForgotEmail(email); }}
                    className="text-xs text-[#FE902A] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#FE902A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#e5811f] focus:outline-none focus:ring-2 focus:ring-[#FE902A] focus:ring-offset-2 disabled:opacity-60 transition-colors"
              >
                {loading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Create account" : "Sign in")}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-4 text-gray-400">or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                  });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="text-center mt-5">
                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setError(""); setSignUpSuccess(false); }}
                  className="text-sm text-[#FE902A] hover:underline"
                >
                  {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
