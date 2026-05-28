export default async function LobbyPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  await params;
  return (
    <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
      Loading lobby…
    </p>
  );
}
