import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  ExternalLink,
  Loader2,
  Lock,
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react';
import { submissionsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/formatters';

export default function SubmissionConfirmModal({
  assignment,
  initialGroupId = null,
  onClose,
  onConfirmed,
}) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isGroupAssignment = assignment?.submissionType !== 'individual';
  const groupStatuses = isGroupAssignment ? assignment?.groupStatuses || [] : [];
  const submittableGroups = groupStatuses.filter((g) => !g.submitted && g.isLeader);

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [note, setNote] = useState('');
  const [confirmedUpload, setConfirmedUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!assignment) return;
    const isGroup = assignment.submissionType !== 'individual';
    const statuses = isGroup ? assignment.groupStatuses || [] : [];
    const matchingInitial =
      initialGroupId &&
      statuses.find((g) => g.groupId === initialGroupId && !g.submitted && g.isLeader);
    const firstLeaderPending = statuses.find((g) => !g.submitted && g.isLeader);

    setSelectedGroupId(
      matchingInitial ? matchingInitial.groupId : firstLeaderPending ? firstLeaderPending.groupId : null
    );
    setNote('');
    setConfirmedUpload(false);
    setError('');
  }, [assignment, initialGroupId]);

  if (!assignment) return null;

  const selectedGroup = groupStatuses.find((g) => g.groupId === selectedGroupId) || null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!confirmedUpload) {
      setError('Please check the box verifying that your files are uploaded to OneDrive.');
      return;
    }

    if (isGroupAssignment && !selectedGroupId) {
      setError('Please select a group where you are the leader.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submissionsApi.confirm({
        assignmentId: assignment.id,
        groupId: isGroupAssignment ? selectedGroupId : null,
        note: note.trim(),
        confirmedUpload: true,
      });
      showToast(res.message || 'Submission acknowledged', 'success');
      onConfirmed(assignment.id);
    } catch (err) {
      setError(err.message || 'Could not acknowledge submission');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-submission-title"
    >
      <div className="animate-modal-in w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="confirm-submission-title"
                className="text-base font-semibold text-slate-900"
              >
                {isGroupAssignment
                  ? 'Acknowledge Group Submission'
                  : 'Verify OneDrive Submission'}
              </h2>
              <p className="text-xs text-slate-500">
                Step 2 of 2: Final confirmation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {assignment.courseCode && (
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                  {assignment.courseCode}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  isGroupAssignment
                    ? 'bg-violet-50 text-violet-700'
                    : 'bg-sky-50 text-sky-700'
                }`}
              >
                {isGroupAssignment ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {isGroupAssignment ? 'Group Assignment' : 'Individual Assignment'}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{assignment.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              Due {formatDateTime(assignment.dueDate)}
            </p>
            <a
              href={assignment.onedriveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Need to double-check? Open OneDrive submission folder</span>
            </a>
          </div>

          {isGroupAssignment ? (
            <div className="space-y-3">
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                <Users className="h-4 w-4 text-slate-500" />
                <span>
                  {groupStatuses.length > 1
                    ? 'Select Group (Leader Access)'
                    : 'Acknowledging for Group'}
                </span>
              </label>
              <div className="space-y-2">
                {groupStatuses.map((gs) => {
                  const isDisabled = gs.submitted || !gs.isLeader;
                  const isSelected = selectedGroupId === gs.groupId;

                  return (
                    <label
                      key={gs.groupId}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                        gs.submitted
                          ? 'cursor-not-allowed border-emerald-200 bg-emerald-50/60 text-slate-500'
                          : !gs.isLeader
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                            : isSelected
                              ? 'cursor-pointer border-indigo-600 bg-indigo-50/50 text-slate-900 ring-1 ring-indigo-600'
                              : 'cursor-pointer border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="groupSelection"
                          value={gs.groupId}
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => setSelectedGroupId(gs.groupId)}
                          className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-600"
                        />
                        <div>
                          <span className="font-medium">{gs.groupName}</span>
                          {gs.isLeader && !gs.submitted && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                              <Crown className="h-3 w-3" />
                              You are Leader
                            </span>
                          )}
                        </div>
                      </div>
                      {gs.submitted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Acknowledged
                        </span>
                      ) : !gs.isLeader ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Lock className="h-3 w-3" />
                          Leader: {gs.leaderName || 'Assigned'}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-indigo-700">Ready</span>
                      )}
                    </label>
                  );
                })}
              </div>

              {selectedGroup && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2.5 text-xs text-indigo-900">
                  As group leader, acknowledging submission will immediately mark this assignment as
                  submitted for <strong>all members</strong> of{' '}
                  <strong>{selectedGroup.groupName}</strong>.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-3.5 py-2.5 text-xs text-sky-900">
              Individual acknowledgment recorded under your Student ID (
              <strong>{user?.studentId || user?.email}</strong>).
            </div>
          )}

          <div>
            <label
              htmlFor="submission-note"
              className="mb-1.5 block text-sm font-medium text-slate-800"
            >
              Optional Note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="submission-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Uploaded final report PDF and benchmark archive to OneDrive"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <input
              type="checkbox"
              checked={confirmedUpload}
              onChange={(e) => setConfirmedUpload(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <span className="text-sm text-slate-700">
              {isGroupAssignment
                ? 'I verify that our group files are uploaded to the OneDrive link above and ready for professor review.'
                : 'I verify that my files have been uploaded to the OneDrive link above and are ready for professor review.'}
            </span>
          </label>

          {error && (
            <p className="animate-fade-in rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                !confirmedUpload ||
                (isGroupAssignment && submittableGroups.length === 0)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {submitting
                  ? 'Confirming...'
                  : isGroupAssignment
                    ? 'Acknowledge for Group'
                    : 'Confirm Submission'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
