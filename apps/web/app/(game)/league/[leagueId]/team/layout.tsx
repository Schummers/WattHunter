import { SubTabs } from "@/components/sub-tabs";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  return (
    <>
      <SubTabs
        tabs={[
          { label: "My Team", href: `/league/${leagueId}/team` },
          { label: "Recruts", href: `/league/${leagueId}/team/recruts` },
        ]}
      />
      {children}
    </>
  );
}
