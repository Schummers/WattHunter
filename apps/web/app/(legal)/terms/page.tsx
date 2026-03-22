import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — WattHunter",
};

export default function TermsPage() {
  return (
    <article className="space-y-6 text-[length:var(--type-body)] text-[var(--text-mid)] leading-relaxed">
      <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
        Terms of Service
      </h1>
      <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
        Last updated: March 22, 2026
      </p>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          1. Acceptance of Terms
        </h2>
        <p>
          By accessing or using WattHunter, you agree to be bound by these
          Terms of Service. If you do not agree to these terms, you may not use
          the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          2. Description of Service
        </h2>
        <p>
          WattHunter is a free-to-play fantasy cycling game. Players build
          teams of professional cyclists, compete in leagues, and earn points
          based on real-world race results. The game uses publicly available
          cycling statistics for scoring.
        </p>
        <p>
          WattHunter does not involve real money transactions, gambling, or
          betting of any kind. All in-game currency and values are virtual and
          have no real-world monetary value.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          3. Account Registration
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>You must provide accurate information when creating an account.</li>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>One account per person. Multiple accounts are not permitted.</li>
          <li>
            You may sign in using email/password or Google OAuth. By using
            Google sign-in, you authorize us to access your basic profile
            information as described in our{" "}
            <a
              href="/privacy"
              className="text-[var(--accent-default)] hover:text-[var(--accent-highlight)] underline"
            >
              Privacy Policy
            </a>
            .
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          4. Game Rules & Fair Play
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Players must respect the game mechanics and play fairly within
            their leagues.
          </li>
          <li>
            Exploiting bugs, using automation tools, or manipulating the
            auction system is prohibited.
          </li>
          <li>
            We reserve the right to suspend or terminate accounts that violate
            fair play rules.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          5. Intellectual Property
        </h2>
        <p>
          WattHunter and its original content, features, and functionality are
          owned by Valoris. Cycling statistics used in the game are sourced
          from publicly available data. Rider names and team names are used for
          informational and entertainment purposes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          6. Availability & Modifications
        </h2>
        <p>
          We strive to keep WattHunter available at all times, but we do not
          guarantee uninterrupted access. We may modify, suspend, or
          discontinue any part of the service at any time without prior notice.
          Game rules, scoring, and mechanics may be adjusted between seasons.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          7. Limitation of Liability
        </h2>
        <p>
          WattHunter is provided &ldquo;as is&rdquo; without warranties of any
          kind. We are not liable for any damages arising from your use of the
          service, including but not limited to loss of game data, scoring
          errors, or service interruptions.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          8. Termination
        </h2>
        <p>
          You may delete your account at any time. We may terminate or suspend
          your account if you violate these terms. Upon termination, your game
          data will be handled as described in our{" "}
          <a
            href="/privacy"
            className="text-[var(--accent-default)] hover:text-[var(--accent-highlight)] underline"
          >
            Privacy Policy
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          9. Governing Law
        </h2>
        <p>
          These terms are governed by the laws of France. Any disputes arising
          from these terms or the use of WattHunter shall be subject to the
          exclusive jurisdiction of the courts of Paris, France.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          10. Contact
        </h2>
        <p>
          For questions about these terms, contact us at:{" "}
          <a
            href="mailto:jonathan.schummers@gmail.com"
            className="text-[var(--accent-default)] hover:text-[var(--accent-highlight)] underline"
          >
            jonathan.schummers@gmail.com
          </a>
        </p>
      </section>
    </article>
  );
}
