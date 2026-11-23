import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { submissionsApi } from '../api/client';
import Navbar from '../components/Navbar';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/formatters';

function AssignmentTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{data.title}</p>
      <p className="mt-1.5 text-indigo-600">
        Group Completion: <span className="font-semibold">{data.groupCompletionRate}%</span> (
        {data.submittedGroups}/{data.eligibleGroups} groups)
      </p>
      <p className="mt-0.5 text-emerald-600">
        Student Coverage: <span className="font-semibold">{data.studentCompletionRate}%</span> (
        {data.submittedStudents}/{data.eligibleStudents} students)
      </p>
    </div>
  );
}

function GroupTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{data.groupName}</p>
      <p className="mt-1 text-slate-500">{data.memberCount} members</p>
      <p className="mt-1 text-indigo-600">
        Completion: <span className="font-semibold">{data.completionRate}%</span> (
        {data.completedAssignments}/{data.totalAssignments} assignments)
      </p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { showToast } = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async () => {
    try {
      setError('');
      const res = await submissionsApi.analytics();
      setAnalytics(res);
    } catch (err) {
      setError(err.message || 'Failed to load analytics');
      showToast(err.message || 'Failed to load analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const summary = analytics?.summary || {
    totalAssignments: 0,
    totalStudents: 0,
    totalGroups: 0,
    totalGroupSlots: 0,
    completedGroupSlots: 0,
    overallGroupCompletionRate: 0,
    totalStudentSlots: 0,
    completedStudentSlots: 0,
    overallStudentCompletionRate: 0,
    overduePendingCount: 0,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Professor Analytics Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Monitor submission completion across assignments and student groups.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/admin/assignments"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4 text-indigo-600" />
              Manage Assignments
            </Link>
            <Link
              to="/admin/tracking"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              View Detailed Tracking
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={loadAnalytics}
              className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* KPI Summary Cards */}
            <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Active Assignments
                  </span>
                  <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                    <BookOpen className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
                  {summary.totalAssignments}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Across {summary.totalGroups} groups & {summary.totalStudents} students
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Group Completion
                  </span>
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
                  {summary.overallGroupCompletionRate}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {summary.completedGroupSlots} of {summary.totalGroupSlots} group submissions
                  confirmed
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Student Coverage
                  </span>
                  <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
                  {summary.overallStudentCompletionRate}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {summary.completedStudentSlots} of {summary.totalStudentSlots} student
                  assignments complete
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Overdue Group Tasks
                  </span>
                  <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
                  {summary.overduePendingCount}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Past-due group submissions still pending
                </p>
              </div>
            </section>

            {/* Recharts Analytics */}
            <section className="mb-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    Per-Assignment Completion Rate
                  </h2>
                  <p className="text-xs text-slate-500">
                    Percentage of eligible groups and students confirmed per assignment
                  </p>
                </div>

                {analytics?.perAssignment?.length > 0 ? (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.perAssignment}
                        margin={{ top: 10, right: 12, left: -12, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                          dataKey="shortTitle"
                          tick={{ fontSize: 11, fill: '#475569' }}
                          interval={0}
                          angle={-12}
                          textAnchor="end"
                          height={56}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          unit="%"
                        />
                        <Tooltip content={<AssignmentTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="groupCompletionRate"
                          name="Group Completion %"
                          fill="#4f46e5"
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="studentCompletionRate"
                          name="Student Coverage %"
                          fill="#10b981"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                    No assignment analytics available yet.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    Per-Group Performance
                  </h2>
                  <p className="text-xs text-slate-500">
                    Submission completion percentage across each registered student group
                  </p>
                </div>

                {analytics?.perGroup?.length > 0 ? (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.perGroup}
                        margin={{ top: 10, right: 12, left: -12, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                          dataKey="shortName"
                          tick={{ fontSize: 11, fill: '#475569' }}
                          interval={0}
                          angle={-10}
                          textAnchor="end"
                          height={52}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          unit="%"
                        />
                        <Tooltip content={<GroupTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="completionRate"
                          name="Completion Rate %"
                          fill="#4f46e5"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                    No student groups created yet.
                  </div>
                )}
              </div>
            </section>

            {/* Recent Confirmations Feed */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Recent Submission Confirmations
                  </h2>
                  <p className="text-xs text-slate-500">
                    Latest verified OneDrive upload confirmations from students
                  </p>
                </div>
                <Link
                  to="/admin/tracking"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Open full tracker →
                </Link>
              </div>

              {analytics?.recentActivity?.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {analytics.recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-2 py-3.5 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          <span className="font-semibold">{item.confirmedByName}</span>{' '}
                          <span className="text-slate-500">confirmed</span>{' '}
                          <span className="font-semibold text-indigo-700">
                            {item.assignmentTitle}
                          </span>{' '}
                          <span className="text-slate-500">for</span>{' '}
                          <span className="font-medium text-slate-800">{item.groupName}</span>
                        </p>
                        {item.note && (
                          <p className="mt-0.5 text-xs italic text-slate-500">“{item.note}”</p>
                        )}
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateTime(item.confirmedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">
                  No submission confirmations recorded yet.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
