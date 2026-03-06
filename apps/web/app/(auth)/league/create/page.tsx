"use client";

import { useActionState } from "react";
import { createLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CreateLeaguePage() {
  const [state, formAction, pending] = useActionState(createLeague, null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Creer une ligue
        </h2>
        <p className="text-sm text-muted-foreground">
          Invitez vos amis avec le code genere apres creation.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Nom de la ligue
          </label>
          <Input
            id="name"
            name="name"
            placeholder="Ex: Les Forcats de la Route"
            required
            minLength={2}
            maxLength={50}
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button type="submit" variant="cta" disabled={pending}>
          {pending ? "Creation..." : "Creer la ligue"}
        </Button>
      </form>
    </div>
  );
}
