export function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <table className="w-full text-left text-[length:var(--type-caption)]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 font-semibold text-[var(--text-mid)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-[var(--border-subtle)] last:border-0"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-[var(--text-high)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
