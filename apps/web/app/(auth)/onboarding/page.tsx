"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Rocket, type LucideIcon } from "lucide-react";

const steps: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: Shield,
    title: "Hunt the hidden watts",
    description:
      "Scout undervalued riders who punch above their weight. Build the best value team in the league.",
  },
  {
    icon: Zap,
    title: "Real races, real rewards",
    description:
      "Your riders compete, you score XP and earn cash. Every finish line counts.",
  },
  {
    icon: Rocket,
    title: "Level up your squad",
    description:
      "Unlock better riders, new strategies, and bigger sponsors as your team grows.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();

  const markOnboarded = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("users")
        .update({ has_onboarded: true })
        .eq("id", user.id);
    }
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Bienvenue sur WattHunter
        </h1>
        <p className="text-sm text-muted-foreground">
          Le fantasy game du cyclisme professionnel
        </p>
      </div>

      <div className="flex w-full flex-col">
        {steps.map((step, i) => (
          <div key={i}>
            {i > 0 && <div className="h-px bg-border" />}
            <div className="flex gap-4 py-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-wh-accent-muted">
                <step.icon className="size-5 text-accent" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button
          variant="brand"
          className="w-full"
          onClick={async () => {
            await markOnboarded();
            router.push("/league/join");
          }}
        >
          Rejoindre une ligue
        </Button>
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={async () => {
            await markOnboarded();
            router.push("/league/create");
          }}
        >
          Creer une ligue
        </Button>
      </div>
    </div>
  );
}
