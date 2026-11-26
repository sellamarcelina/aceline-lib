import { useMemo, useState } from 'react';
import {
  RotateCcw,
  Clock,
  BookMarked,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import { BookCover } from './BookCover.tsx';
import { apiRequest, ApiError } from '../lib/api.ts';
import type { ActivityEvent, Loan, UserProfile } from '../types.ts';

interface MemberDashboardProps {
  user: UserProfile;
  token: string;
  loans: Loan[];
  activities: ActivityEvent[];
  onRefresh: () => void;
  onGoToCatalog: () => void;
}

function formatDateId(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysRemaining(dueIso: string): number {
  const diff = new Date(dueIso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function MemberDashboard({
  user,
  token,
  loans,
  activities,
  onRefresh,
  onGoToCatalog,
}: MemberDashboardProps) {
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const activeLoans = useMemo(
    () => loans.filter((l) => l.status !== 'dikembalikan'),
    [loans]
  );
  const completedLoans = useMemo(
    () => loans.filter((l) => l.status === 'dikembalikan'),
    [loans]
  );
  const totalFines = useMemo(
    () => loans.reduce((sum, l) => sum + l.fineAmount, 0),
    [loans]
  );

  const nearestDue = useMemo(() => {
    if (activeLoans.length === 0) return null;
    const sorted = [...activeLoans].sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    );
    return sorted[0];
  }, [activeLoans]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const loan of loans) {
      map.set(loan.bookCategory, (map.get(loan.bookCategory) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [loans]);

  async function handleReturn(loan: Loan) {
    setBusyLoanId(loan.id);
    setFeedback(null);
    try {
      await apiRequest(`/api/loans/${loan.id}/return`, {
        method: 'POST',
        token,
      });
      setFeedback({ type: 'ok', text: `Buku "${loan.bookTitle}" berhasil dikembalikan.` });
      onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Gagal mengembalikan buku.',
      });
    } finally {
      setBusyLoanId(null);
    }
  }

  async function handleExtend(loan: Loan) {
    setBusyLoanId(loan.id);
    setFeedback(null);
    try {
      await apiRequest(`/api/loans/${loan.id}/extend`, {
        method: 'POST',
        token,
      });
      setFeedback({
        type: 'ok',
        text: `Masa pinjam "${loan.bookTitle}" diperpanjang +7 hari.`,
      });
      onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Gagal memperpanjang masa pinjam.',
      });
    } finally {
      setBusyLoanId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#EAD6DC] pb-5">
        <div>
          <p className="text-xs font-mono text-[#82263C]">
            Kartu Anggota · {user.memberCode}
          </p>
          <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#2C161D]">
            Dasbor Anggota, {user.name}
          </h1>
          <p className="mt-1 text-sm text-[#7D5C66]">
            Pantau pinjaman aktif, perpanjang tenggat waktu, dan lihat statistik bacaan Anda secara real-time.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToCatalog}
          className="inline-flex items-center gap-2 rounded-xl bg-[#6B1D2F] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#521322] whitespace-nowrap shrink-0"
        >
          Pinjam Buku Baru
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]'
              : 'border-[#F5C2CE] bg-[#FFF1F4] text-[#9F1239]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 4-Column Member KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
          <p className="text-xs text-[#7D5C66]">Pinjaman Aktif</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#6B1D2F]">
            {activeLoans.length} / 5
          </p>
        </div>
        <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
          <p className="text-xs text-[#7D5C66]">Buku Selesai Dibaca</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#2C161D]">
            {completedLoans.length}
          </p>
        </div>
        <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
          <p className="text-xs text-[#7D5C66]">Jatuh Tempo Terdekat</p>
          <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-[#2C161D]">
            {nearestDue ? formatDateId(nearestDue.dueAt) : 'Tidak ada'}
          </p>
        </div>
        <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
          <p className="text-xs text-[#7D5C66]">Akumulasi Denda</p>
          <p
            className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${
              totalFines > 0 ? 'text-[#BE123C]' : 'text-[#15803D]'
            }`}
          >
            Rp {totalFines.toLocaleString('id-ID')}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Loans */}
        <section className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl font-semibold text-[#2C161D]">
              Sedang Dipinjam
            </h2>
            <span className="font-mono text-xs tabular-nums text-[#7D5C66]">
              {activeLoans.length} transaksi aktif
            </span>
          </div>

          {activeLoans.length === 0 ? (
            <div className="rounded-2xl border border-[#EAD6DC] bg-white p-10 text-center">
              <BookMarked className="mx-auto h-7 w-7 text-[#9E8089]" strokeWidth={1.5} />
              <p className="mt-3 font-editorial text-lg font-medium text-[#2C161D]">
                Belum ada buku yang sedang dipinjam
              </p>
              <p className="mt-1 text-sm text-[#7D5C66]">
                Telusuri katalog Acelivre untuk mulai meminjam koleksi pilihan Anda.
              </p>
              <button
                type="button"
                onClick={onGoToCatalog}
                className="mt-4 rounded-xl bg-[#6B1D2F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#521322]"
              >
                Buka Katalog
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeLoans.map((loan) => {
                const remain = daysRemaining(loan.dueAt);
                const isLate = loan.status === 'terlambat';
                const isBusy = busyLoanId === loan.id;
                return (
                  <div
                    key={loan.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#EAD6DC] bg-white p-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F9EEF1]">
                        <BookCover
                          src={loan.bookCoverUrl}
                          title={loan.bookTitle}
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-[#7D5C66]">
                          <span className="font-mono tabular-nums">{loan.loanCode}</span>
                          <span aria-hidden="true">·</span>
                          <span>{loan.bookCategory}</span>
                        </div>
                        <h3 className="mt-1 font-editorial text-base font-semibold text-[#2C161D] truncate">
                          {loan.bookTitle}
                        </h3>
                        <p className="text-xs text-[#7D5C66]">{loan.bookAuthor}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs tabular-nums">
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              isLate ? 'text-[#BE123C]' : 'text-[#4E313B]'
                            }`}
                          >
                            {isLate ? (
                              <AlertTriangle className="h-3.5 w-3.5" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-[#82263C]" />
                            )}
                            {isLate
                              ? `Terlambat ${Math.abs(remain)} hari · Denda Rp ${loan.fineAmount.toLocaleString('id-ID')}`
                              : `Jatuh tempo ${formatDateId(loan.dueAt)} (${remain} hari lagi)`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isLate && loan.extendedCount < 2 && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleExtend(loan)}
                          className="rounded-lg border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 text-xs font-semibold text-[#6B1D2F] hover:bg-[#F9EEF1] disabled:opacity-50 whitespace-nowrap"
                        >
                          Perpanjang +7h
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleReturn(loan)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#6B1D2F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#521322] disabled:opacity-50 whitespace-nowrap"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Kembalikan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed History */}
          <div className="pt-4 space-y-3">
            <h2 className="font-editorial text-xl font-semibold text-[#2C161D]">
              Riwayat Pengembalian
            </h2>
            {completedLoans.length === 0 ? (
              <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-6 text-xs text-[#7D5C66]">
                Riwayat pengembalian buku akan tercatat otomatis di sini.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#EAD6DC] bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#F3DFE5] bg-[#FDF8F9] text-[#7D5C66]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Kode</th>
                      <th className="px-4 py-3 font-medium">Judul Buku</th>
                      <th className="px-4 py-3 font-medium">Dipinjam</th>
                      <th className="px-4 py-3 font-medium">Dikembalikan</th>
                      <th className="px-4 py-3 font-medium text-right">Denda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3DFE5]">
                    {completedLoans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-[#FDF8F9]">
                        <td className="px-4 py-3 font-mono tabular-nums text-[#7D5C66]">
                          {loan.loanCode}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#2C161D]">
                          {loan.bookTitle}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[#7D5C66]">
                          {formatDateId(loan.borrowedAt)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[#15803D]">
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {loan.returnedAt ? formatDateId(loan.returnedAt) : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-right text-[#2C161D]">
                          Rp {loan.fineAmount.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Personal Stats & Real-Time Activity */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="rounded-xl border border-[#EAD6DC] bg-white p-5">
            <h3 className="font-editorial text-lg font-semibold text-[#2C161D]">
              Minat Kategori Anda
            </h3>
            <p className="text-xs text-[#7D5C66] mt-0.5">
              Berdasarkan riwayat peminjaman
            </p>
            <div className="mt-4 space-y-3">
              {categoryBreakdown.length === 0 ? (
                <p className="text-xs text-[#9E8089]">
                  Belum ada data kategori. Pinjam buku pertama Anda untuk melihat preferensi baca.
                </p>
              ) : (
                categoryBreakdown.map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="text-[#4E313B] truncate pr-2">{cat}</span>
                    <span className="font-mono tabular-nums font-semibold text-[#6B1D2F]">
                      {count}x
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#EAD6DC] bg-white p-5">
            <h3 className="font-editorial text-lg font-semibold text-[#2C161D]">
              Aktivitas Terbaru
            </h3>
            <p className="text-xs text-[#7D5C66] mt-0.5">
              Pembaruan transaksi real-time
            </p>
            <div className="mt-4 divide-y divide-[#F3DFE5]">
              {activities.length === 0 ? (
                <p className="text-xs text-[#9E8089]">Belum ada aktivitas tercatat.</p>
              ) : (
                activities.slice(0, 8).map((act) => (
                  <div key={act.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-xs leading-relaxed text-[#2C161D]">
                      {act.description}
                    </p>
                    <p className="mt-1 font-mono text-[11px] tabular-nums text-[#9E8089]">
                      {new Date(act.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      ·{' '}
                      {new Date(act.timestamp).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
