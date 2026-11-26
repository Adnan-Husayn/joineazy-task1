import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Crown, Search, User, Users } from 'lucide-react';
import { assignmentsApi, coursesApi, submissionsApi } from '../api/client';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/formatters';

export default function AdminTrackingPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState('group');
  const [courseId, setCourseId] = useState(searchParams.get('courseId') || '');
  const [assignmentId, setAssignmentId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [groupWise, setGroupWise] = useState([]);
  const [studentWise, setStudentWise] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([coursesApi.list(), assignmentsApi.list()])
      .then(([coursesRes, assignmentsRes]) => {
        setCourses(coursesRes.courses || []);
        setAssignments(assignmentsRes.assignments || []);
      })
      .catch(() => {});
  }, []);

  const visibleAssignmentOptions = useMemo(() => {
    if (!courseId) return assignments;
    return assignments.filter((a) => String(a.courseId) === String(courseId));
  }, [assignments, courseId]);

  function handleCourseChange(nextCourseId) {
    setCourseId(nextCourseId);
    setAssignmentId('');
    if (nextCourseId) {
      setSearchParams({ courseId: nextCourseId });
    } else {
      setSearchParams({});
    }
  }

  const loadTracking = useCallback(async () => {
    setLoading(true);
    try {
      const res = await submissionsApi.tracking({
        courseId: courseId || undefined,
        assignmentId: assignmentId || undefined,
        status: statusFilter,
        search: searchQuery.trim() || undefined,
      });
      setGroupWise(res.groupWise || []);
      setStudentWise(res.studentWise || []);
    } catch (err) {
      showToast(err.message || 'Failed to load tracking records', 'error');
    } finally {
      setLoading(false);
    }
  }, [courseId, assignmentId, statusFilter, searchQuery, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTracking();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadTracking]);

  const activeRows = viewMode === 'group' ? groupWise : studentWise;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Submission Tracking
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Inspect group-wise leader acknowledgments and student-wise individual & group status.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('group')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === 'group'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Group-wise ({groupWise.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('student')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === 'student'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Student-wise ({studentWise.length})</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="filter-course"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Course
            </label>
            <select
              id="filter-course"
              value={courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-assignment"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Assignment
            </label>
            <select
              id="filter-assignment"
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">All Assignments</option>
              {visibleAssignmentOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.courseCode ? `[${a.courseCode}] ` : ''}
                  {a.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-status"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Status
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              {viewMode === 'student' && <option value="partial">Partial (Multi-Group)</option>}
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-search"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="filter-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  viewMode === 'group'
                    ? 'Course, group, leader, or task...'
                    : 'Course, student, ID, or group...'
                }
                className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>

        {/* Tracking Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading submission records...
            </div>
          ) : activeRows.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                No tracking rows match your filters.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try clearing the search query or changing the course, assignment, or status filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">
                      {viewMode === 'group' ? 'Group' : 'Student'}
                    </th>
                    <th className="px-5 py-3.5">Course & Assignment</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Acknowledged By</th>
                    <th className="px-5 py-3.5">Timestamp & Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewMode === 'group'
                    ? groupWise.map((row) => (
                        <tr
                          key={`${row.assignmentId}-${row.groupId}`}
                          className="hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4 align-top">
                            <p className="font-semibold text-slate-900">{row.groupName}</p>
                            {row.leaderName && (
                              <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                                <Crown className="h-3 w-3" />
                                Leader: {row.leaderName}
                              </p>
                            )}
                            <p className="mt-0.5 text-xs text-slate-500">
                              {row.members.map((m) => m.name).join(', ') || 'No members'}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              {row.courseCode && (
                                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700">
                                  {row.courseCode}
                                </span>
                              )}
                              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">
                                Group
                              </span>
                            </div>
                            <p className="font-medium text-slate-900">{row.assignmentTitle}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Due {formatDateTime(row.dueDate)}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <StatusBadge status={row.status} isOverdue={row.isOverdue} />
                          </td>
                          <td className="px-5 py-4 align-top text-slate-700">
                            {row.confirmedByName ? (
                              <div>
                                <p className="font-medium text-slate-900">
                                  {row.confirmedByName}
                                </p>
                                {row.confirmedByStudentId && (
                                  <p className="text-xs text-slate-500">
                                    {row.confirmedByStudentId}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Waiting for leader ({row.leaderName || 'Group Leader'})
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top">
                            {row.confirmedAt ? (
                              <div>
                                <p className="text-xs font-medium tabular-nums text-slate-700">
                                  {formatDateTime(row.confirmedAt)}
                                </p>
                                {row.note && (
                                  <p className="mt-1 max-w-xs text-xs italic text-slate-500">
                                    “{row.note}”
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    : studentWise.map((row) => (
                        <tr
                          key={`${row.assignmentId}-${row.studentId}`}
                          className="hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900">{row.studentName}</p>
                              {row.studentCode && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                  {row.studentCode}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{row.studentEmail}</p>
                            {row.applicableGroups.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {row.groupStatuses.map((gs) => (
                                  <span
                                    key={gs.groupId}
                                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                                      gs.submitted
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {gs.groupName}: {gs.submitted ? 'Acknowledged' : 'Pending'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              {row.courseCode && (
                                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700">
                                  {row.courseCode}
                                </span>
                              )}
                              <span
                                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                  row.submissionType === 'individual'
                                    ? 'bg-sky-50 text-sky-700'
                                    : 'bg-violet-50 text-violet-700'
                                }`}
                              >
                                {row.submissionType === 'individual' ? 'Individual' : 'Group'}
                              </span>
                            </div>
                            <p className="font-medium text-slate-900">{row.assignmentTitle}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Due {formatDateTime(row.dueDate)}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <StatusBadge
                              status={row.status}
                              isOverdue={row.isOverdue}
                              labelOverride={
                                row.status === 'partial'
                                  ? `Partial (${row.groupStatuses.filter((g) => g.submitted).length}/${row.groupStatuses.length})`
                                  : undefined
                              }
                            />
                          </td>
                          <td className="px-5 py-4 align-top">
                            {row.confirmedByName ? (
                              <div>
                                <span className="font-medium text-slate-900">
                                  {row.confirmedByName}
                                </span>
                                {row.submissionType === 'group' && (
                                  <p className="text-xs text-slate-500">Group Leader</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Not acknowledged yet</span>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top">
                            {row.confirmedAt ? (
                              <div>
                                <p className="text-xs font-medium tabular-nums text-slate-700">
                                  {formatDateTime(row.confirmedAt)}
                                </p>
                                {row.note && (
                                  <p className="mt-1 max-w-xs text-xs italic text-slate-500">
                                    “{row.note}”
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
