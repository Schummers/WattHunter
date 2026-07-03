export function AuctionExplainer() {
  return (
    <section
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
    >
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        How the first auction works
      </h2>
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Three sealed-bid rounds, one per day. Each round auto-closes after its
        deadline and the next one opens automatically. Bids are revealed only
        after a round closes — your strategy stays private until then.
      </p>
    </section>
  );
}
