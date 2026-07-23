type Props = {
  value: number | string;
  label: string;
  icon?: string;
};

export default function AuroraStat({ value, label, icon }: Props) {
  return (
    <div className="group rounded-3xl border border-white/60 bg-white/55 p-4 text-center shadow-lg backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-105 hover:bg-white/80">
      {icon && <div className="mb-1 text-xl">{icon}</div>}
      <div className="text-2xl font-extrabold tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-500">{label}</div>
    </div>
  );
}
