import { statusLabel, statusClasses } from "@/lib/format";

export function StatusBadge({ status }: { status: number }) {
  return (
    <span className={`badge ${statusClasses(status)}`}>
      {statusLabel(status)}
    </span>
  );
}
