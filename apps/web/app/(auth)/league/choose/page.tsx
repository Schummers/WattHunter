"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus, ArrowRight } from "lucide-react";

export default function ChooseLeaguePage() {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <Image
          src="/watthunter-icon.png"
          alt="WattHunter"
          width={48}
          height={48}
        />
        <h1 className="text-[length:var(--type-page-title)] font-semibold text-[var(--text-high)]">
          WattHunter
        </h1>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Create a new league or join an existing one.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Link
          href="/league/create"
          className="flex items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--bg-surface-hover)]"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-active)]">
            <Plus className="size-5 text-[var(--accent-default)]" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
              Create a league
            </span>
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              Start a new league and invite your friends.
            </span>
          </div>
        </Link>

        <Link
          href="/league/join"
          className="flex items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--bg-surface-hover)]"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-active)]">
            <ArrowRight className="size-5 text-[var(--accent-default)]" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
              Join a league
            </span>
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              Enter the 6-character code from your Race Director.
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
