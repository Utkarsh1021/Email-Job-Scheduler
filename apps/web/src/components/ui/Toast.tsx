export function Toast({
  message,
  tone = "error",
  onClose,
}: {
  message: string;
  tone?: "error" | "success";
  onClose: () => void;
}) {
  const color = tone === "error" ? "bg-red-600" : "bg-emerald-600";
  return (
    <div className={`fixed bottom-6 right-6 z-50 ${color} text-white rounded-2xl px-4 py-3 shadow-lg max-w-sm`}>
      <div className="flex items-start gap-3">
        <p className="text-sm">{message}</p>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          ×
        </button>
      </div>
    </div>
  );
}
