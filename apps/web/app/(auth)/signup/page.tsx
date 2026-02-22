"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/react";

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
      setError("Le nom d'utilisateur doit contenir au moins 2 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
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
      setMessage("Verifiez votre boite mail pour confirmer votre compte.");
    }

    setLoading(false);
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-semibold text-foreground">WattHunter</h1>
        <p className="text-sm text-muted-foreground">
          Creer votre compte
        </p>
      </div>

      <Button
        variant="outline"
        className="w-full gap-3"
        onClick={handleGoogleLogin}
      >
        <Icon icon="solar:letter-linear" className="size-4" />
        Continuer avec Google
      </Button>

      <div className="flex w-full items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSignup} className="flex w-full flex-col gap-4">
        <Input
          type="text"
          placeholder="Nom d'utilisateur"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={2}
          maxLength={30}
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <Input
          type="password"
          placeholder="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-accent">{message}</p>}

        <Button type="submit" variant="brand" className="w-full" disabled={loading}>
          {loading ? "Creation..." : "Creer un compte"}
        </Button>
      </form>

      <Link
        href="/login"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Deja un compte ? Se connecter
      </Link>

      <p className="text-center text-xs text-muted-foreground">
        En continuant, vous acceptez nos conditions d&apos;utilisation.
      </p>
    </div>
  );
}
