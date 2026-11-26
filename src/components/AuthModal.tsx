import { useEffect, useState, type FormEvent } from 'react';
import { X, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
import { apiRequest, ApiError } from '../lib/api.ts';
import type { AuthStatus, UserProfile } from '../types.ts';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: 'member' | 'admin';
  onClose: () => void;
  onAuthenticated: (token: string, user: UserProfile) => void;
}

export function AuthModal({
  isOpen,
  initialTab = 'member',
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [roleTab, setRoleTab] = useState<'member' | 'admin'>(initialTab);
  const [memberMode, setMemberMode] = useState<'login' | 'register'>('login');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRoleTab(initialTab);
    setError(null);
    apiRequest<AuthStatus>('/api/auth/status')
      .then((res) => setAuthStatus(res))
      .catch(() => setAuthStatus({ adminClaimed: false, usesEnvPasscode: false }));
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const isFirstRunAdminClaim =
    roleTab === 'admin' &&
    authStatus !== null &&
    !authStatus.adminClaimed &&
    !authStatus.usesEnvPasscode;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (roleTab === 'member') {
        if (memberMode === 'register') {
          const res = await apiRequest<{ token: string; user: UserProfile }>(
            '/api/auth/register',
            {
              method: 'POST',
              body: { name, email, password },
            }
          );
          onAuthenticated(res.token, res.user);
        } else {
          const res = await apiRequest<{ token: string; user: UserProfile }>(
            '/api/auth/login',
            {
              method: 'POST',
              body: { email, password },
            }
          );
          onAuthenticated(res.token, res.user);
        }
      } else if (isFirstRunAdminClaim) {
        const res = await apiRequest<{ token: string; user: UserProfile }>(
          '/api/auth/admin-claim',
          {
            method: 'POST',
            body: { name, email, password },
          }
        );
        onAuthenticated(res.token, res.user);
      } else {
        const res = await apiRequest<{ token: string; user: UserProfile }>(
          '/api/auth/admin-login',
          {
            method: 'POST',
            body: { email, password },
          }
        );
        onAuthenticated(res.token, res.user);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Gagal terhubung ke server otentikasi.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C161D]/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#EAD6DC] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#F3DFE5] pb-4">
          <div>
            <h2
              id="auth-modal-title"
              className="font-editorial text-2xl font-semibold text-[#2C161D]"
            >
              Akses Perpustakaan
            </h2>
            <p className="mt-1 text-sm text-[#7D5C66]">
              Masuk sebagai anggota untuk meminjam buku atau buka portal staf.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#7D5C66] hover:bg-[#F9EEF1] hover:text-[#2C161D] transition-colors"
            aria-label="Tutup dialog masuk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-[#F9EEF1] p-1">
          <button
            type="button"
            onClick={() => {
              setRoleTab('member');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              roleTab === 'member'
                ? 'bg-white text-[#6B1D2F] shadow-xs'
                : 'text-[#7D5C66] hover:text-[#2C161D]'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Anggota
          </button>
          <button
            type="button"
            onClick={() => {
              setRoleTab('admin');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              roleTab === 'admin'
                ? 'bg-white text-[#6B1D2F] shadow-xs'
                : 'text-[#7D5C66] hover:text-[#2C161D]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Administrator
          </button>
        </div>

        {roleTab === 'member' && (
          <div className="mt-4 flex items-center justify-between border-b border-[#F3DFE5] pb-3 text-xs">
            <span className="text-[#7D5C66]">
              {memberMode === 'login' ? 'Belum punya kartu anggota?' : 'Sudah terdaftar?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setMemberMode(memberMode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              className="font-semibold text-[#6B1D2F] hover:underline whitespace-nowrap shrink-0"
            >
              {memberMode === 'login' ? 'Daftar Anggota Baru' : 'Masuk dengan Akun'}
            </button>
          </div>
        )}

        {isFirstRunAdminClaim && (
          <div className="mt-4 rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] p-3.5 text-xs text-[#4E313B]">
            <p className="font-semibold text-[#6B1D2F]">
              Pengaturan Administrator Pertama Kali
            </p>
            <p className="mt-1 leading-relaxed text-[#7D5C66]">
              Belum ada akun pengelola yang terdaftar. Daftarkan akun administrator utama Anda di bawah ini untuk mengelola koleksi dan laporan.
            </p>
          </div>
        )}

        {error && (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#F5C2CE] bg-[#FFF1F4] px-3.5 py-2.5 text-xs text-[#9F1239]"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {((roleTab === 'member' && memberMode === 'register') || isFirstRunAdminClaim) && (
            <div>
              <label className="block text-xs font-medium text-[#4E313B] mb-1.5">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Sella Celina"
                className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3.5 py-2.5 text-sm text-[#2C161D] placeholder:text-[#9E8089] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
              />
            </div>
          )}

          {!(roleTab === 'admin' && authStatus?.usesEnvPasscode) && (
            <div>
              <label className="block text-xs font-medium text-[#4E313B] mb-1.5">
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3.5 py-2.5 text-sm text-[#2C161D] placeholder:text-[#9E8089] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#4E313B] mb-1.5">
              {roleTab === 'admin' && authStatus?.usesEnvPasscode
                ? 'Passcode Administrator'
                : 'Kata Sandi'}
            </label>
            <input
              type="password"
              required
              minLength={isFirstRunAdminClaim ? 8 : 6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isFirstRunAdminClaim
                  ? 'Minimal 8 karakter'
                  : 'Masukkan kata sandi'
              }
              className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3.5 py-2.5 text-sm text-[#2C161D] placeholder:text-[#9E8089] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#6B1D2F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#521322] disabled:opacity-60 whitespace-nowrap"
          >
            {loading
              ? 'Memproses...'
              : roleTab === 'member'
              ? memberMode === 'register'
                ? 'Daftar & Masuk'
                : 'Masuk sebagai Anggota'
              : isFirstRunAdminClaim
              ? 'Klaim & Aktifkan Admin'
              : 'Masuk Portal Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
