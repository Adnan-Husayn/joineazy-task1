import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronRight,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { assignmentsApi, coursesApi, groupsApi } from '../api/client';
import AssignmentModal from '../components/AssignmentModal';
import Navbar from '../components/Navbar';
import ProgressBar from '../components/ProgressBar';
import { useToast } from '../context/ToastContext';
import { getCourseTheme } from '../utils/courseTheme';
import { formatDateTime } from '../utils/formatters';

export default function AdminCoursePage() {
  const { courseId } = useParams();
  const { showToast } = useToast();

  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [enrollIdentifier, setEnrollIdentifier] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [courseRes, coursesRes, groupsRes] = await Promise.all([
        coursesApi.get(courseId),
        coursesApi.list(),
        groupsApi.list(),
      ]);
      setCourse(courseRes.course);
      setAssignments(courseRes.assignments || []);
      setEnrolledStudents(courseRes.enrolledStudents || []);
      setAllCourses(coursesRes.courses || []);
      setGroups(groupsRes.groups || []);
    } catch (err) {
      setError(err.message || 'Failed to load course details');
      showToast(err.message || 'Failed to load course', 'error');
    } finally {
      setLoading(false);
    }
  }, [courseId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleEnrollStudent(e) {
    e.preventDefault();
    const value = enrollIdentifier.trim();
    if (!value) return;

    setEnrolling(true);
    try {
      const res = await coursesApi.enroll(courseId, value);
      showToast(res.message || 'Student enrolled', 'success');
      setEnrollIdentifier('');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Could not enroll student', 'error');
    } finally {
      setEnrolling(false);
    }
  }

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

  const theme = getCourseTheme(course?.accentColor);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link to="/admin" className="inline-flex items-center gap-1 hover:text-indigo-600">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Courses & Analytics</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800">
            {course ? `${course.code} — ${course.title}` : 'Course'}
          </span>
        </nav>

        {loading ? (
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />
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
        ) : course ? (
          <>
            <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className={`h-2 w-full ${theme.strip}`} />
              <div className="flex flex-col justify-between gap-6 p-6 lg:flex-row lg:items-center">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold ${theme.badge}`}>
                      {course.code}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {course.semester}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {course.studentCount} enrolled students • {course.assignmentCount} assignments
                    </span>
                  </div>
                  <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900">
                    {course.title}
                  </h1>
                  {course.description && (
                    <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{course.description}</p>
                  )}

                  <div className="mt-4 max-w-md">
                    <ProgressBar
                      size="sm"
                      value={course.completionRate}
                      colorClass={
                        course.completionRate === 100 && course.totalSlots > 0
                          ? 'bg-emerald-500'
                          : theme.bar
                      }
                      label={`${course.submittedCount} submitted • ${course.pendingCount} pending`}
                      sublabel={`${course.completionRate}% overall`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <Link
                    to={`/admin/tracking?courseId=${course.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                    Course Tracking
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAssignment(null);
                      setModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create Assignment
                  </button>
                </div>
              </div>
            </section>

            <div className="grid gap-8 lg:grid-cols-3">
              {/* Assignments column */}
              <section className="space-y-4 lg:col-span-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-slate-900">
                    Course Assignments ({assignments.length})
                  </h2>
                </div>

                {assignments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                    <p className="text-sm font-medium text-slate-700">
                      No assignments in {course.code} yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAssignment(null);
                        setModalOpen(true);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Assignment
                    </button>
                  </div>
                ) : (
                  assignments.map((assignment) => {
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
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div className="flex-1 space-y-2">
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
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium ${
                                  stats.isOverdue ? 'text-rose-600' : 'text-slate-500'
                                }`}
                              >
                                <Calendar className="h-3.5 w-3.5" />
                                Due {formatDateTime(assignment.dueDate)}
                              </span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-900">
                              {assignment.title}
                            </h3>
                            {assignment.description && (
                              <p className="text-sm text-slate-600">{assignment.description}</p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <a
                              href={assignment.onedriveLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(assignment)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-slate-100 pt-3.5">
                          {isIndividual ? (
                            <ProgressBar
                              size="sm"
                              label="Individual Acknowledgments"
                              value={stats.studentCompletionRate}
                              sublabel={`${stats.submittedStudents}/${stats.eligibleStudents} students (${stats.studentCompletionRate}%)`}
                            />
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <ProgressBar
                                size="sm"
                                label="Group Leader Acknowledgments"
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
                  })
                )}
              </section>

              {/* Enrolled Students & Enroll Form */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold text-slate-900">
                    Enrolled Students ({enrolledStudents.length})
                  </h2>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <form onSubmit={handleEnrollStudent} className="mb-4">
                    <label
                      htmlFor="enroll-student-input"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Enroll Student by Email or ID
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="enroll-student-input"
                        type="text"
                        value={enrollIdentifier}
                        onChange={(e) => setEnrollIdentifier(e.target.value)}
                        placeholder="email or STU-2026-005"
                        className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <button
                        type="submit"
                        disabled={enrolling || !enrollIdentifier.trim()}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {enrolling ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        Enroll
                      </button>
                    </div>
                  </form>

                  {enrolledStudents.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500">
                      No students enrolled yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {enrolledStudents.map((student) => (
                        <li key={student.id} className="py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{student.name}</p>
                            {student.studentId && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                {student.studentId}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{student.email}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </main>

      {modalOpen && (
        <AssignmentModal
          assignment={editingAssignment}
          courses={allCourses}
          defaultCourseId={Number(courseId)}
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
              remove all acknowledgment records associated with it.
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
