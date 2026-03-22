"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { Mail } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (displayName.trim().length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: displayName.trim(),
        },
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email to confirm your account.");
    }

    setLoading(false);
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
          Create your account
        </p>
      </div>

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

      <form onSubmit={handleSignup} className="flex w-full flex-col gap-4">
        <FormField label="Username" htmlFor="displayName">
          <Input
            id="displayName"
            type="text"
            placeholder="johndoe"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={2}
            maxLength={30}
          />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            placeholder="Min. 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirmPassword">
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </FormField>

        {error && <p className="-mt-2 text-[length:var(--type-caption)] text-[var(--status-danger)]">{error}</p>}
        {message && <p className="-mt-2 text-[length:var(--type-caption)] text-[var(--status-success)]">{message}</p>}

        <Button type="submit" variant="cta" className="mt-4 w-full" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>

      <Link
        href="/login"
        className="text-[length:var(--type-body)] text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors"
      >
        Already have an account? Sign in
      </Link>

      <p className="text-center text-[length:var(--type-caption)] text-[var(--text-low)]">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-[var(--text-mid)] transition-colors">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-[var(--text-mid)] transition-colors">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
