import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { assignmentsApi, coursesApi, groupsApi } from '../api/client';
import AssignmentModal from '../components/AssignmentModal';
import Navbar from '../components/Navbar';
import ProgressBar from '../components/ProgressBar';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/formatters';

export default function AdminAssignmentsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [courseFilter, setCourseFilter] = useState(searchParams.get('courseId') || '');
  const [submissionFilter, setSubmissionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [assignmentsRes, coursesRes, groupsRes] = await Promise.all([
        assignmentsApi.list(),
        coursesApi.list(),
        groupsApi.list(),
      ]);
      setAssignments(assignmentsRes.assignments || []);
      setCourses(coursesRes.courses || []);
      setGroups(groupsRes.groups || []);
    } catch (err) {
      setError(err.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleCourseFilterChange(nextCourseId) {
    setCourseFilter(nextCourseId);
    if (nextCourseId) {
      setSearchParams({ courseId: nextCourseId });
    } else {
      setSearchParams({});
    }
  }

  const filteredAssignments = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return assignments.filter((item) => {
      if (courseFilter && String(item.courseId) !== String(courseFilter)) {
        return false;
      }
      if (submissionFilter !== 'all' && item.submissionType !== submissionFilter) {
        return false;
      }
      if (term) {
        const text = `${item.courseCode || ''} ${item.courseTitle || ''} ${item.title} ${item.description} ${(
          item.targetGroups || []
        )
          .map((g) => g.name)
          .join(' ')}`.toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });
  }, [assignments, courseFilter, submissionFilter, searchQuery]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await assignmentsApi.delete(deleteTarget.id);
      showToast(`Deleted "${deleteTarget.title}"`, 'success');
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Could not delete assignment', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Manage Assignments
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Publish Individual or Group assignments across your courses with OneDrive links.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingAssignment(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            <span>Create Assignment</span>
          </button>
        </div>

        <div className="mb-6 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter by course"
              value={courseFilter}
              onChange={(e) => handleCourseFilterChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>

            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              {[
                { id: 'all', label: 'All Types' },
                { id: 'group', label: 'Group' },
                { id: 'individual', label: 'Individual' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubmissionFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    submissionFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses, titles, or groups..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:w-72"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-700">No assignments found.</p>
            <p className="mt-1 text-xs text-slate-500">
              Create an assignment or adjust your course/type filters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAssignments.map((assignment) => {
              const isIndividual = assignment.submissionType === 'individual';
              const stats = assignment.stats || {
                eligibleGroups: 0,
                submittedGroups: 0,
                groupCompletionRate: 0,
                eligibleStudents: 0,
                submittedStudents: 0,
                studentCompletionRate: 0,
                isOverdue: false,
              };

              return (
                <article
                  key={assignment.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="flex-1 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {assignment.courseCode && (
                          <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                            {assignment.courseCode}
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            isIndividual
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-violet-200 bg-violet-50 text-violet-700'
                          }`}
                        >
                          {isIndividual ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Users className="h-3 w-3" />
                          )}
                          {isIndividual ? 'Individual' : 'Group'}
                        </span>

                        {!isIndividual && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {assignment.targetType === 'all'
                              ? 'All Course Groups'
                              : `${assignment.targetGroups.length} Target ${
                                  assignment.targetGroups.length === 1 ? 'Group' : 'Groups'
                                }`}
                          </span>
                        )}

                        {!isIndividual &&
                          assignment.targetType === 'specific_groups' &&
                          assignment.targetGroups.map((tg) => (
                            <span
                              key={tg.id}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                            >
                              {tg.name}
                            </span>
                          ))}

                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            stats.isOverdue ? 'text-rose-600' : 'text-slate-500'
                          }`}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Due {formatDateTime(assignment.dueDate)}
                        </span>
                      </div>

                      <h2 className="text-lg font-semibold text-slate-900">{assignment.title}</h2>
                      {assignment.description && (
                        <p className="text-sm leading-relaxed text-slate-600">
                          {assignment.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <a
                        href={assignment.onedriveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-indigo-600" />
                        OneDrive
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAssignment(assignment);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(assignment)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    {isIndividual ? (
                      <ProgressBar
                        size="sm"
                        label="Individual Acknowledgments"
                        value={stats.studentCompletionRate}
                        sublabel={`${stats.submittedStudents}/${stats.eligibleStudents} students (${stats.studentCompletionRate}%)`}
                      />
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <ProgressBar
                          size="sm"
                          label="Group Submissions (Leader Confirmed)"
                          value={stats.groupCompletionRate}
                          sublabel={`${stats.submittedGroups}/${stats.eligibleGroups} groups (${stats.groupCompletionRate}%)`}
                        />
                        <ProgressBar
                          size="sm"
                          label="Student Coverage"
                          value={stats.studentCompletionRate}
                          sublabel={`${stats.submittedStudents}/${stats.eligibleStudents} students (${stats.studentCompletionRate}%)`}
                        />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {modalOpen && (
        <AssignmentModal
          assignment={editingAssignment}
          courses={courses}
          defaultCourseId={courseFilter ? Number(courseFilter) : null}
          groups={groups}
          onClose={() => {
            setModalOpen(false);
            setEditingAssignment(null);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditingAssignment(null);
            loadData();
          }}
        />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="animate-modal-in w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Delete Assignment?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Deleting <span className="font-semibold">{deleteTarget.title}</span> will also
              remove all confirmation records associated with it.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
