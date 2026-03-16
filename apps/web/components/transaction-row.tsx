import { formatEuro } from "@/lib/format";

interface TransactionRowProps {
  type: string;
  amount: number;
  description: string | null;
  riderInitials?: string;
  sponsorAbbreviation?: string;
  date: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getAvatar(props: TransactionRowProps): { text: string; isSponsor: boolean } {
  if (props.type === "sponsor_payment") {
    return { text: props.sponsorAbbreviation ?? "SP", isSponsor: true };
  }
  if (props.type === "starting_fund") {
    return { text: "WH", isSponsor: true };
  }
  return { text: props.riderInitials ?? "??", isSponsor: false };
}

function getSubtitle(props: TransactionRowProps): string {
  if (props.type === "sponsor_payment") return "Sponsorship";
  if (props.type === "monthly_salary") return "Salary";
  if (props.type === "monthly_bonus" || props.type === "rider_revenue") {
    return props.description?.split(" — ")[1] ?? "Bonus";
  }
  if (props.type === "auction_purchase") return "Salary";
  if (props.type === "starting_fund") return "Starting fund";
  if (props.type === "bankruptcy_release") return "Bankruptcy release";
  return props.description ?? "";
}

function getName(props: TransactionRowProps): string {
  if (props.type === "sponsor_payment") return props.description ?? "Sponsor";
  if (props.type === "starting_fund") return "Initial treasury";
  if (props.type === "auction_purchase") return props.description?.split(" — ")[1] ?? props.description ?? "Contract";
  if (props.type === "bankruptcy_release") return props.description ?? "Auto-release";
  return props.description?.split(" — ")[0] ?? "Unknown";
}

export function TransactionRow(props: TransactionRowProps) {
  const avatar = getAvatar(props);
  const name = getName(props);
  const subtitle = getSubtitle(props);
  const prefix = props.amount >= 0 ? "+" : "";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[length:var(--type-micro)] font-semibold text-[var(--text-mid)] ${
          avatar.isSponsor ? "bg-[var(--bg-surface-active)]" : "bg-[var(--bg-surface)]"
        }`}
      >
        {avatar.text}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {name}
        </div>
        <div className="truncate text-[length:var(--type-caption)] text-[var(--text-low)]">
          {subtitle}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] tabular-nums">
          {prefix}{formatEuro(Math.abs(props.amount))}
        </div>
        <div className="text-[length:var(--type-micro)] text-[var(--text-low)]">
          {formatDate(props.date)}
        </div>
      </div>
    </div>
  );
}
