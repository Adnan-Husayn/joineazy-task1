import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  Plus,
  TrendingUp,
  User,
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
import { coursesApi, submissionsApi } from '../api/client';
import CreateCourseModal from '../components/CreateCourseModal';
import Navbar from '../components/Navbar';
import ProgressBar from '../components/ProgressBar';
import { useToast } from '../context/ToastContext';
import { getCourseTheme } from '../utils/courseTheme';
import { formatDateTime } from '../utils/formatters';

function AssignmentTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <div className="flex items-center gap-1.5">
        {data.courseCode && (
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
            {data.courseCode}
          </span>
        )}
        <span className="text-[10px] font-semibold uppercase text-slate-400">
          {data.submissionType}
        </span>
      </div>
      <p className="mt-1 font-semibold text-slate-900">{data.title}</p>
      {data.submissionType === 'group' && (
        <p className="mt-1.5 text-indigo-600">
          Group Completion: <span className="font-semibold">{data.groupCompletionRate}%</span> (
          {data.submittedGroups}/{data.eligibleGroups} groups)
        </p>
      )}
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
        {data.completedAssignments}/{data.totalAssignments} group assignments)
      </p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { showToast } = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createCourseOpen, setCreateCourseOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setError('');
      const [analyticsRes, coursesRes] = await Promise.all([
        submissionsApi.analytics(),
        coursesApi.list(),
      ]);
      setAnalytics(analyticsRes);
      setCourses(coursesRes.courses || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
      showToast(err.message || 'Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = analytics?.summary || {
    totalCourses: 0,
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
              Professor Dashboard & Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage courses, monitor individual and group submissions, and inspect completion metrics.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setCreateCourseOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create Course
            </button>
            <Link
              to="/admin/assignments"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4 text-indigo-600" />
              Assignments
            </Link>
            <Link
              to="/admin/tracking"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Submission Tracking
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={loadDashboard}
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
                    Courses & Tasks
                  </span>
                  <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                    <BookMarked className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
                  {courses.length}{' '}
                  <span className="text-base font-medium text-slate-500">
                    / {summary.totalAssignments} tasks
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {summary.totalGroups} groups & {summary.totalStudents} enrolled students
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Group Leader Ack Rate
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
                    Overdue Pending
                  </span>
                  <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
                  {summary.overduePendingCount}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Past-due slots awaiting acknowledgment
                </p>
              </div>
            </section>

            {/* Courses Taught Grid */}
            <section className="mb-10">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Courses Taught</h2>
                  <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {courses.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateCourseOpen(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  + Add course
                </button>
              </div>

              {courses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                  <p className="text-sm font-medium text-slate-700">No courses created yet.</p>
                  <button
                    type="button"
                    onClick={() => setCreateCourseOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Your First Course
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {courses.map((course) => {
                    const theme = getCourseTheme(course.accentColor);
                    return (
                      <Link
                        key={course.id}
                        to={`/admin/courses/${course.id}`}
                        className={`group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${theme.ring}`}
                      >
                        <div className={`h-1.5 w-full ${theme.strip}`} />
                        <div className="flex flex-1 flex-col justify-between p-5">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold ${theme.badge}`}
                              >
                                {course.code}
                              </span>
                              <span className="text-xs font-medium text-slate-400">
                                {course.semester}
                              </span>
                            </div>
                            <h3 className="mt-2.5 text-base font-bold text-slate-900 group-hover:text-indigo-700">
                              {course.title}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3.5 w-3.5 text-slate-400" />
                                {course.studentCount} students
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                                {course.assignmentCount} assignments
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            <ProgressBar
                              size="sm"
                              value={course.completionRate}
                              colorClass={
                                course.completionRate === 100 && course.totalSlots > 0
                                  ? 'bg-emerald-500'
                                  : theme.bar
                              }
                              label={`${course.submittedCount} submitted • ${course.pendingCount} pending`}
                              sublabel={`${course.completionRate}%`}
                            />

                            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs font-semibold text-indigo-600">
                              <span>Manage course & submissions</span>
                              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Recharts Analytics */}
            <section className="mb-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    Per-Assignment Completion Rate
                  </h2>
                  <p className="text-xs text-slate-500">
                    Group completion % and student coverage % across assignments
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
                    Completion percentage across each registered student group
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
                    Recent Submission Acknowledgments
                  </h2>
                  <p className="text-xs text-slate-500">
                    Latest verified OneDrive upload confirmations from students and group leaders
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
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                          {item.courseCode && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                              {item.courseCode}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                              item.submissionType === 'individual'
                                ? 'bg-sky-50 text-sky-700'
                                : 'bg-violet-50 text-violet-700'
                            }`}
                          >
                            {item.submissionType === 'individual' ? (
                              <User className="h-3 w-3" />
                            ) : (
                              <Users className="h-3 w-3" />
                            )}
                            {item.submissionType === 'individual' ? 'Individual' : 'Group'}
                          </span>
                          <span>
                            <span className="font-semibold">{item.confirmedByName}</span>{' '}
                            <span className="text-slate-500">acknowledged</span>{' '}
                            <span className="font-semibold text-indigo-700">
                              {item.assignmentTitle}
                            </span>{' '}
                            <span className="text-slate-500">for</span>{' '}
                            <span className="font-medium text-slate-800">{item.groupName}</span>
                          </span>
                        </div>
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
                  No submission acknowledgments recorded yet.
                </p>
              )}
            </section>
          </>
        )}
      </main>

      {createCourseOpen && (
        <CreateCourseModal
          onClose={() => setCreateCourseOpen(false)}
          onCreated={() => {
            setCreateCourseOpen(false);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
}
