import { useCallback, useEffect, useState } from 'react';
import { Crown, LogOut, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { groupsApi } from '../api/client';
import CreateGroupModal from '../components/CreateGroupModal';
import Navbar from '../components/Navbar';
import ProgressBar from '../components/ProgressBar';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function StudentGroupsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [memberInputs, setMemberInputs] = useState({});
  const [addingForGroup, setAddingForGroup] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [removing, setRemoving] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      setError('');
      const res = await groupsApi.list();
      setGroups(res.groups || []);
    } catch (err) {
      setError(err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  async function handleAddMember(e, groupId) {
    e.preventDefault();
    const identifier = (memberInputs[groupId] || '').trim();
    if (!identifier) return;

    setAddingForGroup(groupId);
    try {
      const res = await groupsApi.addMember(groupId, identifier);
      showToast(res.message || 'Member added to group', 'success');
      setMemberInputs((prev) => ({ ...prev, [groupId]: '' }));
      await loadGroups();
    } catch (err) {
      showToast(err.message || 'Could not add member', 'error');
    } finally {
      setAddingForGroup(null);
    }
  }

  async function confirmRemoveMember() {
    if (!pendingRemoval) return;
    setRemoving(true);
    try {
      const res = await groupsApi.removeMember(pendingRemoval.groupId, pendingRemoval.memberId);
      showToast(res.message || 'Group membership updated', 'success');
      setPendingRemoval(null);
      await loadGroups();
    } catch (err) {
      showToast(err.message || 'Could not update membership', 'error');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              My Student Groups
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Create study or project teams and invite peers using their email or Student ID.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            <span>Create Group</span>
          </button>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={loadGroups}
              className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">No groups yet</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
              Create your first group to collaborate on assignments, add teammates by email or
              Student ID, and track group submission progress.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create Your First Group
            </button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {groups.map((group) => {
              const isLeader = group.roleInGroup === 'leader';

              return (
                <section
                  key={group.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-slate-900">{group.name}</h2>
                          {isLeader && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                              <Crown className="h-3 w-3" />
                              Leader
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className="mt-1 text-sm text-slate-600">{group.description}</p>
                        )}
                      </div>

                      <StatusBadge
                        status={
                          group.stats.totalAssignments > 0 &&
                          group.stats.completedAssignments === group.stats.totalAssignments
                            ? 'completed_group'
                            : 'partial'
                        }
                        labelOverride={
                          group.stats.totalAssignments === 0
                            ? 'No Tasks'
                            : `${group.stats.completionRate}% Complete`
                        }
                      />
                    </div>

                    <div className="mt-4 rounded-xl bg-slate-50 p-3.5">
                      <ProgressBar
                        size="sm"
                        label="Assignment Progress"
                        value={group.stats.completionRate}
                        sublabel={`${group.stats.completedAssignments} of ${group.stats.totalAssignments} submitted`}
                      />
                    </div>

                    {/* Members list */}
                    <div className="mt-5">
                      <div className="mb-2.5 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Members ({group.memberCount})
                        </h3>
                      </div>

                      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {group.members.map((member) => {
                          const isSelf = member.id === user?.id;
                          const canRemove = isSelf || isLeader;

                          return (
                            <li
                              key={member.id}
                              className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-medium text-slate-900">
                                    {member.name}
                                    {isSelf && (
                                      <span className="ml-1.5 text-xs font-normal text-indigo-600">
                                        (You)
                                      </span>
                                    )}
                                  </p>
                                  {member.studentId && (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                      {member.studentId}
                                    </span>
                                  )}
                                  {member.roleInGroup === 'leader' && (
                                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                                      Leader
                                    </span>
                                  )}
                                </div>
                                <p className="truncate text-xs text-slate-500">{member.email}</p>
                              </div>

                              {canRemove && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPendingRemoval({
                                      groupId: group.id,
                                      groupName: group.name,
                                      memberId: member.id,
                                      memberName: member.name,
                                      isSelf,
                                    })
                                  }
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                  title={isSelf ? 'Leave group' : 'Remove member'}
                                >
                                  {isSelf ? (
                                    <>
                                      <LogOut className="h-3.5 w-3.5" />
                                      <span>Leave</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span>Remove</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  {/* Invite member form */}
                  <form
                    onSubmit={(e) => handleAddMember(e, group.id)}
                    className="mt-5 border-t border-slate-100 pt-4"
                  >
                    <label
                      htmlFor={`add-member-${group.id}`}
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      Add Member by Student Email or Student ID
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`add-member-${group.id}`}
                        type="text"
                        value={memberInputs[group.id] || ''}
                        onChange={(e) =>
                          setMemberInputs((prev) => ({
                            ...prev,
                            [group.id]: e.target.value,
                          }))
                        }
                        placeholder="e.g. priya@joineazy.edu or STU-2026-002"
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <button
                        type="submit"
                        disabled={
                          addingForGroup === group.id ||
                          !(memberInputs[group.id] || '').trim()
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>{addingForGroup === group.id ? 'Adding...' : 'Add'}</span>
                      </button>
                    </div>
                  </form>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadGroups();
          }}
        />
      )}

      {pendingRemoval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="animate-modal-in w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {pendingRemoval.isSelf ? 'Leave Group?' : 'Remove Group Member?'}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {pendingRemoval.isSelf
                ? `Are you sure you want to leave "${pendingRemoval.groupName}"?`
                : `Remove ${pendingRemoval.memberName} from "${pendingRemoval.groupName}"?`}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                disabled={removing}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveMember}
                disabled={removing}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {removing ? 'Updating...' : pendingRemoval.isSelf ? 'Leave Group' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
