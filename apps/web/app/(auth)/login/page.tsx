"use client";

import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
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
        <Icon icon="solar:letter-linear" className="size-4" />
        Continuer avec Google
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        En continuant, vous acceptez nos conditions d&apos;utilisation.
      </p>
    </div>
  );
}
