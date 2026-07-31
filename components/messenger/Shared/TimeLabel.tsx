type TimeLabelProps = {
  isoDate: string | null | undefined;
};

export default function TimeLabel({ isoDate }: TimeLabelProps) {
  if (!isoDate) return null;

  const date = new Date(isoDate);
  const label = new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return <time dateTime={isoDate}>{label}</time>;
}
