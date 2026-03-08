import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { InfoCard } from "@/components/info-card";
import { Search, Trophy, TrendingUp, type LucideIcon } from "lucide-react";

const steps: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: Search,
    title: "Hunt the hidden watts",
    description: "Scout and bid on undervalued riders all season long.",
  },
  {
    icon: Trophy,
    title: "Race & earn",
    description: "Real results fuel your XP and grow your budget.",
  },
  {
    icon: TrendingUp,
    title: "Level up",
    description: "Unlock elite riders, sponsors, and new strategies.",
  },
];

export default function OnboardingPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 bg-[var(--bg-app)]">
        <div className="absolute inset-0 animate-mesh-slow">
          <div className="absolute -left-1/4 -top-1/4 h-[60%] w-[60%] rounded-full bg-cyan-700 opacity-20 blur-[100px]" />
          <div className="absolute -bottom-1/4 -right-1/4 h-[60%] w-[60%] rounded-full bg-cyan-600 opacity-15 blur-[100px]" />
          <div className="absolute left-1/3 top-1/2 h-[40%] w-[40%] rounded-full bg-cyan-800 opacity-20 blur-[80px]" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 px-4">
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-2 text-center">
          <Image
            src="/watthunter-icon.svg"
            alt="WattHunter"
            width={56}
            height={56}
            unoptimized
          />
          <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
            WattHunter
          </h1>
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            The fantasy league where your team grows with you.
          </p>
        </div>

        {/* Feature cards */}
        <div className="flex w-full flex-col gap-2.5">
          {steps.map((step, i) => (
            <InfoCard
              key={i}
              className="flex items-center gap-3 px-3.5 py-3"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
                <step.icon className="size-4 text-[var(--accent-default)]" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                  {step.title}
                </h3>
                <p className="text-[length:var(--type-caption)] leading-snug text-[var(--text-mid)]">
                  {step.description}
                </p>
              </div>
            </InfoCard>
          ))}
        </div>

        {/* CTA */}
        <div className="flex w-full flex-col gap-2.5">
          <Button variant="cta" className="w-full" asChild>
            <Link href="/signup">Get started</Link>
          </Button>
          <Link
            href="/login"
            className="text-center text-[length:var(--type-body)] text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Already have an account? Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
