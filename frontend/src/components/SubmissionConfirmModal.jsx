import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, ShieldCheck, Users, X } from 'lucide-react';
import { submissionsApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/formatters';

export default function SubmissionConfirmModal({ assignment, onClose, onConfirmed }) {
  const { showToast } = useToast();

  const groupStatuses = assignment?.groupStatuses || [];
  const pendingGroups = groupStatuses.filter((g) => !g.submitted);

  const [selectedGroupId, setSelectedGroupId] = useState(
    pendingGroups.length > 0 ? pendingGroups[0].groupId : null
  );
  const [note, setNote] = useState('');
  const [confirmedUpload, setConfirmedUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const firstPending = (assignment?.groupStatuses || []).find((g) => !g.submitted);
    setSelectedGroupId(firstPending ? firstPending.groupId : null);
    setNote('');
    setConfirmedUpload(false);
    setError('');
  }, [assignment]);

  if (!assignment) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!confirmedUpload) {
      setError('Please check the box verifying that your files are uploaded to OneDrive.');
      return;
    }

    if (groupStatuses.length > 0 && !selectedGroupId) {
      setError('Please select which group you are confirming submission for.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submissionsApi.confirm({
        assignmentId: assignment.id,
        groupId: groupStatuses.length > 0 ? selectedGroupId : null,
        note: note.trim(),
        confirmedUpload: true,
      });
      showToast(res.message || 'Submission confirmed', 'success');
      onConfirmed();
    } catch (err) {
      setError(err.message || 'Could not confirm submission');
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
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
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
                Verify OneDrive Submission
              </h2>
              <p className="text-xs text-slate-500">Step 2 of 2: Final confirmation</p>
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
            <p className="text-sm font-semibold text-slate-900">{assignment.title}</p>
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

          {groupStatuses.length > 0 ? (
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                <Users className="h-4 w-4 text-slate-500" />
                <span>
                  {groupStatuses.length > 1
                    ? 'Select Group to Confirm For'
                    : 'Submitting for Group'}
                </span>
              </label>
              <div className="space-y-2">
                {groupStatuses.map((gs) => {
                  const isDisabled = gs.submitted;
                  const isSelected = selectedGroupId === gs.groupId;

                  return (
                    <label
                      key={gs.groupId}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                        isDisabled
                          ? 'cursor-not-allowed border-emerald-200 bg-emerald-50/60 text-slate-500'
                          : isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 text-slate-900 ring-1 ring-indigo-600'
                            : 'border-slate-200 bg-white hover:border-slate-300'
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
                        <span className="font-medium">{gs.groupName}</span>
                      </div>
                      {gs.submitted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Already submitted
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Pending</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              You are not currently in a group. This confirmation will be recorded as an individual
              submission under your Student ID.
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
              placeholder="e.g., Uploaded final report PDF and code zip to Group Alpha folder"
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
              I verify that our files have been uploaded to the OneDrive link above and are ready
              for professor review.
            </span>
          </label>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
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
              disabled={submitting || !confirmedUpload}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Confirming...' : 'Confirm Submission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
