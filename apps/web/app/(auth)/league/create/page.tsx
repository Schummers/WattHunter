"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

export default function CreateLeaguePage() {
  const [state, formAction, pending] = useActionState(createLeague, null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <Link
        href="/league/choose"
        className="flex items-center gap-1.5 text-sm text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-xl font-semibold text-[var(--text-high)]">
          Create a league
        </h2>
        <p className="text-sm text-[var(--text-mid)]">
          Invite your friends with the code generated after creation.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-[var(--text-high)]">
            League name
          </label>
          <Input
            id="name"
            name="name"
            placeholder="Ex: The Watt Hunters"
            required
            minLength={2}
            maxLength={50}
          />
        </div>

        {state?.error && (
          <p className="text-sm text-[var(--status-danger)]">{state.error}</p>
        )}

        <Button type="submit" variant="cta" disabled={pending}>
          {pending ? "Creating..." : "Create league"}
        </Button>
      </form>
    </div>
  );
}
