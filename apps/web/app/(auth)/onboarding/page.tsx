"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";

const steps = [
  {
    icon: "solar:bicycle-linear",
    title: "Bienvenue sur WattHunter",
    description:
      "Le premier fantasy game base sur le cyclisme professionnel. Construisez votre equipe, suivez les courses reelles et grimpez au classement.",
  },
  {
    icon: "solar:gamepad-linear",
    title: "Comment ca marche ?",
    description:
      "Recrutez des coureurs aux encheres, gagnez des points grace a leurs performances reelles, et montez en niveau pour debloquer de nouveaux avantages.",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const handleComplete = async () => {
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

  const handleSkip = async () => {
    await handleComplete();
    setStep(steps.length);
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete().then(() => setStep(steps.length));
    }
  };

  // Final step — create or join
  if (step >= steps.length) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Icon
            icon="solar:users-group-rounded-linear"
            className="size-12 text-accent"
          />
          <h2 className="text-xl font-semibold text-foreground">
            Rejoignez une ligue
          </h2>
          <p className="text-sm text-muted-foreground">
            Creez votre propre ligue ou rejoignez-en une avec un code
            d&apos;invitation.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            variant="brand"
            className="w-full"
            onClick={() => router.push("/league/create")}
          >
            Creer une ligue
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/league/join")}
          >
            Rejoindre avec un code
          </Button>
        </div>
      </div>
    );
  }

  const currentStep = steps[step];

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-8">
      {/* Step indicator */}
      <div className="flex gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 w-8 rounded-sm transition-colors ${
              i <= step ? "bg-accent" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col items-center gap-4 text-center">
        <Icon
          icon={currentStep.icon}
          className="size-12 text-accent"
        />
        <h2 className="text-xl font-semibold text-foreground">
          {currentStep.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {currentStep.description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex w-full flex-col gap-3">
        <Button variant="brand" className="w-full" onClick={handleNext}>
          Suivant
        </Button>
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={handleSkip}
        >
          Passer
        </Button>
      </div>
    </div>
  );
}
