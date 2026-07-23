const SUPABASE_PAGE_SIZE = 1_000;

type SupabasePage<T> = {
  data: T[] | null;
};

export async function fetchAllSupabasePages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data } = await fetchPage(from, from + SUPABASE_PAGE_SIZE - 1);
    const page = data ?? [];
    rows.push(...page);

    if (page.length < SUPABASE_PAGE_SIZE) return rows;
  }
}
