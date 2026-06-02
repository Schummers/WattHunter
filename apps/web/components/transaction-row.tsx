import Image from "next/image";
import { formatMoney } from "@/lib/format";
import { resolvePhotoUrl } from "@/lib/photo-url";

interface TransactionRowProps {
  type: string;
  amount: number;
  description: string | null;
  date: string;
  riderPhotoUrl?: string | null;
  riderName?: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getAvatarFallback(type: string): { text: string; isSponsor: boolean } {
  if (type === "sponsor_payment") return { text: "SP", isSponsor: true };
  if (type === "sponsor_bonus") return { text: "B", isSponsor: true };
  if (type === "starting_fund") return { text: "WH", isSponsor: true };
  if (type === "payday_salary") return { text: "SAL", isSponsor: false };
  if (type === "release_fee") return { text: "REL", isSponsor: false };
  if (type === "transfer_bonus") return { text: "TR", isSponsor: false };
  if (type === "bankruptcy_release") return { text: "BR", isSponsor: false };
  return { text: "??", isSponsor: false };
}

function getSubtitle(type: string, description: string | null): string {
  switch (type) {
    case "sponsor_payment": return "Sponsorship";
    case "sponsor_bonus": return "Race bonus";
    case "payday_salary": return "Salary";
    case "monthly_salary":
    case "phase_salary": return "Salary";
    case "auction_purchase": return "Salary";
    case "release_fee": return "Release fee";
    case "transfer_bonus": return "Transfer bonus";
    case "starting_fund": return "Starting fund";
    case "bankruptcy_release": return "Bankruptcy release";
    case "monthly_bonus":
    case "rider_revenue": return description?.split(" — ")[1] ?? "Bonus";
    default: return description ?? "";
  }
}

function getName(type: string, description: string | null, riderName?: string | null): string {
  // If we have a rider name from the join, use it for rider-related types
  if (riderName && ["payday_salary", "auction_purchase", "release_fee", "transfer_bonus", "sponsor_bonus", "bankruptcy_release"].includes(type)) {
    return riderName;
  }

  switch (type) {
    case "sponsor_payment": return description ?? "Sponsor";
    case "sponsor_bonus": return description ?? "Sponsor bonus";
    case "payday_salary": return description ?? "Phase salaries";
    case "phase_salary": return description ?? "Phase salaries";
    case "starting_fund": return "Initial treasury";
    case "auction_purchase": return description?.split(" — ")[1] ?? description ?? "Contract";
    case "release_fee": return description ?? "Release";
    case "transfer_bonus": return description ?? "Transfer";
    case "bankruptcy_release": return description ?? "Auto-release";
    default: return description?.split(" — ")[0] ?? "Unknown";
  }
}

export function TransactionRow(props: TransactionRowProps) {
  const name = getName(props.type, props.description, props.riderName);
  const subtitle = getSubtitle(props.type, props.description);
  const prefix = props.amount >= 0 ? "+" : "";
  const avatar = getAvatarFallback(props.type);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Avatar — rider photo or fallback circle */}
      {props.riderPhotoUrl ? (
        <Image
          src={resolvePhotoUrl(props.riderPhotoUrl)!}
          alt={name}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[length:var(--type-micro)] font-semibold text-[var(--text-mid)] ${
            avatar.isSponsor ? "bg-[var(--bg-surface-active)]" : "bg-[var(--bg-surface)]"
          }`}
        >
          {avatar.text}
        </div>
      )}

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
          {prefix}{formatMoney(props.amount)}
        </div>
        <div className="text-[length:var(--type-micro)] text-[var(--text-low)]">
          {formatDate(props.date)}
        </div>
      </div>
    </div>
  );
}
