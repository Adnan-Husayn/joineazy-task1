export default function ProgressBar({
  value = 0,
  label,
  sublabel,
  colorClass,
  size = 'md',
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const resolvedColor =
    colorClass ||
    (clamped === 100
      ? 'bg-emerald-500'
      : clamped >= 50
        ? 'bg-indigo-600'
        : clamped > 0
          ? 'bg-amber-500'
          : 'bg-slate-300');

  const heightClass = size === 'sm' ? 'h-2' : 'h-2.5';

  return (
    <div className="w-full">
      {(label || sublabel) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          {label ? <span className="font-medium text-slate-700">{label}</span> : <span />}
          {sublabel && <span className="tabular-nums font-medium text-slate-500">{sublabel}</span>}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${heightClass}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${resolvedColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
