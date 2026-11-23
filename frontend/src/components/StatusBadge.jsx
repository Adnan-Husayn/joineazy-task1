import { AlertTriangle, CheckCircle2, Clock, Sparkles } from 'lucide-react';

const STATUS_STYLES = {
  submitted: {
    label: 'Submitted',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Icon: CheckCircle2,
  },
  partial: {
    label: 'Partial',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    Icon: Clock,
  },
  pending: {
    label: 'Pending',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    Icon: Clock,
  },
  overdue: {
    label: 'Overdue',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    Icon: AlertTriangle,
  },
  completed_group: {
    label: '100% Complete',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Icon: Sparkles,
  },
};

export default function StatusBadge({ status, isOverdue = false, labelOverride }) {
  const effectiveKey = isOverdue && status !== 'submitted' ? 'overdue' : status;
  const config = STATUS_STYLES[effectiveKey] || STATUS_STYLES.pending;
  const { Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{labelOverride || config.label}</span>
    </span>
  );
}
