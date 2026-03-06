"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
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
      <div className="flex flex-col items-center gap-3 text-center">
        <Zap size={48} className="text-[var(--accent-highlight)]" />
        <h1 className="text-2xl font-bold text-[var(--text-high)]">
          WattHunter
        </h1>
        <p className="text-sm text-[var(--text-mid)]">
          Le fantasy game du cyclisme professionnel
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/80 p-4 backdrop-blur"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
              <step.icon className="size-5 text-[var(--accent-default)]" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-[var(--text-high)]">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--text-mid)]">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button
          variant="cta"
          className="w-full"
          onClick={async () => {
            await markOnboarded();
            router.push("/league/join");
          }}
        >
          Get started
        </Button>
        <Link
          href="/login"
          className="text-center text-sm text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors"
        >
          Already have an account? Log in
        </Link>
      </div>
    </div>
  );
}
