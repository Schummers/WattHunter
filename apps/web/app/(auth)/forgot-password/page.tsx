"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
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
        <h1 className="text-[length:var(--type-page-title)] font-semibold text-[var(--text-high)]">
          Reset your password
        </h1>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {sent ? (
        <div className="flex w-full flex-col items-center gap-4">
          <p className="text-[length:var(--type-body)] text-[var(--status-success)] text-center">
            Check your email for the reset link.
          </p>
          <Link
            href="/login"
            className="text-[length:var(--type-body)] text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
            <FormField label="Email" htmlFor="forgot-email">
              <Input
                id="forgot-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </FormField>

            {error && (
              <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">
                {error}
              </p>
            )}

            <Button type="submit" variant="cta" className="mt-4 w-full" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <Link
            href="/login"
            className="text-[length:var(--type-body)] text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Back to login
          </Link>
        </>
      )}
    </div>
  );
}
