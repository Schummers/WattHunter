export function GameLoopExplainer() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        The game loop
      </h2>
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Riders race → your team earns <strong className="text-[var(--text-high)]">XP</strong>{" "}
        → XP unlocks the next <strong className="text-[var(--text-high)]">Level</strong>{" "}
        → each level grants more rider slots, better sponsors, and new strategy types.
        Sponsors top up your <strong className="text-[var(--text-high)]">Treasury</strong>{" "}
        once per WT phase. Treasury funds your bids at the next auction. Picking the
        right starting level shapes the whole season.
      </p>
    </section>
  );
}
