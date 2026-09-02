'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
const ReportsPageComponent = dynamic(() => import('./reports/page'), { ssr: false });

import {
  Plus, Check, X, Search, Users, Star, FileText, Package, BarChart2,
  ChevronDown, ChevronRight, Building2, Shield, Briefcase, Trash2, Pencil,
  CalendarDays, AlertCircle, Filter, TrendingUp, Award, MessageSquare,
  Phone, Mail, MapPin, CreditCard, AlertTriangle, ExternalLink, User, Camera,
  Lock, Save,
} from 'lucide-react';
import {
  hrApi,
  usersApi,
  departmentsApi,
  performanceApi,
  leavePackagesApi,
  chatApi,
  projectsApi,
} from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, cn, getInitials } from '@/lib/utils';
import { pickManagementDepartment } from '@/lib/access';
import { desktopNotify } from '@/lib/desktop-notify';
import toast from 'react-hot-toast';
import type {
  LeaveRequest,
  PerformanceReview,
  LeavePackage,
  LeaveBalance,
  StandupNote,
  User as AppUser,
  Project,
} from '@/types';

type Tab = 'overview' | 'employees' | 'standup-notes' | 'leave-packages' | 'performance' | 'reports';

const LEAVE_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const LEAVE_TYPES = ['annual', 'sick', 'emergency', 'unpaid', 'maternity', 'paternity'];

export default function HrPage() {
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const isManager = user?.role !== 'employee';
  const isCeo = user?.role === 'admin';
  const canUseStandupNotes = user?.role === 'manager';
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(() => {
    if (initialTab === 'standup-notes' && canUseStandupNotes) {
      return 'standup-notes';
    }
    if (initialTab === 'employees' || initialTab === 'leave-packages' || initialTab === 'performance' || initialTab === 'reports' || initialTab === 'overview') {
      return initialTab;
    }
    return 'overview';
  });

  const allTabs: {
    key: Tab;
    label: string;
    icon: React.ReactNode;
    managerOnly?: boolean;
    standupNotesOnly?: boolean;
  }[] = [
    { key: 'overview', label: isManager ? 'Overview' : 'My Leave', icon: <FileText size={14} /> },
    { key: 'employees', label: 'Employees', icon: <Users size={14} /> },
    { key: 'standup-notes', label: 'Standup Notes', icon: <Lock size={14} />, standupNotesOnly: true },
    { key: 'leave-packages', label: 'Leave Packages', icon: <Package size={14} />, managerOnly: true },
    { key: 'performance', label: 'Performance', icon: <Star size={14} /> },
    { key: 'reports', label: 'Reports', icon: <BarChart2 size={14} />, managerOnly: true },
  ];
  const tabs = allTabs.filter(
    (t) => (!t.managerOnly || isManager) && (!t.standupNotesOnly || canUseStandupNotes),
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">{isCeo ? 'People' : isManager ? 'HR Management' : 'My Workspace'}</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab isManager={isManager} user={user} />}
      {tab === 'employees' && <EmployeesTab isManager={isManager} currentUser={user} />}
      {tab === 'standup-notes' && canUseStandupNotes && <StandupNotesTab />}
      {tab === 'leave-packages' && <LeavePackagesTab isManager={isManager} />}
      {tab === 'performance' && <PerformanceTab user={user} />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  );
}

/* ─── OVERVIEW TAB ─────────────────────────────────────────────────────── */
function OverviewTab({ isManager, user }: { isManager: boolean; user: any }) {
  const qc = useQueryClient();
  const [showLeave, setShowLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'annual', start_date: '', end_date: '', reason: '' });

  const { data: leaves = [] } = useQuery({
    queryKey: ['leaves', isManager ? 'all' : 'mine'],
    queryFn: isManager ? hrApi.leave.list : hrApi.leave.mine,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });

  // Detect status changes from polling and fire desktop notifications
  const prevLeavesRef = useRef<LeaveRequest[]>([]);
  useEffect(() => {
    const prev = prevLeavesRef.current;
    if (prev.length > 0) {
      (leaves as LeaveRequest[]).forEach((leave) => {
        const old = prev.find((p) => p.id === leave.id);
        if (old && old.status === 'pending' && leave.status !== 'pending') {
          desktopNotify(
            leave.status === 'approved' ? 'Leave Approved ✅' : 'Leave Rejected ❌',
            `Your ${leave.type} leave request has been ${leave.status}`,
            `leave_${leave.status}`,
          );
        }
      });
    }
    prevLeavesRef.current = leaves as LeaveRequest[];
  }, [leaves]);

  const { data: announcements = [] } = useQuery({ queryKey: ['announcements'], queryFn: hrApi.announcements.list });
  const { data: balance = [] } = useQuery<LeaveBalance[]>({
    queryKey: ['leave-balance', 'mine'],
    queryFn: leavePackagesApi.myBalance,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });

  const createLeave = useMutation({
    mutationFn: hrApi.leave.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); setShowLeave(false); toast.success('Leave request submitted'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to submit'),
  });
  const approve = useMutation({
    mutationFn: (id: string) => hrApi.leave.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); toast.success('Leave approved'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'You cannot approve this leave request'),
  });
  const reject = useMutation({
    mutationFn: (id: string) => hrApi.leave.reject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); toast.success('Leave rejected'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'You cannot reject this leave request'),
  });

  // Group balance by leave_type (pick the first active package per type)
  const balanceMap = (balance as LeaveBalance[]).reduce<Record<string, LeaveBalance>>((acc, b) => {
    if (!acc[b.leave_type]) acc[b.leave_type] = b;
    return acc;
  }, {});

  // Use enrolled types for the dropdown; fall back to LEAVE_TYPES if no balance loaded yet
  const enrolledTypes = Object.keys(balanceMap);
  const leaveTypeOptions = enrolledTypes.length > 0 ? enrolledTypes : LEAVE_TYPES;

  const requestedDays = leaveForm.start_date && leaveForm.end_date
    ? Math.max(1, Math.round((new Date(leaveForm.end_date).getTime() - new Date(leaveForm.start_date).getTime()) / 86400000) + 1)
    : 0;
  const selectedBalance = balanceMap[leaveForm.type];
  const overLimit = selectedBalance && requestedDays > selectedBalance.days_remaining;

  // When modal opens, default to the employee's first enrolled leave type
  const openLeaveModal = () => {
    const firstType = leaveTypeOptions[0] ?? 'annual';
    setLeaveForm({ type: firstType, start_date: '', end_date: '', reason: '' });
    setShowLeave(true);
  };

  const isCeo = user?.role === 'admin';
  const leaveRows = [...(leaves as LeaveRequest[])].sort((a, b) => {
    if (!isCeo) return 0;
    const rank = (req: LeaveRequest) => {
      if (req.status === 'pending' && req.employee_reports_to === user?.id) return 0;
      if (req.status === 'pending') return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });

  return (
    <div className="space-y-5">
      {/* Announcements */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Announcements</h2>
        {(announcements as any[]).length === 0 ? (
          <p className="text-gray-400 text-sm">No announcements</p>
        ) : (
          <div className="space-y-3">
            {(announcements as any[]).map((a) => (
              <div key={a.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                  {a.is_pinned && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Pinned</span>}
                </div>
                <p className="text-sm text-gray-600 mt-1">{a.body}</p>
                <p className="text-xs text-gray-400 mt-2">{a.author_name} · {formatDate(a.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leave balance summary — visible to every employee */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">My Leave Balance</h2>
        {Object.keys(balanceMap).length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Package size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No leave package assigned yet</p>
            <p className="text-xs mt-1">Contact HR to get enrolled in a leave package</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.values(balanceMap).map((b) => {
              const exhausted = b.days_remaining === 0;
              const pct = Math.min(100, b.days_allowed > 0 ? (b.days_remaining / b.days_allowed) * 100 : 0);
              return (
                <div key={b.leave_type} className={cn('p-3 rounded-lg border', exhausted ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100')}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={cn('text-xs font-medium capitalize', exhausted ? 'text-red-500' : 'text-gray-500')}>{b.leave_type}</p>
                    {exhausted && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Exhausted</span>}
                  </div>
                  <div className="flex items-end justify-between mb-1.5">
                    <span className={cn('text-xl font-bold', exhausted ? 'text-red-600' : 'text-gray-900')}>{b.days_remaining}</span>
                    <span className="text-xs text-gray-400">/ {b.days_allowed} days</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', exhausted ? 'bg-red-400' : pct > 30 ? 'bg-green-500' : 'bg-amber-500')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{b.days_used} used · {b.package_name}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leave Requests */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">
              {user?.role === 'employee'
                ? 'My Leave Requests'
                : user?.role === 'manager'
                  ? 'Department Leave Requests'
                  : user?.role === 'admin'
                    ? 'Company leave'
                    : 'All Leave Requests'}
            </h2>
            {isCeo && (
              <p className="text-xs text-gray-400 mt-1">
                Heads and HR handle day-to-day. You can override any request.
              </p>
            )}
          </div>
          <button
            onClick={openLeaveModal}
            className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-700 shrink-0"
          >
            <Plus size={14} /> Request Leave
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                {isManager && <th className="pb-2 font-medium">Employee</th>}
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Period</th>
                <th className="pb-2 font-medium">Days</th>
                <th className="pb-2 font-medium">Status</th>
                {isManager && <th className="pb-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leaveRows.map((l) => {
                const days = Math.round((new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / 86400000) + 1;
                const reportsToYou = isCeo && l.employee_reports_to === user?.id;
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    {isManager && (
                      <td className="py-3 font-medium text-gray-900">
                        {l.employee_name}
                        {reportsToYou && (
                          <span className="ml-2 text-[10px] font-medium bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">
                            Reports to you
                          </span>
                        )}
                      </td>
                    )}
                    <td className="py-3 capitalize text-gray-700">{l.type}</td>
                    <td className="py-3 text-gray-600">{formatDate(l.start_date)} → {formatDate(l.end_date)}</td>
                    <td className="py-3 text-gray-600">{days}d</td>
                    <td className="py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', LEAVE_STATUS_STYLE[l.status])}>
                        {l.status}
                      </span>
                    </td>
                    {isManager && l.status === 'pending' && (
                      <td className="py-3">
                        <div className="flex gap-1">
                          <button onClick={() => approve.mutate(l.id)} className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"><Check size={13} /></button>
                          <button onClick={() => reject.mutate(l.id)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><X size={13} /></button>
                        </div>
                      </td>
                    )}
                    {isManager && l.status !== 'pending' && <td />}
                  </tr>
                );
              })}
              {(leaves as LeaveRequest[]).length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No leave requests</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave request modal */}
      {showLeave && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Request Leave</h2>

            {/* Balance summary in modal */}
            {Object.keys(balanceMap).length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Your Balance</p>
                {Object.values(balanceMap).map((b) => (
                  <div key={b.leave_type} className="flex items-center gap-2">
                    <span className="text-xs capitalize text-gray-600 w-20">{b.leave_type}</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', b.days_remaining > 0 ? 'bg-green-500' : 'bg-gray-300')}
                        style={{ width: `${Math.min(100, (b.days_remaining / b.days_allowed) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-16 text-right">{b.days_remaining}/{b.days_allowed}d</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <select
                value={leaveForm.type}
                onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {leaveTypeOptions.map((t) => {
                  const bal = balanceMap[t];
                  const exhausted = bal && bal.days_remaining === 0;
                  return (
                    <option key={t} value={t} disabled={!!exhausted}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}{exhausted ? ' (exhausted)' : bal ? ` — ${bal.days_remaining}d left` : ''}
                    </option>
                  );
                })}
              </select>

              {/* Balance info for selected type */}
              {selectedBalance && (
                <div className={cn('rounded-lg px-3 py-2 text-xs flex items-center justify-between', overLimit ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200')}>
                  <span className={cn('font-medium', overLimit ? 'text-red-700' : 'text-green-700')}>
                    {selectedBalance.days_remaining} of {selectedBalance.days_allowed} days remaining
                  </span>
                  {requestedDays > 0 && (
                    <span className={cn('font-semibold', overLimit ? 'text-red-600' : 'text-green-600')}>
                      {overLimit ? `⚠ ${requestedDays}d requested — exceeds balance` : `${requestedDays} day${requestedDays !== 1 ? 's' : ''} requested`}
                    </span>
                  )}
                </div>
              )}
              {!selectedBalance && leaveForm.type && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No balance found for this leave type — you may not be enrolled in this package.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <textarea
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                placeholder="Reason (optional)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowLeave(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => createLeave.mutate(leaveForm)}
                disabled={!leaveForm.start_date || !leaveForm.end_date || createLeave.isPending || !!overLimit || selectedBalance?.days_remaining === 0}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {createLeave.isPending ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PRIVATE STANDUP NOTES TAB ─────────────────────────────────────────── */
function StandupNotesTab() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [date, setDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  });
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: employees = [], isLoading: employeesLoading } = useQuery<AppUser[]>({
    queryKey: ['employees'],
    queryFn: usersApi.list,
  });
  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
  } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });
  const {
    data: notes = [],
    isLoading: notesLoading,
    isError: notesError,
  } = useQuery<StandupNote[]>({
    queryKey: ['standup-notes', date],
    queryFn: () => hrApi.standupNotes.list(date),
    enabled: Boolean(date),
    retry: (failureCount, error: any) => error?.response?.status !== 404 && failureCount < 2,
  });

  const developers = employees.filter(
    (employee) => employee.is_active && employee.role === 'employee' && employee.id !== currentUser?.id,
  );
  const visibleDevelopers = developers.filter((employee) => {
    const value = `${employee.first_name} ${employee.last_name} ${employee.job_title ?? ''}`.toLowerCase();
    return value.includes(search.trim().toLowerCase());
  });
  const selectedUser = developers.find((employee) => employee.id === selectedUserId);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedNote = notes.find(
    (note) => note.subject_user_id === selectedUserId && note.project?.id === selectedProjectId,
  );
  const selectedDraftKey = `${date}:${selectedProjectId}:${selectedUserId}`;
  const hasDraft = Object.prototype.hasOwnProperty.call(drafts, selectedDraftKey);
  const content = hasDraft ? drafts[selectedDraftKey] : selectedNote?.content ?? '';
  const isDirty = hasDraft && content !== (selectedNote?.content ?? '');

  useEffect(() => {
    if (!selectedUserId || !developers.some((employee) => employee.id === selectedUserId)) {
      setSelectedUserId(developers[0]?.id ?? '');
    }
  }, [developers, selectedUserId]);

  useEffect(() => {
    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0]?.id ?? '');
    }
  }, [projects, selectedProjectId]);

  const saveMutation = useMutation({
    mutationFn: (input: {
      subjectUserId: string;
      standupDate: string;
      content: string;
      projectId: string;
    }) =>
      hrApi.standupNotes.save(input.subjectUserId, {
        standup_date: input.standupDate,
        content: input.content,
        project_id: input.projectId,
      }),
    onSuccess: (saved: StandupNote, input) => {
      qc.setQueryData<StandupNote[]>(['standup-notes', input.standupDate], (current = []) => {
        const existing = current.some((note) => note.id === saved.id);
        return existing
          ? current.map((note) => (note.id === saved.id ? saved : note))
          : [...current, saved];
      });
      setDrafts((current) => ({
        ...current,
        [`${input.standupDate}:${input.projectId}:${input.subjectUserId}`]: saved.content,
      }));
      toast.success('Private standup note saved');
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? 'Failed to save standup note'),
  });

  const deleteMutation = useMutation({
    mutationFn: (input: { id: string; subjectUserId: string; projectId: string; standupDate: string }) =>
      hrApi.standupNotes.remove(input.id),
    onSuccess: (_result, input) => {
      qc.setQueryData<StandupNote[]>(['standup-notes', input.standupDate], (current = []) =>
        current.filter((note) => note.id !== input.id),
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[`${input.standupDate}:${input.projectId}:${input.subjectUserId}`];
        return next;
      });
      toast.success('Standup note deleted');
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? 'Failed to delete standup note'),
  });

  if (employeesLoading || projectsLoading || notesLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      {(notesError || projectsError) && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {projectsError
            ? 'Projects could not be loaded for standup notes.'
            : 'Standup notes could not be loaded. You can still select a project, but saving may fail until the API is updated.'}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Private standup notes</h2>
          <p className="text-sm text-gray-500">Capture observations and follow-ups for each developer.</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-gray-400" />
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
        <Lock size={15} className="shrink-0" />
        Only you can access these notes. Other managers, admins, and the developer cannot view them.
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Select project
        </p>
        <div className="flex flex-wrap gap-2">
          {projects.map((project) => {
            const selected = selectedProjectId === project.id;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  selected
                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                )}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: project.color ?? '#9ca3af' }}
                />
                {project.icon && <span>{project.icon}</span>}
                {project.name}
                {selected && <Check size={12} />}
              </button>
            );
          })}
          {projects.length === 0 && (
            <span className="text-sm text-gray-400">No accessible projects.</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search developers…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
            {visibleDevelopers.map((developer) => {
              const note = notes.find(
                (item) => item.subject_user_id === developer.id && item.project?.id === selectedProjectId,
              );
              return (
                <button
                  key={developer.id}
                  type="button"
                  onClick={() => setSelectedUserId(developer.id)}
                  className={cn(
                    'w-full p-3 flex items-center gap-3 text-left transition-colors',
                    selectedUserId === developer.id ? 'bg-primary-50' : 'hover:bg-gray-50',
                  )}
                >
                  {developer.avatar_url ? (
                    <img src={developer.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
                      {getInitials(`${developer.first_name} ${developer.last_name}`)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {developer.first_name} {developer.last_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{developer.job_title ?? 'Developer'}</p>
                  </div>
                  {note && (
                    <Check size={14} className="text-green-500 shrink-0" />
                  )}
                </button>
              );
            })}

            {visibleDevelopers.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-400">
                {developers.length === 0 ? 'No developers are available.' : 'No developers match your search.'}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {selectedUser && selectedProject ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {selectedUser.job_title ?? 'Developer'} · {selectedProject.name} · {date}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {saveMutation.isPending ? (
                    <span className="text-gray-400">Saving…</span>
                  ) : isDirty ? (
                    <span className="text-amber-600">Unsaved changes</span>
                  ) : selectedNote ? (
                    <span className="flex items-center gap-1 text-green-600"><Check size={12} /> Saved</span>
                  ) : null}
                </div>
              </div>

              <textarea
                value={content}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [selectedDraftKey]: event.target.value }))
                }
                maxLength={20_000}
                rows={16}
                placeholder="Add private observations, blockers, commitments, coaching points, or follow-ups from this standup…"
                className="w-full resize-y px-4 py-3 text-sm leading-6 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400">{content.length.toLocaleString()} / 20,000</span>
                <div className="flex items-center gap-2">
                  {selectedNote && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this private standup note?')) {
                          deleteMutation.mutate({
                            id: selectedNote.id,
                            subjectUserId: selectedUser.id,
                            projectId: selectedProject.id,
                            standupDate: date,
                          });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      saveMutation.mutate({
                        subjectUserId: selectedUser.id,
                        standupDate: date,
                        content,
                        projectId: selectedProject.id,
                      })
                    }
                    disabled={!date || !selectedProjectId || !isDirty || saveMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    <Save size={14} />
                    Save note
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-[360px] flex items-center justify-center text-sm text-gray-400">
              Select a project and developer to write a private note.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── EMPLOYEES TAB ─────────────────────────────────────────────────────── */
function EmployeesTab({ isManager, currentUser }: { isManager: boolean; currentUser: any }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [viewingEmp, setViewingEmp] = useState<any>(null);
  const [addForm, setAddForm] = useState({ first_name: '', last_name: '', email: '', role: 'employee', job_title: '', department_id: '' });

  const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: usersApi.list });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });
  const managementDept = pickManagementDepartment(departments as { id: string; name: string }[]);

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(addForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Invite sent! Employee will receive an email to complete onboarding.');
      setShowAdd(false);
      setAddForm({ first_name: '', last_name: '', email: '', role: 'employee', job_title: '', department_id: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create employee'),
  });

  // Determine view mode from what the backend returned
  const isSelfOnly = !isManager && (employees as any[]).length === 1 && (employees as any[])[0]?.id === currentUser?.id;
  const isDeptHead = !isManager && (employees as any[]).length > 0 && !isSelfOnly;

  const filtered = (employees as any[]).filter((e) => {
    const name = `${e.first_name} ${e.last_name} ${e.email} ${e.job_title ?? ''}`.toLowerCase();
    return (!search || name.includes(search.toLowerCase()))
      && (deptFilter === 'all' || e.department_id === deptFilter)
      && (roleFilter === 'all' || e.role === roleFilter);
  });

  const byDept = filtered.reduce<Record<string, any[]>>((acc, emp) => {
    const key = emp.department_name ?? 'No Department';
    if (!acc[key]) acc[key] = [];
    acc[key].push(emp);
    return acc;
  }, {});

  if (isLoading) return <Spinner />;

  // Regular employee: show only their own profile card
  if (isSelfOnly) {
    const me = (employees as any[])[0];
    return (
      <div className="max-w-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">My Profile</p>
        <EmployeeCard emp={me} isManager={false} isDeptHead={false} onView={setViewingEmp} />
        {viewingEmp && (
          <EmployeeProfileDrawer emp={viewingEmp} isManager={isManager} currentUser={currentUser} onClose={() => setViewingEmp(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {isDeptHead ? `Your department · ${(employees as any[]).length} member${(employees as any[]).length !== 1 ? 's' : ''}` : `${filtered.length} employee${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        {isManager && <>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
          <option value="all">All Departments</option>
          {(departments as any[]).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="hr">HR</option>
          <option value="employee">Employee</option>
        </select>
        </>}
        {isManager && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors ml-auto">
            <Plus size={14} /> Add Employee
          </button>
        )}
      </div>

      {Object.entries(byDept).map(([deptName, emps]) => {
        // Find the dept head name for this department group
        const deptRecord = (departments as any[]).find((d) => d.name === deptName);
        const headId = deptRecord?.manager_id;
        const headName = deptRecord?.manager_name;
        return (
          <div key={deptName} className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide flex-wrap">
              <Building2 size={12} />{deptName}
              <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full normal-case font-normal">{emps.length}</span>
              {headName && (
                <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full normal-case font-normal flex items-center gap-1">
                  <Shield size={10} /> Head: {headName}
                </span>
              )}
              {!headName && (
                <span className="bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full normal-case font-normal text-[10px]">
                  No head assigned
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {emps.map((emp) => <EmployeeCard key={emp.id} emp={emp} isManager={isManager} isDeptHead={emp.id === headId} onView={setViewingEmp} />)}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-14 text-center">
          <Users size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No employees match your filters.</p>
        </div>
      )}

      {/* Profile drawer */}
      {viewingEmp && (
        <EmployeeProfileDrawer emp={viewingEmp} isManager={isManager} currentUser={currentUser} onClose={() => setViewingEmp(null)} />
      )}

      {/* Add Employee Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-5">Add Employee</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First name *</label>
                  <input value={addForm.first_name} onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last name *</label>
                  <input value={addForm.last_name} onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
                An invitation email will be sent to the employee to complete their onboarding and set their password.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Job title</label>
                <input value={addForm.job_title} onChange={(e) => setAddForm({ ...addForm, job_title: e.target.value })}
                  placeholder="e.g. Software Engineer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                  <select value={addForm.role} onChange={(e) => {
                    const role = e.target.value;
                    setAddForm({
                      ...addForm,
                      role,
                      department_id: role === 'manager' ? (managementDept?.id ?? '') : addForm.department_id,
                    });
                  }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                  <select
                    value={addForm.role === 'manager' ? (managementDept?.id ?? addForm.department_id) : addForm.department_id}
                    onChange={(e) => setAddForm({ ...addForm, department_id: e.target.value })}
                    disabled={addForm.role === 'manager'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="">No department</option>
                    {(departments as any[]).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              {addForm.role === 'manager' && (
                <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
                  Managers belong to {managementDept?.name ?? 'Administration/Management'}. They can still head another department from Settings.
                </p>
              )}
              {addForm.department_id && addForm.role !== 'manager' && (() => {
                const dept = (departments as any[]).find((d) => d.id === addForm.department_id);
                const head = dept?.manager_name ?? dept?.manager_id;
                return head ? (
                  <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
                    This employee will report to <strong>{head}</strong> (head of {dept.name}).
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                    No head assigned to this department — reporting line will be unset.
                  </p>
                );
              })()}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!addForm.first_name || !addForm.last_name || !addForm.email || createMutation.isPending}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700"
              >
                {createMutation.isPending ? 'Sending invite…' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  hr: 'bg-teal-100 text-teal-700',
  employee: 'bg-gray-100 text-gray-600',
};

function EmployeeCard({ emp, isManager, isDeptHead, onView }: { emp: any; isManager: boolean; isDeptHead?: boolean; onView: (emp: any) => void }) {
  return (
    <div
      onClick={() => onView(emp)}
      className={cn(
        'bg-white rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md hover:border-indigo-200',
        isDeptHead ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200',
        !emp.is_active && 'opacity-50',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {emp.avatar_url
            ? <img src={emp.avatar_url} className="w-10 h-10 rounded-full object-cover" />
            : <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">{getInitials(`${emp.first_name} ${emp.last_name}`)}</div>}
          {isDeptHead && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center" title="Department Head">
              <Shield size={9} className="text-white" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm truncate">{emp.first_name} {emp.last_name}</p>
            {isDeptHead && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Head</span>}
          </div>
          {emp.job_title && <p className="text-xs text-gray-500 truncate">{emp.job_title}</p>}
          <p className="text-xs text-gray-400 truncate">{emp.email}</p>
          {emp.reports_to_name && !isDeptHead && (
            <p className="text-xs text-indigo-500 truncate mt-0.5 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v5M2 7l3 2 3-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Reports to {emp.reports_to_name}
            </p>
          )}
        </div>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0', ROLE_COLOR[emp.role])}>
          {emp.role}
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-400">Joined {formatDate(emp.created_at)}</p>
        <span className="text-xs text-indigo-500 font-medium flex items-center gap-1">View profile <ExternalLink size={10} /></span>
      </div>
    </div>
  );
}

/* ─── EMPLOYEE PROFILE DRAWER ───────────────────────────────────────────── */
function EmployeeProfileDrawer({ emp, isManager, currentUser, onClose }: { emp: any; isManager: boolean; currentUser: any; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['employee', emp.id],
    queryFn: () => usersApi.get(emp.id),
  });

  const isSelf = emp.id === currentUser?.id;

  const { data: balance = [] } = useQuery<any[]>({
    queryKey: ['employee-balance', emp.id],
    queryFn: () => isSelf ? leavePackagesApi.myBalance() : leavePackagesApi.balance(emp.id),
    enabled: isSelf || isManager,
  });

  const deactivate = useMutation({
    mutationFn: () => usersApi.update(emp.id, { is_active: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Account deactivated'); onClose(); },
  });

  const startChat = useMutation({
    mutationFn: () => chatApi.startDirect(emp.id),
    onSuccess: (conv: any) => router.push(`/chat?conv=${conv.id}`),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', emp.id] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Profile picture updated');
    },
    onError: () => toast.error('Failed to upload photo'),
  });

  const p = profile ?? emp;
  const canEditAvatar = isSelf;

  const balanceMap = (balance as any[]).reduce<Record<string, any>>((acc, b) => {
    if (!acc[b.leave_type]) acc[b.leave_type] = b;
    return acc;
  }, {});

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 px-6 pt-6 pb-8 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
            <X size={16} className="text-white" />
          </button>

          <div className="flex items-end gap-4 mt-2">
            {/* Avatar with upload overlay */}
            <div className="relative group shrink-0">
              {p.avatar_url
                ? <img src={p.avatar_url} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30" />
                : <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold text-white border-2 border-white/30">
                    {getInitials(`${p.first_name} ${p.last_name}`)}
                  </div>}
              {canEditAvatar && (
                <>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarMutation.isPending}
                    className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {avatarMutation.isPending
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Camera size={18} className="text-white" />}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) avatarMutation.mutate(f); e.target.value = ''; }}
                  />
                </>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{p.first_name} {p.last_name}</h2>
              <p className="text-indigo-200 text-sm">{p.job_title ?? 'No title'}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', ROLE_COLOR[p.role])}>{p.role}</span>
                {p.department_name && <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">{p.department_name}</span>}
                {!p.is_active && <span className="text-[10px] bg-red-400/80 text-white px-2 py-0.5 rounded-full">Inactive</span>}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          {!isSelf && (
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => startChat.mutate()}
                disabled={startChat.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 text-sm font-semibold rounded-xl hover:bg-indigo-50 transition-colors"
              >
                <MessageSquare size={14} /> Message
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="divide-y divide-gray-100">

              {/* Contact */}
              <Section title="Contact">
                <Row icon={<Mail size={14} className="text-gray-400" />} label="Email" value={p.email} />
                <Row icon={<Phone size={14} className="text-gray-400" />} label="Phone" value={p.phone ?? '—'} />
                <Row icon={<MapPin size={14} className="text-gray-400" />} label="Address" value={p.address ?? '—'} />
                {p.reports_to_name && (
                  <Row icon={<User size={14} className="text-gray-400" />} label="Reports to" value={`${p.reports_to_name}${p.reports_to_job_title ? ` · ${p.reports_to_job_title}` : ''}`} />
                )}
                <Row icon={<CalendarDays size={14} className="text-gray-400" />} label="Joined" value={formatDate(p.created_at)} />
              </Section>

              {/* Identity — admin/manager only */}
              {isManager && (
                <Section title="Identity">
                  <Row icon={<FileText size={14} className="text-gray-400" />} label="NID" value={p.nid ?? '—'} />
                  {p.nid_url && (
                    <div className="flex items-start gap-3 py-2.5">
                      <span className="text-gray-400 mt-0.5 shrink-0"><FileText size={14} /></span>
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">NID Document</p>
                        <a href={p.nid_url} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">View NID <ExternalLink size={11} /></a>
                      </div>
                    </div>
                  )}
                  {p.passport_url && (
                    <div className="flex items-start gap-3 py-2.5">
                      <span className="text-gray-400 mt-0.5 shrink-0"><FileText size={14} /></span>
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">Passport</p>
                        <a href={p.passport_url} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">View Passport <ExternalLink size={11} /></a>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* Banking — admin/manager only */}
              {isManager && (p.bank_name || p.bank_account_number) && (
                <Section title="Banking">
                  <Row icon={<CreditCard size={14} className="text-gray-400" />} label="Bank" value={p.bank_name ?? '—'} />
                  <Row icon={<CreditCard size={14} className="text-gray-400" />} label="Account name" value={p.bank_account_name ?? '—'} />
                  <Row icon={<CreditCard size={14} className="text-gray-400" />} label="Account number" value={p.bank_account_number ?? '—'} />
                </Section>
              )}

              {/* Emergency contact — admin/manager only */}
              {isManager && p.emergency_contact_name && (
                <Section title="Emergency Contact">
                  <Row icon={<AlertTriangle size={14} className="text-amber-400" />} label="Name" value={p.emergency_contact_name} />
                  <Row icon={<Phone size={14} className="text-gray-400" />} label="Phone" value={p.emergency_contact_phone ?? '—'} />
                  <Row icon={<User size={14} className="text-gray-400" />} label="Relation" value={p.emergency_contact_relation ?? '—'} />
                </Section>
              )}

              {/* Leave balance — visible to self and managers */}
              {(isSelf || isManager) && (
                <Section title={isSelf ? 'My Leave Balance' : `${p.first_name}'s Leave Balance`}>
                  {Object.keys(balanceMap).length === 0 ? (
                    <p className="text-xs text-gray-400 py-1">
                      {isSelf ? 'No leave package assigned — contact HR to get enrolled.' : 'No active leave package assigned to this employee.'}
                    </p>
                  ) : (
                    <div className="space-y-3 py-1">
                      {Object.values(balanceMap).map((b: any) => {
                        const exhausted = b.days_remaining === 0;
                        const pct = b.days_allowed > 0 ? (b.days_remaining / b.days_allowed) * 100 : 0;
                        return (
                          <div key={b.leave_type}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="capitalize text-gray-700 font-medium">{b.leave_type}</span>
                              <span className={cn('font-semibold', exhausted ? 'text-red-500' : 'text-gray-700')}>
                                {b.days_remaining} / {b.days_allowed} days
                                {exhausted && <span className="ml-1.5 text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded">Exhausted</span>}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full transition-all', exhausted ? 'bg-red-400' : pct > 30 ? 'bg-green-500' : 'bg-amber-400')}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{b.days_used} used · {b.package_name}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>
              )}

              {/* Danger zone — admin only, not self */}
              {isManager && !isSelf && p.is_active && (
                <Section title="Danger Zone">
                  <button
                    onClick={() => { if (confirm(`Deactivate ${p.first_name}'s account?`)) deactivate.mutate(); }}
                    disabled={deactivate.isPending}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Deactivate account
                  </button>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800 break-words">{value}</p>
      </div>
    </div>
  );
}

/* ─── LEAVE PACKAGES TAB ────────────────────────────────────────────────── */
function LeavePackagesTab({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [allocatePackage, setAllocatePackage] = useState<LeavePackage | null>(null);

  const { data: packages = [], isLoading } = useQuery<LeavePackage[]>({
    queryKey: ['leave-packages'],
    queryFn: leavePackagesApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leavePackagesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-packages'] }); toast.success('Package deleted'); },
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{packages.length} package{packages.length !== 1 ? 's' : ''}</p>
        {isManager && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
            <Plus size={15} /> New Package
          </button>
        )}
      </div>

      {packages.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-14 text-center">
          <Package size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">No leave packages yet</p>
          <p className="text-sm text-gray-400">Create a package to define leave entitlements for employees.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-gray-900">{pkg.name}</p>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CalendarDays size={10} />
                      {formatDate(pkg.period_start)} → {formatDate(pkg.period_end)}
                    </span>
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {pkg.employee_count ?? 0} employee{(pkg.employee_count ?? 0) !== 1 ? 's' : ''} allocated
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Created by {pkg.created_by_name}</p>
                  <div className="flex flex-wrap gap-2">
                    {(pkg.types ?? []).map((t) => (
                      <div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <span className="text-xs capitalize text-gray-600">{t.leave_type}</span>
                        <span className="text-xs font-bold text-gray-900">{t.days_allowed}d</span>
                      </div>
                    ))}
                  </div>
                </div>
                {isManager && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setAllocatePackage(pkg)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Users size={14} /> Allocate
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${pkg.name}"?`)) deleteMutation.mutate(pkg.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <PackageFormModal onClose={() => setShowCreate(false)} />}
      {allocatePackage && <AllocateModal pkg={allocatePackage} onClose={() => setAllocatePackage(null)} />}
    </div>
  );
}

function PackageFormModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [types, setTypes] = useState<{ leave_type: string; days_allowed: number }[]>(
    LEAVE_TYPES.slice(0, 3).map((t) => ({ leave_type: t, days_allowed: t === 'annual' ? 21 : t === 'sick' ? 10 : 3 }))
  );

  const createMutation = useMutation({
    mutationFn: () => leavePackagesApi.create({ name, period_start: periodStart, period_end: periodEnd, types: types.filter((t) => t.days_allowed > 0) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-packages'] }); toast.success('Package created'); onClose(); },
    onError: () => toast.error('Failed to create package'),
  });

  const addType = () => {
    const available = LEAVE_TYPES.filter((t) => !types.find((x) => x.leave_type === t));
    if (available.length) setTypes([...types, { leave_type: available[0], days_allowed: 0 }]);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-5">New Leave Package</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Package name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2026 Annual Package"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Period start *</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Period end *</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Leave types & allocations</label>
              <button onClick={addType} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Plus size={12} /> Add type
              </button>
            </div>
            <div className="space-y-2">
              {types.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={t.leave_type} onChange={(e) => { const n = [...types]; n[i] = { ...n[i], leave_type: e.target.value }; setTypes(n); }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm capitalize focus:outline-none">
                    {LEAVE_TYPES.map((lt) => <option key={lt} value={lt}>{lt.charAt(0).toUpperCase() + lt.slice(1)}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} value={t.days_allowed}
                      onChange={(e) => { const n = [...types]; n[i] = { ...n[i], days_allowed: Number(e.target.value) }; setTypes(n); }}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none text-center" />
                    <span className="text-xs text-gray-400">days</span>
                  </div>
                  <button onClick={() => setTypes(types.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name || !periodStart || !periodEnd || types.length === 0 || createMutation.isPending}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Package'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AllocateModal({ pkg, onClose }: { pkg: LeavePackage; onClose: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: usersApi.list });
  const activeEmployees = (employees as any[]).filter((e) => e.is_active);

  const allocateMutation = useMutation({
    mutationFn: () => leavePackagesApi.allocate(pkg.id, selectAll ? 'all' : Array.from(selected)),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['leave-packages'] });
      toast.success(`Package allocated to ${res.allocated} employee${res.allocated !== 1 ? 's' : ''}`);
      onClose();
    },
    onError: () => toast.error('Failed to allocate'),
  });

  const toggleAll = (v: boolean) => {
    setSelectAll(v);
    setSelected(v ? new Set(activeEmployees.map((e: any) => e.id)) : new Set());
  };

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
    setSelectAll(n.size === activeEmployees.length);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-1">Allocate Package</h2>
        <p className="text-sm text-gray-500 mb-4">{pkg.name} · {formatDate(pkg.period_start)} → {formatDate(pkg.period_end)}</p>

        <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
          {/* Select all row */}
          <label className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100">
            <input type="checkbox" checked={selectAll} onChange={(e) => toggleAll(e.target.checked)} className="rounded" />
            <span className="text-sm font-semibold text-gray-700">All employees ({activeEmployees.length})</span>
          </label>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
            {activeEmployees.map((emp: any) => (
              <label key={emp.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggle(emp.id)} className="rounded" />
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {(emp.first_name?.[0] ?? '') + (emp.last_name?.[0] ?? '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{emp.first_name} {emp.last_name}</p>
                  <p className="text-xs text-gray-400 truncate">{emp.department_name ?? 'No dept.'}</p>
                </div>
              </label>
            ))}
            {activeEmployees.length === 0 && <p className="px-4 py-6 text-sm text-gray-400 text-center">No active employees.</p>}
          </div>
        </div>

        {selected.size > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            {selected.size === activeEmployees.length ? 'All employees' : `${selected.size} employee${selected.size !== 1 ? 's' : ''}`} selected
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
          <button
            onClick={() => allocateMutation.mutate()}
            disabled={selected.size === 0 || allocateMutation.isPending}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700"
          >
            {allocateMutation.isPending ? 'Allocating…' : `Allocate to ${selected.size}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── PERFORMANCE TAB ───────────────────────────────────────────────────── */
const REVIEW_STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-green-100 text-green-700',
};

function StarRow({ score, size = 14 }: { score: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} className={i < score ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </div>
  );
}

function PerformanceTab({ user }: { user: any }) {
  const qc = useQueryClient();
  const isManager = user?.role !== 'employee';

  /* filters */
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  /* modals */
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [expandedEmp, setExpandedEmp] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ reviewee_id: '', period: '', score: '', feedback: '', goals: '' });

  const filters = {
    reviewee_id: employeeFilter || undefined,
    date_from:   dateFrom || undefined,
    date_to:     dateTo   || undefined,
  };

  const { data: reviews = [], isLoading } = useQuery<any[]>({
    queryKey: ['performance', filters],
    queryFn: () => performanceApi.list(filters),
  });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: usersApi.list });

  const createMutation = useMutation({
    mutationFn: () => performanceApi.create({ ...form, score: form.score ? Number(form.score) : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['performance'] });
      toast.success('Review created');
      setShowCreate(false);
      setForm({ reviewee_id: '', period: '', score: '', feedback: '', goals: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => performanceApi.update(editingId!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['performance'] }); toast.success('Updated'); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => performanceApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['performance'] }); toast.success('Deleted'); },
  });

  const toggleExpand = (empId: string) =>
    setExpandedEmp((prev) => { const s = new Set(prev); s.has(empId) ? s.delete(empId) : s.add(empId); return s; });

  /* group reviews by employee */
  const grouped = reviews.reduce<Record<string, any>>((acc, r) => {
    if (!acc[r.reviewee_id]) {
      acc[r.reviewee_id] = {
        id: r.reviewee_id,
        name: r.reviewee_name,
        avatar: r.reviewee_avatar,
        job_title: r.reviewee_job_title,
        department: r.reviewee_department,
        reviews: [],
      };
    }
    acc[r.reviewee_id].reviews.push(r);
    return acc;
  }, {});

  const empGroups = Object.values(grouped).map((g: any) => {
    const scored = g.reviews.filter((r: any) => r.score != null);
    const avgScore = scored.length ? scored.reduce((s: number, r: any) => s + r.score, 0) / scored.length : null;
    const latest = g.reviews[0];
    return { ...g, avgScore, latest };
  });

  const hasFilters = employeeFilter || dateFrom || dateTo;

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Employee filter */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Employee</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white"
            >
              <option value="">All employees</option>
              {(employees as any[]).map((e) => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date range */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => { setEmployeeFilter(''); setDateFrom(''); setDateTo(''); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-2 rounded-lg hover:bg-red-50 transition-colors self-end"
          >
            <X size={13} /> Clear
          </button>
        )}

        <div className="ml-auto self-end">
          {isManager && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus size={14} /> New Review
            </button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total reviews', value: reviews.length, icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Employees reviewed', value: empGroups.length, icon: Users, color: 'text-blue-600 bg-blue-50' },
            {
              label: 'Avg score',
              value: (() => {
                const scored = reviews.filter((r: any) => r.score != null);
                if (!scored.length) return '—';
                return (scored.reduce((s: number, r: any) => s + r.score, 0) / scored.length).toFixed(1) + ' / 5';
              })(),
              icon: Award,
              color: 'text-amber-600 bg-amber-50',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', color)}><Icon size={16} /></div>
              <div>
                <p className="text-lg font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Employee contribution cards */}
      {empGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-14 text-center">
          <Star size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">No performance reviews found</p>
          {hasFilters && <p className="text-xs text-gray-400">Try adjusting your filters</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {empGroups.map((emp) => {
            const isOpen = expandedEmp.has(emp.id);
            return (
              <div key={emp.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Employee header row */}
                <button
                  onClick={() => toggleExpand(emp.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0">
                    {getInitials(emp.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{emp.name}</span>
                      {emp.department && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{emp.department}</span>
                      )}
                      {emp.job_title && (
                        <span className="text-xs text-gray-400">{emp.job_title}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {emp.avgScore != null && <StarRow score={Math.round(emp.avgScore)} />}
                      {emp.avgScore != null && (
                        <span className="text-xs text-gray-500">{emp.avgScore.toFixed(1)} avg</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {emp.reviews.length} review{emp.reviews.length !== 1 ? 's' : ''}
                        {emp.latest && ` · latest: ${emp.latest.period}`}
                      </span>
                    </div>
                  </div>

                  {/* Score badge */}
                  {emp.avgScore != null && (
                    <div className={cn(
                      'shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm',
                      emp.avgScore >= 4 ? 'bg-green-100 text-green-700'
                      : emp.avgScore >= 3 ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-600',
                    )}>
                      {emp.avgScore.toFixed(1)}
                    </div>
                  )}

                  <div className="shrink-0 text-gray-400">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                {/* Expanded review list */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {emp.reviews.map((r: any) => {
                      const isReviewer = r.reviewer_id === user?.id;
                      const isReviewee = r.reviewee_id === user?.id;
                      return (
                        <div key={r.id} className="flex items-start gap-4 px-5 py-4 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-medium text-gray-900">{r.period}</span>
                              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize', REVIEW_STATUS_STYLE[r.status])}>
                                {r.status}
                              </span>
                              <span className="text-xs text-gray-400">by {r.reviewer_name}</span>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                            </div>
                            {r.score != null && (
                              <div className="flex items-center gap-2 mb-1">
                                <StarRow score={r.score} />
                                <span className="text-xs text-gray-500">{r.score}/5</span>
                              </div>
                            )}
                            {r.feedback && <p className="text-sm text-gray-600 mt-1">{r.feedback}</p>}
                            {r.goals && (
                              <p className="text-xs text-gray-400 mt-1 flex items-start gap-1">
                                <TrendingUp size={11} className="mt-0.5 shrink-0" />
                                {r.goals}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isReviewer && r.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => { setEditingId(r.id); setForm({ reviewee_id: r.reviewee_id, period: r.period, score: r.score?.toString() ?? '', feedback: r.feedback ?? '', goals: r.goals ?? '' }); }}
                                  className="text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => { setEditingId(r.id); updateMutation.mutate({ status: 'submitted' }); }}
                                  className="text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 px-2.5 py-1.5 rounded-lg"
                                >
                                  Submit
                                </button>
                                <button
                                  onClick={() => { if (confirm('Delete this review?')) deleteMutation.mutate(r.id); }}
                                  className="text-xs text-red-400 hover:text-red-600 px-1.5 py-1.5 hover:bg-red-50 rounded-lg"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                            {isReviewee && r.status === 'submitted' && (
                              <button
                                onClick={() => { setEditingId(r.id); updateMutation.mutate({ status: 'acknowledged' }); }}
                                className="text-xs font-medium text-white bg-green-600 hover:bg-green-700 px-2.5 py-1.5 rounded-lg"
                              >
                                Acknowledge
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {isManager && (
                      <button
                        onClick={() => { setShowCreate(true); setForm((f) => ({ ...f, reviewee_id: emp.id })); }}
                        className="w-full flex items-center gap-2 px-5 py-3 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors font-medium border-t border-gray-50"
                      >
                        <Plus size={13} /> Add review for {emp.name.split(' ')[0]}
                      </button>
                    )}

                    {/* Task contributions */}
                    <ContributionsSection
                      employeeId={emp.id}
                      employeeName={emp.name}
                      dateFrom={dateFrom}
                      dateTo={dateTo}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {(showCreate || editingId) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowCreate(false); setEditingId(null); }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{showCreate ? 'New Review' : 'Edit Review'}</h2>
              <button onClick={() => { setShowCreate(false); setEditingId(null); }} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
                <select
                  value={form.reviewee_id}
                  onChange={(e) => setForm({ ...form, reviewee_id: e.target.value })}
                  disabled={!!editingId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                >
                  <option value="">Select employee…</option>
                  {(employees as any[]).filter((e) => e.id !== user?.id).map((e) => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Period * (e.g. Q2 2026)</label>
                <input
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  placeholder="Q2 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Score (1–5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm({ ...form, score: form.score === String(n) ? '' : String(n) })}
                      className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
                      style={{
                        background: Number(form.score) >= n ? '#fbbf24' : '',
                        borderColor: Number(form.score) >= n ? '#f59e0b' : '#e5e7eb',
                        color: Number(form.score) >= n ? '#fff' : '#9ca3af',
                      }}
                    >
                      {n}★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Feedback</label>
                <textarea
                  value={form.feedback}
                  onChange={(e) => setForm({ ...form, feedback: e.target.value })}
                  placeholder="What went well, what to improve…"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Goals for next period</label>
                <textarea
                  value={form.goals}
                  onChange={(e) => setForm({ ...form, goals: e.target.value })}
                  placeholder="Goals and targets…"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => { setShowCreate(false); setEditingId(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => showCreate ? createMutation.mutate() : updateMutation.mutate(form)}
                disabled={!form.reviewee_id || !form.period || createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-700"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── CONTRIBUTIONS SECTION ────────────────────────────────────────────── */
const STATUS_COLOR_MAP: Record<string, string> = {
  done:        'text-green-600 bg-green-50',
  in_progress: 'text-amber-600 bg-amber-50',
  in_review:   'text-purple-600 bg-purple-50',
  todo:        'text-blue-600 bg-blue-50',
  backlog:     'text-gray-500 bg-gray-100',
};
const STATUS_LABEL: Record<string, string> = {
  done: 'Done', in_progress: 'In Progress', in_review: 'In Review', todo: 'To Do', backlog: 'Backlog',
};
const TYPE_COLOR_MAP: Record<string, string> = {
  bug: 'text-red-500', task: 'text-blue-500', story: 'text-green-500', epic: 'text-purple-500',
};

function ContributionsSection({
  employeeId,
  employeeName,
  dateFrom,
  dateTo,
}: {
  employeeId: string;
  employeeName: string;
  dateFrom: string;
  dateTo: string;
}) {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useQuery<{ summary: any; issues: any[] }>({
    queryKey: ['contributions', employeeId, dateFrom, dateTo],
    queryFn: () => performanceApi.contributions(employeeId, {
      date_from: dateFrom || undefined,
      date_to:   dateTo   || undefined,
    }),
  });

  const summary = data?.summary;
  const issues  = data?.issues ?? [];
  const visible = showAll ? issues : issues.slice(0, 5);

  const completionPct = summary?.story_points_total
    ? Math.round((summary.story_points_completed / summary.story_points_total) * 100)
    : summary?.total
    ? Math.round((summary.done / summary.total) * 100)
    : 0;

  return (
    <div className="border-t border-gray-100 bg-gray-50/60">
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Briefcase size={12} /> Task Contributions
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
            <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            Loading…
          </div>
        ) : summary?.total === 0 ? (
          <p className="text-xs text-gray-400 py-2 italic">No tasks assigned{dateFrom || dateTo ? ' in this period' : ''}.</p>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: 'Total', value: summary?.total ?? 0, cls: 'text-gray-700 bg-white' },
                { label: 'Done', value: summary?.done ?? 0, cls: 'text-green-700 bg-green-50' },
                { label: 'In Progress', value: summary?.in_progress ?? 0, cls: 'text-amber-700 bg-amber-50' },
                { label: 'Points', value: summary?.story_points_total ? `${summary.story_points_completed}/${summary.story_points_total}` : (summary?.story_points_completed ?? 0), cls: 'text-indigo-700 bg-indigo-50' },
              ].map(({ label, value, cls }) => (
                <div key={label} className={cn('rounded-lg px-3 py-2 border border-gray-100 text-center', cls)}>
                  <p className="text-base font-bold">{value}</p>
                  <p className="text-[10px] font-medium mt-0.5 opacity-70">{label}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {summary?.total > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                  <span>Completion rate</span>
                  <span className="font-semibold text-gray-600">{completionPct}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Issue list */}
            <div className="space-y-1.5">
              {visible.map((issue: any) => (
                <div key={issue.id} className="flex items-center gap-2.5 bg-white rounded-lg border border-gray-100 px-3 py-2">
                  {/* Type dot */}
                  <span className={cn('shrink-0 text-[11px] font-bold uppercase', TYPE_COLOR_MAP[issue.type])}>
                    {issue.type[0].toUpperCase()}
                  </span>

                  {/* Title */}
                  <p className={cn(
                    'flex-1 text-xs text-gray-800 truncate',
                    issue.status === 'done' && 'line-through text-gray-400',
                  )}>
                    {issue.title}
                  </p>

                  {/* Project */}
                  <span className="text-[10px] text-gray-400 shrink-0 hidden sm:block">
                    {issue.project_icon} {issue.project_name}
                  </span>

                  {/* Sprint */}
                  {issue.sprint_name && (
                    <span className="text-[10px] text-gray-400 shrink-0 hidden md:block">{issue.sprint_name}</span>
                  )}

                  {/* Story points */}
                  {issue.story_points != null && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">
                      {issue.story_points}pt
                    </span>
                  )}

                  {/* Status badge */}
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize shrink-0',
                    STATUS_COLOR_MAP[issue.status],
                  )}>
                    {STATUS_LABEL[issue.status]}
                  </span>
                </div>
              ))}
            </div>

            {issues.length > 5 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="mt-2 w-full text-xs text-indigo-600 hover:text-indigo-700 font-medium py-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                {showAll ? 'Show less' : `Show ${issues.length - 5} more tasks`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ReportsTab() {
  return <ReportsPageComponent />;
}
