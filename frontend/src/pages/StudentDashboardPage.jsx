import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Layers,
  User,
  Users,
} from 'lucide-react';
import { coursesApi, submissionsApi } from '../api/client';
import Navbar from '../components/Navbar';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getCourseTheme } from '../utils/courseTheme';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [courses, setCourses] = useState([]);
  const [progress, setProgress] = useState({ overall: null, groups: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [coursesRes, progressRes] = await Promise.all([
        coursesApi.list(),
        submissionsApi.studentProgress(),
      ]);
      setCourses(coursesRes.courses || []);
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
              Select an enrolled course to review assignments, OneDrive links, and submission status.
            </p>
          </div>
          <Link
            to="/student/groups"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Users className="h-4 w-4 text-indigo-600" />
            <span>My Groups ({progress.groups.length})</span>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-2" />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
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
            {/* Top-Level Quick Stats + Group Summary */}
            <section className="mb-10 grid gap-6 lg:grid-cols-3">
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
                    sublabel={`${overall.completedAssignments} of ${overall.totalAssignments} completed across ${courses.length} courses`}
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                  <div>
                    <p className="text-lg font-bold tabular-nums text-emerald-600">
                      {overall.completedAssignments}
                    </p>
                    <p className="text-xs text-slate-500">Acknowledged</p>
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
                      Your Group Teams
                    </h2>
                    <p className="text-xs text-slate-500">
                      Group leaders acknowledge submissions for the whole team
                    </p>
                  </div>
                  <Link
                    to="/student/groups"
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Manage groups →
                  </Link>
                </div>

                {progress.groups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      You have not joined or created any group yet.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Create a group and invite teammates by email or Student ID to collaborate on
                      group assignments.
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
                          sublabel={`${grp.completedAssignments}/${grp.totalAssignments} group assignments`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Enrolled Courses Grid */}
            <section>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Enrolled Courses</h2>
                  <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {courses.length}
                  </span>
                </div>
              </div>

              {courses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                  <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    You are not enrolled in any courses yet.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Ask your professor to enroll your Student ID in a course.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {courses.map((course) => {
                    const theme = getCourseTheme(course.accentColor);
                    const isComplete =
                      course.totalAssignments > 0 &&
                      course.completedAssignments === course.totalAssignments;

                    return (
                      <Link
                        key={course.id}
                        to={`/student/courses/${course.id}`}
                        className={`group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${theme.ring}`}
                      >
                        <div className={`h-1.5 w-full ${theme.strip}`} />

                        <div className="flex flex-1 flex-col justify-between p-6">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold tracking-wide ${theme.badge}`}
                                >
                                  {course.code}
                                </span>
                                <span className="text-xs font-medium text-slate-400">
                                  {course.semester}
                                </span>
                              </div>
                              <StatusBadge
                                status={
                                  isComplete
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
                                    : isComplete
                                      ? '100% Complete'
                                      : course.overdueAssignments > 0
                                        ? `${course.overdueAssignments} Overdue`
                                        : `${course.completionRate}% Done`
                                }
                              />
                            </div>

                            <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-900 group-hover:text-indigo-700">
                              {course.title}
                            </h3>

                            {course.description && (
                              <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">
                                {course.description}
                              </p>
                            )}
                          </div>

                          <div className="mt-5 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                                <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                                {course.professorName}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                                  <User className="h-3 w-3" />
                                  {course.individualCount} Ind
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                                  <Users className="h-3 w-3" />
                                  {course.groupCount} Grp
                                </span>
                              </div>
                            </div>

                            <ProgressBar
                              size="sm"
                              value={course.completionRate}
                              colorClass={isComplete ? 'bg-emerald-500' : theme.bar}
                              label={`${course.completedAssignments} of ${course.totalAssignments} assignments`}
                              sublabel={`${course.completionRate}%`}
                            />

                            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-indigo-600">
                              <span>Open course assignments</span>
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
