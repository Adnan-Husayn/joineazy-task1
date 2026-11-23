import { useState } from 'react';
import { Users, X } from 'lucide-react';
import { groupsApi } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function CreateGroupModal({ onClose, onCreated }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [membersInput, setMembersInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const memberIdentifiers = membersInput
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const res = await groupsApi.create({
        name: name.trim(),
        description: description.trim(),
        memberIdentifiers,
      });
      showToast(`Created group "${res.group.name}"`, 'success');
      onCreated();
    } catch (err) {
      setError(err.message || 'Could not create group');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 id="create-group-title" className="text-base font-semibold text-slate-900">
                Create Student Group
              </h2>
              <p className="text-xs text-slate-500">
                You will be added automatically as group leader
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

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label
              htmlFor="group-name"
              className="mb-1.5 block text-sm font-medium text-slate-800"
            >
              Group Name
            </label>
            <input
              id="group-name"
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Team Gamma - Cloud Systems"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="group-desc"
              className="mb-1.5 block text-sm font-medium text-slate-800"
            >
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="group-desc"
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Course project focus or lab section..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="group-members"
              className="mb-1.5 block text-sm font-medium text-slate-800"
            >
              Invite Members Now <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="group-members"
              rows={2}
              value={membersInput}
              onChange={(e) => setMembersInput(e.target.value)}
              placeholder="Comma-separated student emails or IDs (e.g. priya@joineazy.edu, STU-2026-003)"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              You can also add or remove members anytime after creating the group.
            </p>
          </div>

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
              disabled={submitting}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
