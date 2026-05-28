export default function LobbyLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-1/2 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-surface)]" />
      <div className="h-32 w-full animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-surface)]" />
      <div className="h-32 w-full animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-surface)]" />
    </div>
  );
}
