"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { ArrowLeft } from "lucide-react";
import { LEVELS, getDefaultStartingLevel } from "@/lib/levels";

export default function CreateLeaguePage() {
  const defaultLevel = getDefaultStartingLevel();
  const [state, formAction, pending] = useActionState(createLeague, null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <Link
        href="/league/choose"
        className="flex items-center gap-1.5 text-[length:var(--type-body)] text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-[length:var(--type-page-title)] font-semibold text-[var(--text-high)]">
          Create a league
        </h2>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Invite your friends with the code generated after creation.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="League name" htmlFor="name">
          <Input
            id="name"
            name="name"
            placeholder="Ex: The Watt Hunters"
            required
            minLength={2}
            maxLength={50}
          />
        </FormField>

        <FormField label="Starting level" htmlFor="starting_level">
          <select
            id="starting_level"
            name="starting_level"
            defaultValue={defaultLevel}
            className="flex h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1 text-[length:var(--type-body)] text-[var(--text-high)] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-default)]"
          >
            {LEVELS.map((l) => (
              <option key={l.level} value={l.level}>
                Level {l.level} — Pool {l.pool}, {l.slots} slots
                {l.level === defaultLevel ? " (Recommended)" : ""}
              </option>
            ))}
          </select>
          <p className="text-[length:var(--type-caption)] text-[var(--text-low)] mt-1">
            We recommend Level {defaultLevel} based on the current racing phase.
            A higher level gives access to better riders and a bigger budget.
          </p>
        </FormField>

        {state?.error && (
          <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{state.error}</p>
        )}

        <Button type="submit" variant="cta" disabled={pending}>
          {pending ? "Creating..." : "Create league"}
        </Button>
      </form>
    </div>
  );
}
