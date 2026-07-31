'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usersApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Upload, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

interface InviteInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  token: string;
}

type UploadField = 'passport_url' | 'nid_url';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function OnboardingPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    password: '',
    confirm_password: '',
    nid: '',
    phone: '',
    address: '',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    passport_url: '',
    nid_url: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    agreed: false,
  });

  const [uploading, setUploading] = useState<Record<UploadField, boolean>>({ passport_url: false, nid_url: false });
  const passportRef = useRef<HTMLInputElement>(null);
  const nidRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) { setTokenError('No invite token found in URL.'); setLoading(false); return; }
    usersApi.getInvite(token)
      .then(setInvite)
      .catch(() => setTokenError('This invite link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const set = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const uploadFile = async (file: File, field: UploadField) => {
    setUploading((u) => ({ ...u, [field]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/users/onboarding/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      set(field, url);
      toast.success('File uploaded');
    } catch {
      toast.error('Upload failed — try again');
    } finally {
      setUploading((u) => ({ ...u, [field]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!form.agreed) { toast.error('Please agree to the terms and conditions'); return; }

    setSubmitting(true);
    try {
      const { confirm_password, agreed, ...rest } = form;
      await usersApi.completeOnboarding({ token, ...rest });
      setDone(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
    </div>
  );

  if (tokenError) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite</h1>
        <p className="text-gray-500 text-sm">{tokenError}</p>
        <p className="text-gray-400 text-xs mt-4">Contact your HR administrator for a new invite link.</p>
      </div>
    </div>
  );

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h1>
        <p className="text-gray-500 text-sm mb-6">Your account is active. You can now log in to {invite?.company_name}.</p>
        <button
          onClick={() => router.push('/login')}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
        >
          Go to Login
        </button>
      </div>
    </div>
  );

  const FileUploadZone = ({ field, label, inputRef }: { field: UploadField; label: string; inputRef: React.RefObject<HTMLInputElement> }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label} <span className="text-red-500">*</span></label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadFile(f, field); }}
        className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
      >
        {uploading[field] ? (
          <Loader2 className="w-6 h-6 text-indigo-500 mx-auto animate-spin" />
        ) : form[field] ? (
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">Uploaded successfully</span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Drag & Drop your files or <span className="text-indigo-600 font-medium">Browse</span>
          </p>
        )}
        <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, field); }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Accept Invitation</h1>
          <p className="text-gray-400 text-sm mt-1">Accept Invitation</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pre-filled details */}
          <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-1">Your details from HR</h2>
            <p className="text-xs text-gray-400 mb-5">
              Your full name and email are prefilled by your administrator—they should match what you were given.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name <span className="text-red-500">*</span></label>
                <input
                  value={`${invite?.first_name} ${invite?.last_name}`}
                  readOnly
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  If this doesn't match your legal name, ask HR to correct your profile before completing onboarding.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work email address <span className="text-red-500">*</span></label>
                <input
                  value={invite?.email}
                  readOnly
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">This is the email your invitation was sent to; you'll use it to sign in.</p>
              </div>
            </div>
          </section>

          {/* NID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NID (National ID) <span className="text-red-500">*</span></label>
            <input
              value={form.nid} onChange={(e) => set('nid', e.target.value)} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={form.confirm_password} onChange={(e) => set('confirm_password', e.target.value)} required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone number <span className="text-red-500">*</span></label>
            <input
              type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address <span className="text-red-500">*</span></label>
            <textarea
              value={form.address} onChange={(e) => set('address', e.target.value)} required rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Banking details */}
          <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-1">Banking details</h2>
            <p className="text-xs text-gray-400 mb-5">
              Enter the bank name, the name on the account, and the account number exactly as they appear on your bank records.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank name <span className="text-red-500">*</span></label>
                <input
                  value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account name <span className="text-red-500">*</span></label>
                <input
                  value={form.bank_account_name} onChange={(e) => set('bank_account_name', e.target.value)} required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account number <span className="text-red-500">*</span></label>
                <input
                  value={form.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)} required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
          </section>

          {/* File uploads */}
          <FileUploadZone field="passport_url" label="Passport image upload" inputRef={passportRef} />
          <FileUploadZone field="nid_url" label="NID upload" inputRef={nidRef} />

          {/* Emergency contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency contact name <span className="text-red-500">*</span></label>
            <input
              value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency contact phone number <span className="text-red-500">*</span></label>
            <input
              type="tel" value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency contact relation <span className="text-red-500">*</span></label>
            <input
              value={form.emergency_contact_relation} onChange={(e) => set('emergency_contact_relation', e.target.value)} required
              placeholder="e.g. Spouse, Parent, Sibling"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox" checked={form.agreed} onChange={(e) => set('agreed', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-600">
              I agree to the terms and conditions <span className="text-red-500">*</span>
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-amber-400 hover:bg-amber-500 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? 'Submitting…' : 'Sign up'}
          </button>
        </form>
      </div>
    </div>
  );
}
