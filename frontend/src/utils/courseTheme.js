export const COURSE_THEMES = {
  indigo: {
    strip: 'bg-indigo-600',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    iconBg: 'bg-indigo-50 text-indigo-600',
    bar: 'bg-indigo-600',
    swatch: 'bg-indigo-600',
    ring: 'hover:border-indigo-300',
  },
  emerald: {
    strip: 'bg-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-50 text-emerald-600',
    bar: 'bg-emerald-600',
    swatch: 'bg-emerald-600',
    ring: 'hover:border-emerald-300',
  },
  amber: {
    strip: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    iconBg: 'bg-amber-50 text-amber-600',
    bar: 'bg-amber-500',
    swatch: 'bg-amber-500',
    ring: 'hover:border-amber-300',
  },
  violet: {
    strip: 'bg-violet-600',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    iconBg: 'bg-violet-50 text-violet-600',
    bar: 'bg-violet-600',
    swatch: 'bg-violet-600',
    ring: 'hover:border-violet-300',
  },
  sky: {
    strip: 'bg-sky-600',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    iconBg: 'bg-sky-50 text-sky-600',
    bar: 'bg-sky-600',
    swatch: 'bg-sky-600',
    ring: 'hover:border-sky-300',
  },
  rose: {
    strip: 'bg-rose-600',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    iconBg: 'bg-rose-50 text-rose-600',
    bar: 'bg-rose-600',
    swatch: 'bg-rose-600',
    ring: 'hover:border-rose-300',
  },
};

export const COURSE_COLOR_OPTIONS = [
  { id: 'indigo', label: 'Indigo' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'amber', label: 'Amber' },
  { id: 'violet', label: 'Violet' },
  { id: 'sky', label: 'Sky' },
  { id: 'rose', label: 'Rose' },
];

export function getCourseTheme(accentColor) {
  return COURSE_THEMES[accentColor] || COURSE_THEMES.indigo;
}
