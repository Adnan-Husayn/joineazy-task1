import { useEffect, useState } from 'react';
import { BookOpen, Loader2, User, Users, X } from 'lucide-react';
import { assignmentsApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import { toDatetimeLocalValue } from '../utils/formatters';

export default function AssignmentModal({
  assignment,
  courses = [],
  defaultCourseId = null,
  groups = [],
  onClose,
  onSaved,
}) {
  const { showToast } = useToast();
  const isEditing = Boolean(assignment);

  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [onedriveLink, setOnedriveLink] = useState('');
  const [submissionType, setSubmissionType] = useState('group');
  const [targetType, setTargetType] = useState('all');
  const [targetGroupIds, setTargetGroupIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (assignment) {
      setCourseId(assignment.courseId ? String(assignment.courseId) : '');
      setTitle(assignment.title || '');
      setDescription(assignment.description || '');
      setDueDate(toDatetimeLocalValue(assignment.dueDate));
      setOnedriveLink(assignment.onedriveLink || '');
      setSubmissionType(assignment.submissionType || 'group');
      setTargetType(assignment.targetType || 'all');
      setTargetGroupIds((assignment.targetGroups || []).map((g) => g.id));
    } else {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(23, 59, 0, 0);
      const initialCourse =
        defaultCourseId || (courses.length > 0 ? courses[0].id : '');
      setCourseId(initialCourse ? String(initialCourse) : '');
      setTitle('');
      setDescription('');
      setDueDate(toDatetimeLocalValue(nextWeek.toISOString()));
      setOnedriveLink('https://onedrive.live.com/?id=joineazy-submission-folder');
      setSubmissionType('group');
      setTargetType('all');
      setTargetGroupIds([]);
    }
    setError('');
  }, [assignment, courses, defaultCourseId]);

  function handleSubmissionTypeChange(nextType) {
    setSubmissionType(nextType);
    if (nextType === 'individual') {
      setTargetType('all');
      setTargetGroupIds([]);
    }
  }

  function toggleGroup(groupId) {
    setTargetGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (courses.length > 0 && !courseId) {
      setError('Please select a course for this assignment.');
      return;
    }

    if (!dueDate) {
      setError('Please select a due date and time.');
      return;
    }

    const effectiveTargetType = submissionType === 'individual' ? 'all' : targetType;
    if (effectiveTargetType === 'specific_groups' && targetGroupIds.length === 0) {
      setError('Please select at least one target group.');
      return;
    }

    const payload = {
      courseId: courseId ? Number(courseId) : null,
      title: title.trim(),
      description: description.trim(),
      dueDate: new Date(dueDate).toISOString(),
      onedriveLink: onedriveLink.trim(),
      submissionType,
      targetType: effectiveTargetType,
      targetGroupIds: effectiveTargetType === 'specific_groups' ? targetGroupIds : [],
    };

    setSubmitting(true);
    try {
      if (isEditing) {
        await assignmentsApi.update(assignment.id, payload);
        showToast('Assignment updated successfully', 'success');
      } else {
        await assignmentsApi.create(payload);
        showToast('Assignment created successfully', 'success');
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Could not save assignment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-modal-title"
    >
      <div className="animate-modal-in max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 id="assignment-modal-title" className="text-base font-semibold text-slate-900">
                {isEditing ? 'Edit Assignment' : 'Create New Assignment'}
              </h2>
              <p className="text-xs text-slate-500">
                Assign to a course, pick Individual or Group acknowledgment, and set OneDrive link
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
          {courses.length > 0 && (
            <div>
              <label
                htmlFor="assignment-course"
                className="mb-1.5 block text-sm font-medium text-slate-800"
              >
                Course
              </label>
              <select
                id="assignment-course"
                required
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="" disabled>
                  Select a course...
                </option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} — {course.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="assignment-title"
              className="mb-1.5 block text-sm font-medium text-slate-800"
            >
              Assignment Title
            </label>
            <input
              id="assignment-title"
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Lab 3: Distributed Locking with Redis"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="assignment-description"
              className="mb-1.5 block text-sm font-medium text-slate-800"
            >
              Instructions & Deliverables
            </label>
            <textarea
              id="assignment-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline required files, naming conventions, and grading criteria..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="assignment-due"
                className="mb-1.5 block text-sm font-medium text-slate-800"
              >
                Due Date & Time
              </label>
              <input
                id="assignment-due"
                type="datetime-local"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="assignment-onedrive"
                className="mb-1.5 block text-sm font-medium text-slate-800"
              >
                OneDrive Submission Link
              </label>
              <input
                id="assignment-onedrive"
                type="url"
                required
                value={onedriveLink}
                onChange={(e) => setOnedriveLink(e.target.value)}
                placeholder="https://onedrive.live.com/..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-800">Submission Type</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSubmissionTypeChange('group')}
                className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                  submissionType === 'group'
                    ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-900 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  Group
                </span>
                <p className="mt-0.5 text-xs font-normal text-slate-500">
                  Group leader acknowledges for all members
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSubmissionTypeChange('individual')}
                className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                  submissionType === 'individual'
                    ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-900 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  Individual
                </span>
                <p className="mt-0.5 text-xs font-normal text-slate-500">
                  Each student acknowledges individually
                </p>
              </button>
            </div>
          </div>

          {submissionType === 'group' ? (
            <div>
              <span className="mb-2 block text-sm font-medium text-slate-800">Assign To</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetType('all')}
                  className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                    targetType === 'all'
                      ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-900 ring-1 ring-indigo-600'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All Groups
                  <p className="mt-0.5 text-xs font-normal text-slate-500">
                    Visible to every group in this course
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('specific_groups')}
                  className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                    targetType === 'specific_groups'
                      ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-900 ring-1 ring-indigo-600'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Specific Groups
                  <p className="mt-0.5 text-xs font-normal text-slate-500">
                    Select one or more student groups
                  </p>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
              Individual assignments automatically apply to every student enrolled in the selected
              course.
            </div>
          )}

          {submissionType === 'group' && targetType === 'specific_groups' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <Users className="h-3.5 w-3.5" />
                  Select Target Groups ({targetGroupIds.length} selected)
                </span>
              </div>

              {groups.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No student groups have been created yet.
                </p>
              ) : (
                <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {groups.map((group) => {
                    const checked = targetGroupIds.includes(group.id);
                    return (
                      <label
                        key={group.id}
                        className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                          checked
                            ? 'border-indigo-300 bg-white text-slate-900'
                            : 'border-transparent bg-white/70 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroup(group.id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                          />
                          <span className="font-medium">{group.name}</span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
              <span>
                {submitting
                  ? 'Saving...'
                  : isEditing
                    ? 'Save Changes'
                    : 'Publish Assignment'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
