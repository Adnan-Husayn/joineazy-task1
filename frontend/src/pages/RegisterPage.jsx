import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9\-_]{1,49}$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [role, setRole] = useState('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    studentId: false,
    password: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fieldErrors = useMemo(() => {
    const errs = {};
    if (name.trim().length < 2) {
      errs.name = 'Full name must be at least 2 characters.';
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errs.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errs.email = 'Enter a valid email address (e.g. name@joineazy.edu).';
    }

    if (role === 'student') {
      const trimmedId = studentId.trim();
      if (!trimmedId) {
        errs.studentId = 'Student ID is required.';
      } else if (!STUDENT_ID_REGEX.test(trimmedId)) {
        errs.studentId = 'Use 2-50 alphanumeric characters or hyphens (e.g. STU-2026-005).';
      }
    }

    if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    return errs;
  }, [name, email, studentId, password, role]);

  const showNameError = (touched.name || submitted) && fieldErrors.name;
  const showEmailError = (touched.email || submitted) && fieldErrors.email;
  const showStudentIdError =
    role === 'student' && (touched.studentId || submitted) && fieldErrors.studentId;
  const showPasswordError = (touched.password || submitted) && fieldErrors.password;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setError('');

    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      const user = await register({
        role,
        name: name.trim(),
        email: email.trim(),
        studentId: role === 'student' ? studentId.trim().toUpperCase() : null,
        password,
      });
      showToast(`Account created! Welcome, ${user.name}`, 'success');
      navigate(user.role === 'admin' ? '/admin' : '/student', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please review your details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Create Your Account
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Register as a student or professor to manage courses and assignments
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setRole('student');
                setError('');
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                role === 'student'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('admin');
                setError('');
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                role === 'admin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Professor (Admin)
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="reg-name"
                className="mb-1.5 block text-sm font-medium text-slate-800"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                  placeholder="e.g., Adnan Husain"
                  aria-invalid={Boolean(showNameError)}
                  className={`w-full rounded-xl border py-2 pl-10 pr-9 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                    showNameError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                />
                {!fieldErrors.name && name.trim().length >= 2 && (
                  <CheckCircle2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-emerald-500" />
                )}
              </div>
              {showNameError && (
                <p className="mt-1 animate-fade-in text-xs font-medium text-rose-600">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-email"
                className="mb-1.5 block text-sm font-medium text-slate-800"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  placeholder="name@joineazy.edu"
                  aria-invalid={Boolean(showEmailError)}
                  className={`w-full rounded-xl border py-2 pl-10 pr-9 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                    showEmailError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                />
                {!fieldErrors.email && email.trim().length > 0 && (
                  <CheckCircle2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-emerald-500" />
                )}
              </div>
              {showEmailError && (
                <p className="mt-1 animate-fade-in text-xs font-medium text-rose-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {role === 'student' && (
              <div>
                <label
                  htmlFor="reg-student-id"
                  className="mb-1.5 block text-sm font-medium text-slate-800"
                >
                  Student ID
                </label>
                <div className="relative">
                  <BadgeCheck className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="reg-student-id"
                    type="text"
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      if (error) setError('');
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, studentId: true }))}
                    placeholder="e.g., STU-2026-005"
                    aria-invalid={Boolean(showStudentIdError)}
                    className={`w-full rounded-xl border py-2 pl-10 pr-9 text-sm uppercase text-slate-900 placeholder:normal-case focus:outline-none focus:ring-2 ${
                      showStudentIdError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
                    }`}
                  />
                  {!fieldErrors.studentId && studentId.trim().length > 0 && (
                    <CheckCircle2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-emerald-500" />
                  )}
                </div>
                {showStudentIdError ? (
                  <p className="mt-1 animate-fade-in text-xs font-medium text-rose-600">
                    {fieldErrors.studentId}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">
                    Format: letters, numbers, or hyphens (e.g. STU-2026-005)
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="reg-password"
                className="mb-1.5 block text-sm font-medium text-slate-800"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                  placeholder="Minimum 6 characters"
                  aria-invalid={Boolean(showPasswordError)}
                  className={`w-full rounded-xl border py-2 pl-10 pr-9 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                    showPasswordError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                />
                {!fieldErrors.password && password.length >= 6 && (
                  <CheckCircle2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-emerald-500" />
                )}
              </div>
              {showPasswordError ? (
                <p className="mt-1 animate-fade-in text-xs font-medium text-rose-600">
                  {fieldErrors.password}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  {password.length > 0
                    ? `${password.length}/6 minimum characters`
                    : 'At least 6 characters'}
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="animate-fade-in flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{loading ? 'Creating account...' : 'Create Account'}</span>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
