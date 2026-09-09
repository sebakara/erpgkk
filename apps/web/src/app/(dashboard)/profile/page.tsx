'use client';
import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Lock, CheckCircle, Camera, Github } from 'lucide-react';
import { authApi, usersApi, githubApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { getInitials, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type Section = 'info' | 'password' | 'github';

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [section, setSection] = useState<Section>('info');

  const [info, setInfo] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    job_title: user?.job_title ?? '',
  });

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdError, setPwdError] = useState('');

  const updateInfoMutation = useMutation({
    mutationFn: () => usersApi.update(user!.id, {
      first_name: info.first_name.trim(),
      last_name: info.last_name.trim(),
      job_title: info.job_title.trim() || null,
    }),
    onSuccess: (updated) => {
      updateUser(updated);
      toast.success('Profile updated');
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const changePwdMutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: pwd.current, newPassword: pwd.next }),
    onSuccess: () => {
      toast.success('Password changed');
      setPwd({ current: '', next: '', confirm: '' });
      setPwdError('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to change password';
      toast.error(msg);
    },
  });

  const handleChangePwd = () => {
    if (pwd.next.length < 8) { setPwdError('New password must be at least 8 characters'); return; }
    if (pwd.next !== pwd.confirm) { setPwdError('Passwords do not match'); return; }
    setPwdError('');
    changePwdMutation.mutate();
  };

  const initials = getInitials(`${user?.first_name} ${user?.last_name}`);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const avatarMutation = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: (data: any) => {
      updateUser({ ...user!, avatar_url: data.url });
      toast.success('Profile picture updated');
    },
    onError: () => toast.error('Failed to upload photo'),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Profile Settings</h1>

      {/* Avatar + name header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-5">
        <div className="relative group shrink-0">
          {user?.avatar_url
            ? <img src={user.avatar_url} className="w-16 h-16 rounded-full object-cover" />
            : <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 text-xl font-bold flex items-center justify-center">
                {initials}
              </div>}
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarMutation.isPending}
            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{user?.first_name} {user?.last_name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 capitalize font-medium">
            {user?.role}
          </span>
          <p className="text-xs text-gray-400 mt-1">Hover the photo to change it</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'info', label: 'Personal Info', icon: <User size={14} /> },
          { key: 'github', label: 'GitHub', icon: <Github size={14} /> },
          { key: 'password', label: 'Password', icon: <Lock size={14} /> },
        ] as { key: Section; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              section === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Personal Info form */}
      {section === 'info' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">First name</label>
              <input
                value={info.first_name}
                onChange={(e) => setInfo({ ...info, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Last name</label>
              <input
                value={info.last_name}
                onChange={(e) => setInfo({ ...info, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Job title</label>
            <input
              value={info.job_title}
              onChange={(e) => setInfo({ ...info, job_title: e.target.value })}
              placeholder="e.g. Senior Engineer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
            <input
              value={user?.email ?? ''}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => updateInfoMutation.mutate()}
              disabled={updateInfoMutation.isPending || !info.first_name.trim() || !info.last_name.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {updateInfoMutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {section === 'github' && <GitHubProfileSection />}

      {/* Change password form */}
      {section === 'password' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Current password</label>
            <input
              type="password"
              value={pwd.current}
              onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">New password</label>
            <input
              type="password"
              value={pwd.next}
              onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm new password</label>
            <input
              type="password"
              value={pwd.confirm}
              onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {pwdError && (
            <p className="text-sm text-red-500">{pwdError}</p>
          )}
          {changePwdMutation.isSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle size={15} /> Password updated successfully.
            </div>
          )}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleChangePwd}
              disabled={!pwd.current || !pwd.next || !pwd.confirm || changePwdMutation.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {changePwdMutation.isPending ? 'Updating…' : 'Change password'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GitHubProfileSection() {
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const { data: account, isLoading } = useQuery({
    queryKey: ['github-me'],
    queryFn: githubApi.me,
  });

  const mapMutation = useMutation({
    mutationFn: () => githubApi.mapMe(username.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-me'] });
      toast.success('GitHub account linked');
      setUsername('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to link GitHub'),
  });

  const unmapMutation = useMutation({
    mutationFn: githubApi.unmapMe,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-me'] });
      toast.success('GitHub account unlinked');
    },
    onError: () => toast.error('Failed to unlink'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <p className="text-sm text-gray-500">
        Link your GitHub username so pull requests, reviews, and commits show up next to your name.
        Matching is by GitHub user id, not email.
      </p>
      {account?.github_username ? (
        <div className="flex items-center gap-3">
          {account.avatar_url ? (
            <img src={account.avatar_url} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center">
              <Github size={16} />
            </div>
          )}
          <div className="flex-1">
            <p className="font-medium text-gray-900">@{account.github_username}</p>
            <p className="text-xs text-gray-400">
              Connected {account.connected_at ? new Date(account.connected_at).toLocaleDateString() : ''}
            </p>
          </div>
          <button
            onClick={() => unmapMutation.mutate()}
            disabled={unmapMutation.isPending}
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            Unlink
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="github username"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={() => mapMutation.mutate()}
            disabled={!username.trim() || mapMutation.isPending}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
          >
            {mapMutation.isPending ? 'Linking…' : 'Link'}
          </button>
        </div>
      )}
    </div>
  );
}
