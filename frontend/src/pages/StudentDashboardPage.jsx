import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { assignmentsApi, submissionsApi } from '../api/client';
import Navbar from '../components/Navbar';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import SubmissionConfirmModal from '../components/SubmissionConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDateTime, getDueLabel } from '../utils/formatters';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [assignments, setAssignments] = useState([]);
  const [progress, setProgress] = useState({ overall: null, groups: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [assignmentsRes, progressRes] = await Promise.all([
        assignmentsApi.list(),
        submissionsApi.studentProgress(),
      ]);
      setAssignments(assignmentsRes.assignments || []);
      setProgress({
        overall: progressRes.overall || null,
        groups: progressRes.groups || [],
      });
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
      showToast(err.message || 'Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAssignments = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return assignments.filter((item) => {
      if (statusFilter === 'pending' && item.status === 'submitted') return false;
      if (statusFilter === 'submitted' && item.status !== 'submitted') return false;

      if (term) {
        const haystack = [
          item.title,
          item.description,
          ...(item.targetGroups || []).map((g) => g.name),
          ...(item.applicableGroups || []).map((g) => g.name),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [assignments, statusFilter, searchQuery]);

  const overall = progress.overall || {
    totalAssignments: 0,
    completedAssignments: 0,
    partialAssignments: 0,
    pendingAssignments: 0,
    overdueAssignments: 0,
    completionRate: 0,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome, {user?.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Track group progress, open OneDrive submission links, and confirm your submissions.
            </p>
          </div>
          <Link
            to="/student/groups"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Users className="h-4 w-4 text-indigo-600" />
            <span>Manage Groups ({progress.groups.length})</span>
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Overall + Per-Group Progress Section */}
            <section className="mb-8 grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Overall Completion
                    </p>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                      {overall.completionRate}%
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      overall.totalAssignments > 0 &&
                      overall.completedAssignments === overall.totalAssignments
                        ? 'completed_group'
                        : overall.overdueAssignments > 0
                          ? 'overdue'
                          : 'partial'
                    }
                    labelOverride={
                      overall.totalAssignments === 0
                        ? 'No Assignments'
                        : overall.completedAssignments === overall.totalAssignments
                          ? 'All Complete'
                          : overall.overdueAssignments > 0
                            ? `${overall.overdueAssignments} Overdue`
                            : 'In Progress'
                    }
                  />
                </div>

                <div className="mt-4">
                  <ProgressBar
                    value={overall.completionRate}
                    sublabel={`${overall.completedAssignments} of ${overall.totalAssignments} completed`}
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                  <div>
                    <p className="text-lg font-bold tabular-nums text-emerald-600">
                      {overall.completedAssignments}
                    </p>
                    <p className="text-xs text-slate-500">Submitted</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums text-amber-600">
                      {overall.partialAssignments + overall.pendingAssignments}
                    </p>
                    <p className="text-xs text-slate-500">Remaining</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums text-rose-600">
                      {overall.overdueAssignments}
                    </p>
                    <p className="text-xs text-slate-500">Overdue</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Group Progress Overview
                    </h2>
                    <p className="text-xs text-slate-500">
                      Completion status across each group you belong to
                    </p>
                  </div>
                  <Link
                    to="/student/groups"
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    View all groups →
                  </Link>
                </div>

                {progress.groups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      You have not joined or created any group yet.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Create a group and invite teammates by email or Student ID to collaborate on
                      submissions.
                    </p>
                    <Link
                      to="/student/groups"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Create or Join a Group
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    {progress.groups.map((grp) => (
                      <div
                        key={grp.groupId}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <div className="mb-2.5 flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{grp.groupName}</p>
                            <p className="text-xs text-slate-500">
                              {grp.memberCount} {grp.memberCount === 1 ? 'member' : 'members'}
                            </p>
                          </div>
                          <StatusBadge
                            status={
                              grp.totalAssignments > 0 &&
                              grp.completedAssignments === grp.totalAssignments
                                ? 'completed_group'
                                : 'partial'
                            }
                            labelOverride={
                              grp.totalAssignments === 0
                                ? '0 Tasks'
                                : grp.completedAssignments === grp.totalAssignments
                                  ? '100% Complete'
                                  : `${grp.completionRate}% Done`
                            }
                          />
                        </div>
                        <ProgressBar
                          size="sm"
                          value={grp.completionRate}
                          sublabel={`${grp.completedAssignments}/${grp.totalAssignments} assignments`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Assignments Section */}
            <section>
              <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Your Assignments</h2>
                  <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {filteredAssignments.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'pending', label: 'Action Needed' },
                      { id: 'submitted', label: 'Submitted' },
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
                      placeholder="Search assignments..."
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
                    Check back later or clear your search filter.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAssignments.map((assignment) => (
                    <article
                      key={assignment.id}
                      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                        <div className="flex-1 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                              status={assignment.status}
                              isOverdue={assignment.isOverdue}
                              labelOverride={
                                assignment.status === 'partial'
                                  ? `Partial (${assignment.groupStatuses.filter((g) => g.submitted).length}/${assignment.groupStatuses.length} groups)`
                                  : undefined
                              }
                            />
                            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                              {assignment.targetType === 'all'
                                ? 'All Students'
                                : `Assigned to: ${assignment.applicableGroups.map((g) => g.name).join(', ')}`}
                            </span>
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

                          {assignment.canSubmit && (
                            <button
                              type="button"
                              onClick={() => setConfirmTarget(assignment)}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                            >
                              <Send className="h-4 w-4" />
                              <span>Yes, I have submitted</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Submission Confirmation Details */}
                      {(assignment.groupStatuses.length > 0 || assignment.individualSubmission) && (
                        <div className="mt-5 border-t border-slate-100 pt-4">
                          {assignment.groupStatuses.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {assignment.groupStatuses.map((gs) => (
                                <div
                                  key={gs.groupId}
                                  className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
                                    gs.submitted
                                      ? 'border-emerald-200 bg-emerald-50/70'
                                      : 'border-slate-200 bg-slate-50/70'
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <p className="font-semibold text-slate-900">{gs.groupName}</p>
                                    {gs.submitted && gs.submission ? (
                                      <>
                                        <p className="text-emerald-800">
                                          Confirmed by{' '}
                                          <span className="font-semibold">
                                            {gs.submission.confirmedByName}
                                          </span>{' '}
                                          on {formatDateTime(gs.submission.confirmedAt)}
                                        </p>
                                        {gs.submission.note && (
                                          <p className="italic text-slate-600">
                                            “{gs.submission.note}”
                                          </p>
                                        )}
                                      </>
                                    ) : (
                                      <p className="text-slate-500">
                                        Awaiting OneDrive upload confirmation from any group member
                                      </p>
                                    )}
                                  </div>
                                  {gs.submitted ? (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Submitted
                                    </span>
                                  ) : (
                                    <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-0.5 font-medium text-slate-700">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            assignment.individualSubmission && (
                              <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold text-emerald-900">
                                    Individual Submission Verified
                                  </p>
                                  <p className="text-emerald-800">
                                    Confirmed by {assignment.individualSubmission.confirmedByName}{' '}
                                    on {formatDateTime(assignment.individualSubmission.confirmedAt)}
                                  </p>
                                  {assignment.individualSubmission.note && (
                                    <p className="italic text-slate-600">
                                      “{assignment.individualSubmission.note}”
                                    </p>
                                  )}
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Submitted
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <SubmissionConfirmModal
        assignment={confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirmed={() => {
          setConfirmTarget(null);
          loadData();
        }}
      />
    </div>
  );
}
