'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ companyName: '', firstName: '', lastName: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.register(form);
      setAuth(res.user, res.access_token);
      toast.success('Workspace created!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-700 to-indigo-900">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏢</div>
          <h1 className="text-2xl font-bold text-gray-900">Create Workspace</h1>
          <p className="text-gray-500 text-sm mt-1">Get your company started on GKK ERP</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Company Name', key: 'companyName', placeholder: 'Acme Corp', type: 'text' },
            { label: 'First Name', key: 'firstName', placeholder: 'John', type: 'text' },
            { label: 'Last Name', key: 'lastName', placeholder: 'Doe', type: 'text' },
            { label: 'Work Email', key: 'email', placeholder: 'john@acme.com', type: 'email' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type} required value={(form as any)[key]} onChange={set(key)}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} required minLength={8}
                value={form.password} onChange={set('password')}
                placeholder="8+ characters"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create Workspace'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have a workspace?{' '}
          <Link href="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
