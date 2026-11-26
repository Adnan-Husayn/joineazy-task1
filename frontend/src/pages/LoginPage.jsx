import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fieldErrors = useMemo(() => {
    const errs = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errs.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errs.email = 'Enter a valid email address (e.g. name@joineazy.edu).';
    }

    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    return errs;
  }, [email, password]);

  const showEmailError = (touched.email || submitted) && fieldErrors.email;
  const showPasswordError = (touched.password || submitted) && fieldErrors.password;

  function fillDemoStudent() {
    setEmail('adnan@joineazy.edu');
    setPassword('Student@123');
    setTouched({ email: false, password: false });
    setSubmitted(false);
    setError('');
    showToast('Filled demo student credentials (STU-2026-001)', 'info');
  }

  function fillDemoProfessor() {
    setEmail('prof.sharma@joineazy.edu');
    setPassword('Admin@123');
    setTouched({ email: false, password: false });
    setSubmitted(false);
    setError('');
    showToast('Filled demo professor credentials', 'info');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setError('');

    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      const user = await login({ email: email.trim(), password });
      showToast(`Welcome back, ${user.name}`, 'success');
      navigate(user.role === 'admin' ? '/admin' : '/student', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed. Please check your credentials.');
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
            Joineazy Assignment Portal
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Course-first group collaboration and assignment verification
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3.5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-800">
              <Sparkles className="h-3.5 w-3.5" />
              Quick Demo Access
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={fillDemoStudent}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Fill Demo Student
              </button>
              <button
                type="button"
                onClick={fillDemoProfessor}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Fill Demo Professor
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-medium text-slate-800"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  placeholder="you@joineazy.edu"
                  aria-invalid={Boolean(showEmailError)}
                  className={`w-full rounded-xl border py-2 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
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

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-medium text-slate-800"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                  placeholder="Enter your password"
                  aria-invalid={Boolean(showPasswordError)}
                  className={`w-full rounded-xl border py-2 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                    showPasswordError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                />
              </div>
              {showPasswordError && (
                <p className="mt-1 animate-fade-in text-xs font-medium text-rose-600">
                  {fieldErrors.password}
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
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Need a new account?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
