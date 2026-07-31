import type { MessageDeliveryStatus } from "@/types/messenger";

export default function MessageStatus({
  status,
}: {
  status: MessageDeliveryStatus;
}) {
  const labels: Record<MessageDeliveryStatus, string> = {
    sending: "Se trimite",
    sent: "Trimis",
    delivered: "Livrat",
    read: "Citit",
    failed: "Eroare",
  };

  const symbol =
    status === "read"
      ? "✓✓"
      : status === "delivered"
        ? "✓✓"
        : status === "failed"
          ? "!"
          : status === "sending"
            ? "…"
            : "✓";

  return <span title={labels[status]} aria-label={labels[status]}>{symbol}</span>;
}
