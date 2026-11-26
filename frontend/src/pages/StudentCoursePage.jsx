import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Crown,
  ExternalLink,
  GraduationCap,
  Lock,
  Search,
  Send,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { coursesApi } from '../api/client';
import Navbar from '../components/Navbar';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import SubmissionConfirmModal from '../components/SubmissionConfirmModal';
import { useToast } from '../context/ToastContext';
import { getCourseTheme } from '../utils/courseTheme';
import { formatDateTime, getDueLabel } from '../utils/formatters';

export default function StudentCoursePage() {
  const { courseId } = useParams();
  const { showToast } = useToast();

  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmState, setConfirmState] = useState(null);
  const [justConfirmedId, setJustConfirmedId] = useState(null);

  const loadCourse = useCallback(async () => {
    try {
      setError('');
      const res = await coursesApi.get(courseId);
      setCourse(res.course);
      setAssignments(res.assignments || []);
    } catch (err) {
      setError(err.message || 'Failed to load course assignments');
      showToast(err.message || 'Failed to load course', 'error');
    } finally {
      setLoading(false);
    }
  }, [courseId, showToast]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const filteredAssignments = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return assignments.filter((item) => {
      if (statusFilter === 'pending' && item.status === 'submitted') return false;
      if (statusFilter === 'submitted' && item.status !== 'submitted') return false;

      if (term) {
        const haystack = [
          item.title,
          item.description,
          item.submissionType,
          ...(item.applicableGroups || []).map((g) => g.name),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [assignments, statusFilter, searchQuery]);

  const theme = getCourseTheme(course?.accentColor);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link to="/student" className="inline-flex items-center gap-1 hover:text-indigo-600">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Courses</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800">
            {course ? `${course.code} — ${course.title}` : 'Course Assignments'}
          </span>
        </nav>

        {loading ? (
          <div className="space-y-6">
            <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            <p className="font-semibold">{error}</p>
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={loadCourse}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Retry
              </button>
              <Link
                to="/student"
                className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700"
              >
                Back to Courses
              </Link>
            </div>
          </div>
        ) : course ? (
          <>
            {/* Course Header Card */}
            <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className={`h-2 w-full ${theme.strip}`} />
              <div className="p-6 sm:p-7">
                <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold tracking-wide ${theme.badge}`}
                      >
                        {course.code}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {course.semester}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                        {course.professorName}
                      </span>
                    </div>

                    <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900">
                      {course.title}
                    </h1>
                    {course.description && (
                      <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
                        {course.description}
                      </p>
                    )}
                  </div>

                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-4 lg:w-80">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Course Progress
                      </span>
                      <StatusBadge
                        status={
                          course.totalAssignments > 0 &&
                          course.completedAssignments === course.totalAssignments
                            ? 'completed_group'
                            : course.overdueAssignments > 0
                              ? 'overdue'
                              : course.completionRate > 0
                                ? 'partial'
                                : 'pending'
                        }
                        labelOverride={
                          course.totalAssignments === 0
                            ? 'No Tasks'
                            : course.completedAssignments === course.totalAssignments
                              ? '100% Complete'
                              : `${course.completionRate}% Complete`
                        }
                      />
                    </div>
                    <ProgressBar
                      value={course.completionRate}
                      colorClass={
                        course.completedAssignments === course.totalAssignments &&
                        course.totalAssignments > 0
                          ? 'bg-emerald-500'
                          : theme.bar
                      }
                      sublabel={`${course.completedAssignments} of ${course.totalAssignments} acknowledged`}
                    />
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Individual: {course.individualCompletedCount}/{course.individualCount}
                      </span>
                      <span>
                        Group: {course.groupCompletedCount}/{course.groupCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Assignment Filters */}
            <section>
              <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Course Assignments</h2>
                  <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {filteredAssignments.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'pending', label: 'Action Needed' },
                      { id: 'submitted', label: 'Acknowledged' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusFilter(tab.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          statusFilter === tab.id
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search course assignments..."
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:w-64"
                    />
                  </div>
                </div>
              </div>

              {filteredAssignments.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                  <p className="text-sm font-medium text-slate-700">
                    No assignments match the current filter.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Switch tabs or clear your search query to view all assignments.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAssignments.map((assignment) => {
                    const isIndividual = assignment.submissionType === 'individual';
                    const isNewlyConfirmed = justConfirmedId === assignment.id;

                    return (
                      <article
                        key={assignment.id}
                        className={`rounded-2xl border bg-white p-6 shadow-sm transition-all ${
                          isNewlyConfirmed
                            ? 'border-emerald-400 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 hover:shadow-md'
                        }`}
                      >
                        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                          <div className="flex-1 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2">
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

                              <StatusBadge
                                status={assignment.status}
                                isOverdue={assignment.isOverdue}
                                animateCheck={assignment.status === 'submitted'}
                                labelOverride={
                                  assignment.status === 'submitted'
                                    ? isIndividual
                                      ? 'Acknowledged'
                                      : 'Acknowledged by Leader'
                                    : assignment.status === 'partial'
                                      ? `Partial (${assignment.groupStatuses.filter((g) => g.submitted).length}/${assignment.groupStatuses.length} groups)`
                                      : undefined
                                }
                              />

                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium ${
                                  assignment.isOverdue ? 'text-rose-600' : 'text-slate-500'
                                }`}
                              >
                                <Calendar className="h-3.5 w-3.5" />
                                {getDueLabel(assignment.dueDate, assignment.status)} •{' '}
                                {formatDateTime(assignment.dueDate)}
                              </span>
                            </div>

                            <h3 className="text-lg font-semibold text-slate-900">
                              {assignment.title}
                            </h3>

                            {assignment.description && (
                              <p className="text-sm leading-relaxed text-slate-600">
                                {assignment.description}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                            <a
                              href={assignment.onedriveLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                            >
                              <ExternalLink className="h-4 w-4" />
                              <span>Open OneDrive Link</span>
                            </a>

                            {isIndividual && assignment.canSubmit && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmState({ assignment, initialGroupId: null })
                                }
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                              >
                                <Send className="h-4 w-4" />
                                <span>Yes, I have submitted</span>
                              </button>
                            )}

                            {!isIndividual &&
                              assignment.canSubmit &&
                              assignment.groupStatuses.filter((g) => !g.submitted && g.isLeader)
                                .length === 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetGroup = assignment.groupStatuses.find(
                                      (g) => !g.submitted && g.isLeader
                                    );
                                    setConfirmState({
                                      assignment,
                                      initialGroupId: targetGroup?.groupId || null,
                                    });
                                  }}
                                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                                >
                                  <ShieldCheck className="h-4 w-4" />
                                  <span>Acknowledge for Group (Leader)</span>
                                </button>
                              )}
                          </div>
                        </div>

                        {/* Individual Acknowledged Banner */}
                        {isIndividual && assignment.individualSubmission && (
                          <div className="mt-5 border-t border-slate-100 pt-4">
                            <div className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs sm:flex-row sm:items-center">
                              <div className="flex items-start gap-2.5">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 animate-check-pop text-emerald-600" />
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-emerald-900">
                                    Individual Submission Acknowledged
                                  </p>
                                  <p className="text-emerald-800">
                                    Confirmed on{' '}
                                    {formatDateTime(assignment.individualSubmission.confirmedAt)}
                                  </p>
                                  {assignment.individualSubmission.note && (
                                    <p className="italic text-slate-600">
                                      “{assignment.individualSubmission.note}”
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                                <CheckCircle2 className="h-3.5 w-3.5 animate-check-pop" />
                                Acknowledged
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Group Submission Details & Leader-Only Enforcement */}
                        {!isIndividual && (
                          <div className="mt-5 border-t border-slate-100 pt-4">
                            {assignment.isUngrouped ? (
                              <div className="flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs sm:flex-row sm:items-center">
                                <div className="flex items-center gap-2 text-amber-900">
                                  <Users className="h-4 w-4 shrink-0 text-amber-700" />
                                  <span>
                                    This is a group assignment. Join or create a group to submit
                                    with your teammates.
                                  </span>
                                </div>
                                <Link
                                  to="/student/groups"
                                  className="inline-flex w-fit items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
                                >
                                  Go to My Groups
                                </Link>
                              </div>
                            ) : (
                              <div
                                className={`grid gap-3 ${
                                  assignment.groupStatuses.length > 1
                                    ? 'sm:grid-cols-2'
                                    : 'grid-cols-1'
                                }`}
                              >
                                {assignment.groupStatuses.map((gs) => (
                                  <div
                                    key={gs.groupId}
                                    className={`flex flex-col justify-between gap-3 rounded-xl border px-4 py-3.5 text-xs sm:flex-row sm:items-center ${
                                      gs.submitted
                                        ? 'border-emerald-200 bg-emerald-50/70'
                                        : gs.isLeader
                                          ? 'border-indigo-200 bg-indigo-50/40'
                                          : 'border-slate-200 bg-slate-50/80'
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      {gs.submitted ? (
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 animate-check-pop text-emerald-600" />
                                      ) : gs.isLeader ? (
                                        <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                      ) : (
                                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                                      )}

                                      <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-semibold text-slate-900">
                                            {gs.groupName}
                                          </p>
                                          {gs.isLeader ? (
                                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                                              <Crown className="h-3 w-3" />
                                              You are Leader
                                            </span>
                                          ) : (
                                            <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                              Leader: {gs.leaderName || 'Assigned'}
                                            </span>
                                          )}
                                        </div>

                                        {gs.submitted && gs.submission ? (
                                          <>
                                            <p className="text-emerald-800">
                                              Acknowledged by Leader (
                                              <span className="font-semibold">
                                                {gs.submission.confirmedByName}
                                              </span>
                                              ) on {formatDateTime(gs.submission.confirmedAt)}
                                            </p>
                                            {gs.submission.note && (
                                              <p className="italic text-slate-600">
                                                “{gs.submission.note}”
                                              </p>
                                            )}
                                          </>
                                        ) : gs.isLeader ? (
                                          <p className="text-indigo-800">
                                            Upload your files to OneDrive, then acknowledge for all
                                            group members.
                                          </p>
                                        ) : (
                                          <p className="font-medium text-slate-600">
                                            Group Leader Only — Waiting for{' '}
                                            <span className="font-semibold text-slate-800">
                                              {gs.leaderName || 'your group leader'}
                                            </span>{' '}
                                            to acknowledge
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 items-center">
                                      {gs.submitted ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                                          <CheckCircle2 className="h-3.5 w-3.5 animate-check-pop" />
                                          Acknowledged by Leader
                                        </span>
                                      ) : gs.isLeader ? (
                                        assignment.groupStatuses.filter(
                                          (g) => !g.submitted && g.isLeader
                                        ).length > 1 ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setConfirmState({
                                                assignment,
                                                initialGroupId: gs.groupId,
                                              })
                                            }
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
                                          >
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Acknowledge for Group (Leader)
                                          </button>
                                        ) : (
                                          <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-semibold text-indigo-800">
                                            Ready for Leader
                                          </span>
                                        )
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600">
                                          <Lock className="h-3 w-3" />
                                          Read-Only (Member)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>

      <SubmissionConfirmModal
        assignment={confirmState?.assignment || null}
        initialGroupId={confirmState?.initialGroupId || null}
        onClose={() => setConfirmState(null)}
        onConfirmed={(confirmedAssignmentId) => {
          setConfirmState(null);
          setJustConfirmedId(confirmedAssignmentId);
          loadCourse();
        }}
      />
    </div>
  );
}
