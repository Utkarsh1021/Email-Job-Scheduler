const styles: Record<string, string> = {
  scheduled: "bg-amber-50 text-amber-800",
  processing: "bg-sky-50 text-sky-800",
  sent: "bg-emerald-50 text-emerald-800",
  failed: "bg-red-50 text-red-800",
};

export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-neutral-100"}`}
    >
      {status}
    </span>
  );
}
