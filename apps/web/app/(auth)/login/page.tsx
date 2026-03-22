"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [passwordUpdated, setPasswordUpdated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("message") === "password_updated") {
      setPasswordUpdated(true);
    }
  }, []);

  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/auth/callback?next=/";
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-2 mb-2">
        <Image
          src="/watthunter-icon.png"
          alt="WattHunter"
          width={48}
          height={48}
        />
        <h1 className="text-[length:var(--type-page-title)] font-semibold text-[var(--text-high)]">WattHunter</h1>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          The fantasy league where your team grows with you.
        </p>
      </div>

      {passwordUpdated && (
        <p className="w-full text-center text-[length:var(--type-caption)] text-[var(--status-success)]">
          Password updated successfully. Sign in with your new password.
        </p>
      )}

      <Button
        variant="outline"
        className="w-full gap-3"
        onClick={handleGoogleLogin}
      >
        <Mail className="size-4" />
        Continue with Google
      </Button>

      <div className="flex w-full items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">or</span>
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      </div>

      <form onSubmit={handleEmailLogin} className="flex w-full flex-col gap-4">
        <FormField label="Email" htmlFor="login-email">
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Password" htmlFor="login-password">
          <Input
            id="login-password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>
        <Link
          href="/forgot-password"
          className="self-end text-[length:var(--type-caption)] text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors -mt-2"
        >
          Forgot password?
        </Link>

        {error && <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{error}</p>}

        <Button type="submit" variant="cta" className="mt-4 w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <Link
        href="/signup"
        className="text-[length:var(--type-body)] text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors"
      >
        Don&apos;t have an account? Sign up
      </Link>

      <p className="text-center text-[length:var(--type-caption)] text-[var(--text-low)]">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="hover:text-[var(--text-mid)] transition-colors">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="hover:text-[var(--text-mid)] transition-colors">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
