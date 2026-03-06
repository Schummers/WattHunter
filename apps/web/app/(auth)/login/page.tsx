"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
    <div className="flex w-full max-w-sm flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-semibold text-foreground">WattHunter</h1>
        <p className="text-sm text-muted-foreground">
          Le fantasy game du cyclisme professionnel
        </p>
      </div>

      <Button
        variant="outline"
        className="w-full gap-3"
        onClick={handleGoogleLogin}
      >
        <Mail className="size-4" />
        Continuer avec Google
      </Button>

      <div className="flex w-full items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailLogin} className="flex w-full flex-col gap-4">
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
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" variant="cta" className="w-full" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </Button>
      </form>

      <Link
        href="/signup"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Pas encore de compte ? Creer un compte
      </Link>

      <p className="text-center text-xs text-muted-foreground">
        En continuant, vous acceptez nos conditions d&apos;utilisation.
      </p>
    </div>
  );
}
