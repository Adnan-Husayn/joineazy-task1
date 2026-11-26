import { useState } from 'react';
import { BookMarked, Loader2, X } from 'lucide-react';
import { coursesApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import { COURSE_COLOR_OPTIONS, COURSE_THEMES } from '../utils/courseTheme';

export default function CreateCourseModal({ onClose, onCreated }) {
  const { showToast } = useToast();

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [semester, setSemester] = useState('Fall 2026');
  const [accentColor, setAccentColor] = useState('indigo');
  const [description, setDescription] = useState('');
  const [enrollAllStudents, setEnrollAllStudents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length < 2) {
      setError('Course code must be at least 2 characters (e.g. CS405).');
      return;
    }
    if (title.trim().length < 3) {
      setError('Course title must be at least 3 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await coursesApi.create({
        code: normalizedCode,
        title: title.trim(),
        semester: semester.trim() || 'Fall 2026',
        accentColor,
        description: description.trim(),
        enrollAllStudents,
      });
      showToast(`Created course ${res.course.code} — ${res.course.title}`, 'success');
      onCreated(res.course);
    } catch (err) {
      setError(err.message || 'Could not create course');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-course-title"
    >
      <div className="animate-modal-in w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BookMarked className="h-5 w-5" />
            </div>
            <div>
              <h2 id="create-course-title" className="text-base font-semibold text-slate-900">
                Create New Course
              </h2>
              <p className="text-xs text-slate-500">
                Set up a course container for assignments and student enrollments
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="course-code"
                className="mb-1.5 block text-sm font-medium text-slate-800"
              >
                Course Code
              </label>
              <input
                id="course-code"
                type="text"
                required
                maxLength={30}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., CS405"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm uppercase text-slate-900 placeholder:normal-case focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="course-semester"
                className="mb-1.5 block text-sm font-medium text-slate-800"
              >
                Semester
              </label>
              <input
                id="course-semester"
                type="text"
                required
                maxLength={60}
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="Fall 2026"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="course-title"
              className="mb-1.5 block text-sm font-medium text-slate-800"
            >
              Course Title
            </label>
            <input
              id="course-title"
              type="text"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Cloud Infrastructure & Observability"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-800">Accent Color</span>
            <div className="flex flex-wrap gap-2">
              {COURSE_COLOR_OPTIONS.map((option) => {
                const theme = COURSE_THEMES[option.id];
                const selected = accentColor === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAccentColor(option.id)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${theme.swatch}`} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="course-description"
              className="mb-1.5 block text-sm font-medium text-slate-800"
            >
              Course Summary <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="course-description"
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Topics covered, lab format, and project expectations..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <input
              type="checkbox"
              checked={enrollAllStudents}
              onChange={(e) => setEnrollAllStudents(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <span className="text-xs leading-relaxed text-slate-700">
              <strong>Auto-enroll all registered students</strong> so they can see this course on
              their dashboard right away.
            </span>
          </label>

          {error && (
            <p className="animate-fade-in rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{submitting ? 'Creating...' : 'Create Course'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
