export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[var(--bg-app)] p-4">
      {children}
    </div>
  );
}
