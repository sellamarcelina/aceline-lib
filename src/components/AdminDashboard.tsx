import { useMemo, useState, type FormEvent } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Printer,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  X,
  UserCheck,
  UserX,
  Activity,
  BookPlus,
} from 'lucide-react';
import { BorrowReturnTrendChart, CategoryDistributionChart } from './Charts.tsx';
import { BookCover } from './BookCover.tsx';
import {
  apiRequest,
  ApiError,
  downloadReportCsv,
  type RealtimeStatus,
} from '../lib/api.ts';
import type {
  ActivityEvent,
  AutomatedReport,
  Book,
  BookCategory,
  Loan,
  PublicOverview,
  UserProfile,
} from '../types.ts';

interface AdminDashboardProps {
  token: string;
  books: Book[];
  overview: PublicOverview | null;
  loans: Loan[];
  members: UserProfile[];
  activities: ActivityEvent[];
  reports: AutomatedReport[];
  realtimeStatus: RealtimeStatus;
  onRefreshAll: () => void;
}

type AdminTab = 'overview' | 'collection' | 'circulation' | 'reports';

const BOOK_CATEGORIES: BookCategory[] = [
  'Sastra & Fiksi',
  'Arsitektur & Seni',
  'Teknologi & Sains',
  'Filsafat & Sejarah',
  'Puisi & Esai',
  'Bisnis & Desain',
];

const COVER_PRESETS = [
  {
    label: 'Botani Rose',
    url: '/src/assets/images/cover_filosofi_senja_1795661487312.jpg',
  },
  {
    label: 'Linen Arsitektur',
    url: '/src/assets/images/cover_arsitektur_sunyi_1795661488261.jpg',
  },
  {
    label: 'Geometris Maroon',
    url: '/src/assets/images/cover_algoritma_data_1795661484624.jpg',
  },
  {
    label: 'Kaligrafi Ivory',
    url: '/src/assets/images/cover_antologi_puisi_1795661485987.jpg',
  },
];

function formatDateId(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTimeId(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AdminDashboard({
  token,
  books,
  overview,
  loans,
  members,
  activities,
  reports,
  realtimeStatus,
  onRefreshAll,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Collection state
  const [bookSearch, setBookSearch] = useState('');
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    isbn: '',
    publisher: '',
    year: new Date().getFullYear(),
    category: 'Sastra & Fiksi' as BookCategory,
    shelfLocation: 'Rak A-01',
    totalCopies: 3,
    coverUrl: COVER_PRESETS[0].url,
    synopsis: '',
  });
  const [savingBook, setSavingBook] = useState(false);

  // Circulation state
  const [loanFilter, setLoanFilter] = useState<'all' | 'dipinjam' | 'terlambat' | 'dikembalikan'>('all');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInMemberId, setWalkInMemberId] = useState('');
  const [walkInBookId, setWalkInBookId] = useState('');
  const [walkInDays, setWalkInDays] = useState<7 | 14>(7);
  const [creatingLoan, setCreatingLoan] = useState(false);

  // Reports state
  const [reportPeriod, setReportPeriod] = useState<'harian' | 'mingguan' | 'bulanan'>('harian');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const overdueLoans = useMemo(
    () => loans.filter((l) => l.status === 'terlambat'),
    [loans]
  );
  const activeLoansCount = useMemo(
    () => loans.filter((l) => l.status !== 'dikembalikan').length,
    [loans]
  );
  const totalFines = useMemo(
    () => loans.reduce((sum, l) => sum + l.fineAmount, 0),
    [loans]
  );
  const topBooks = useMemo(
    () => [...books].sort((a, b) => b.borrowCount - a.borrowCount).slice(0, 5),
    [books]
  );

  const filteredBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [books, bookSearch]);

  const filteredLoans = useMemo(() => {
    if (loanFilter === 'all') return loans;
    return loans.filter((l) => l.status === loanFilter);
  }, [loans, loanFilter]);

  const activeReport = useMemo(() => {
    if (selectedReportId) {
      const found = reports.find((r) => r.id === selectedReportId);
      if (found) return found;
    }
    return reports[0] || null;
  }, [reports, selectedReportId]);

  function openCreateBook() {
    setEditingBook(null);
    setBookForm({
      title: '',
      author: '',
      isbn: '',
      publisher: 'Pustaka Acelivre',
      year: new Date().getFullYear(),
      category: 'Sastra & Fiksi',
      shelfLocation: 'Rak A-01',
      totalCopies: 3,
      coverUrl: COVER_PRESETS[0].url,
      synopsis: '',
    });
    setBookModalOpen(true);
  }

  function openEditBook(book: Book) {
    setEditingBook(book);
    setBookForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      publisher: book.publisher,
      year: book.year,
      category: book.category,
      shelfLocation: book.shelfLocation,
      totalCopies: book.totalCopies,
      coverUrl: book.coverUrl,
      synopsis: book.synopsis,
    });
    setBookModalOpen(true);
  }

  async function handleSaveBook(e: FormEvent) {
    e.preventDefault();
    setSavingBook(true);
    setFeedback(null);
    try {
      if (editingBook) {
        await apiRequest(`/api/books/${editingBook.id}`, {
          method: 'PUT',
          token,
          body: bookForm,
        });
        setFeedback({ type: 'ok', text: `Koleksi "${bookForm.title}" berhasil diperbarui.` });
      } else {
        await apiRequest('/api/books', {
          method: 'POST',
          token,
          body: bookForm,
        });
        setFeedback({ type: 'ok', text: `Koleksi baru "${bookForm.title}" ditambahkan.` });
      }
      setBookModalOpen(false);
      onRefreshAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Gagal menyimpan data buku.',
      });
    } finally {
      setSavingBook(false);
    }
  }

  async function handleDeleteBook(book: Book) {
    setFeedback(null);
    try {
      await apiRequest(`/api/books/${book.id}`, {
        method: 'DELETE',
        token,
      });
      setFeedback({ type: 'ok', text: `Buku "${book.title}" dihapus dari katalog.` });
      onRefreshAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Gagal menghapus buku.',
      });
    }
  }

  async function handleReturnLoan(loan: Loan) {
    setFeedback(null);
    try {
      await apiRequest(`/api/loans/${loan.id}/return`, {
        method: 'POST',
        token,
      });
      setFeedback({ type: 'ok', text: `Pengembalian ${loan.loanCode} berhasil diproses.` });
      onRefreshAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Gagal memproses pengembalian.',
      });
    }
  }

  async function handleWalkInLoan(e: FormEvent) {
    e.preventDefault();
    if (!walkInMemberId || !walkInBookId) return;
    setCreatingLoan(true);
    setFeedback(null);
    try {
      await apiRequest('/api/loans', {
        method: 'POST',
        token,
        body: {
          bookId: walkInBookId,
          targetUserId: walkInMemberId,
          durationDays: walkInDays,
        },
      });
      setWalkInOpen(false);
      setFeedback({ type: 'ok', text: 'Transaksi peminjaman berhasil dicatat.' });
      onRefreshAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Gagal mencatat peminjaman.',
      });
    } finally {
      setCreatingLoan(false);
    }
  }

  async function handleToggleMemberStatus(member: UserProfile) {
    const nextStatus = member.status === 'aktif' ? 'ditangguhkan' : 'aktif';
    setFeedback(null);
    try {
      await apiRequest(`/api/members/${member.id}/status`, {
        method: 'PATCH',
        token,
        body: { status: nextStatus },
      });
      setFeedback({
        type: 'ok',
        text: `Status anggota ${member.name} diubah menjadi ${nextStatus}.`,
      });
      onRefreshAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Gagal memperbarui status anggota.',
      });
    }
  }

  async function handleGenerateReport() {
    setGeneratingReport(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{ report: AutomatedReport }>('/api/reports/generate', {
        method: 'POST',
        token,
        body: { periodType: reportPeriod },
      });
      setSelectedReportId(res.report.id);
      setFeedback({
        type: 'ok',
        text: `Laporan ${res.report.reportCode} berhasil dibuat.`,
      });
      onRefreshAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Gagal membuat laporan.',
      });
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleDownloadCsv(report: AutomatedReport) {
    try {
      await downloadReportCsv(report.id, report.reportCode, token);
    } catch {
      setFeedback({ type: 'err', text: 'Gagal mengunduh berkas CSV.' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="no-print flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#EAD6DC] pb-5">
        <div>
          <p className="text-xs font-medium text-[#82263C]">
            Portal Manajemen Perpustakaan
          </p>
          <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#2C161D]">
            Dasbor Administrator
          </h1>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-[#F9EEF1] p-1">
          {[
            { id: 'overview', label: 'Ringkasan & Statistik' },
            { id: 'collection', label: 'Manajemen Koleksi' },
            { id: 'circulation', label: 'Sirkulasi & Anggota' },
            { id: 'reports', label: 'Pelaporan Otomatis' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white text-[#6B1D2F] shadow-xs'
                  : 'text-[#7D5C66] hover:text-[#2C161D]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          className={`no-print rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]'
              : 'border-[#F5C2CE] bg-[#FFF1F4] text-[#9F1239]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* TAB 1: OVERVIEW & REAL-TIME ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
              <p className="text-xs text-[#7D5C66]">Total Koleksi</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#2C161D]">
                {overview?.totalTitles ?? books.length} judul
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-[#7D5C66]">
                {overview?.availableCopies ?? 0} / {overview?.totalCopies ?? 0} eksemplar tersedia
              </p>
            </div>
            <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
              <p className="text-xs text-[#7D5C66]">Sedang Dipinjam</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#6B1D2F]">
                {activeLoansCount}
              </p>
              <p className="mt-1 text-xs text-[#7D5C66]">
                Transaksi sirkulasi berjalan
              </p>
            </div>
            <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
              <p className="text-xs text-[#7D5C66]">Keterlambatan & Denda</p>
              <p
                className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${
                  overdueLoans.length > 0 ? 'text-[#BE123C]' : 'text-[#15803D]'
                }`}
              >
                {overdueLoans.length} telat
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-[#7D5C66]">
                Total denda Rp {totalFines.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
              <p className="text-xs text-[#7D5C66]">Anggota Terdaftar</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#2C161D]">
                {members.length}
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-[#7D5C66]">
                {members.filter((m) => m.status === 'aktif').length} status aktif
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-xl border border-[#EAD6DC] bg-white p-6">
              <div className="mb-4">
                <h2 className="font-editorial text-xl font-semibold text-[#2C161D]">
                  Statistik Peminjaman 7 Hari Terakhir
                </h2>
                <p className="text-xs text-[#7D5C66] mt-0.5">
                  Perbandingan volume peminjaman dan pengembalian harian
                </p>
              </div>
              <BorrowReturnTrendChart data={overview?.dailyTrends || []} />
            </div>

            <div className="lg:col-span-5 rounded-xl border border-[#EAD6DC] bg-white p-6">
              <div className="mb-4">
                <h2 className="font-editorial text-xl font-semibold text-[#2C161D]">
                  Popularitas Kategori
                </h2>
                <p className="text-xs text-[#7D5C66] mt-0.5">
                  Akumulasi peminjaman per bidang literatur
                </p>
              </div>
              <CategoryDistributionChart categories={overview?.categories || []} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Real-time Transaction Stream */}
            <div className="lg:col-span-7 rounded-xl border border-[#EAD6DC] bg-white p-6">
              <div className="flex items-center justify-between border-b border-[#F3DFE5] pb-3.5">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#6B1D2F]" />
                  <h2 className="font-editorial text-xl font-semibold text-[#2C161D]">
                    Aktivitas Transaksi Real-Time
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#7D5C66]">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      realtimeStatus === 'connected'
                        ? 'bg-[#16A34A]'
                        : realtimeStatus === 'connecting'
                        ? 'bg-[#D97706]'
                        : 'bg-[#BE123C]'
                    }`}
                  />
                  {realtimeStatus === 'connected'
                    ? 'WebSocket Tersambung'
                    : realtimeStatus === 'connecting'
                    ? 'Menghubungkan...'
                    : 'Terputus'}
                </span>
              </div>

              <div className="mt-3 max-h-[320px] overflow-y-auto divide-y divide-[#F3DFE5]">
                {activities.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#9E8089]">
                    Belum ada aktivitas transaksi.
                  </p>
                ) : (
                  activities.slice(0, 25).map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start justify-between gap-4 py-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="text-[#2C161D] leading-relaxed">
                          {act.description}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#7D5C66]">
                          Oleh {act.actorName}
                          {act.loanCode ? ` · ${act.loanCode}` : ''}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-[#9E8089] shrink-0">
                        {formatTimeId(act.timestamp)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Books */}
            <div className="lg:col-span-5 rounded-xl border border-[#EAD6DC] bg-white p-6">
              <div className="border-b border-[#F3DFE5] pb-3.5">
                <h2 className="font-editorial text-xl font-semibold text-[#2C161D]">
                  Koleksi Paling Diminati
                </h2>
                <p className="text-xs text-[#7D5C66] mt-0.5">
                  Judul dengan frekuensi peminjaman tertinggi
                </p>
              </div>
              <div className="mt-3 divide-y divide-[#F3DFE5]">
                {topBooks.map((book, idx) => (
                  <div
                    key={book.id}
                    className="flex items-center justify-between gap-3 py-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-semibold tabular-nums text-[#82263C] w-5">
                        0{idx + 1}.
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-[#2C161D] truncate">
                          {book.title}
                        </p>
                        <p className="text-[11px] text-[#7D5C66] truncate">
                          {book.author} · {book.category}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-[#6B1D2F] shrink-0">
                      {book.borrowCount}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COLLECTION MANAGEMENT */}
      {activeTab === 'collection' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9E8089]" />
              <input
                type="search"
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                placeholder="Cari koleksi berdasarkan judul, penulis, ISBN..."
                className="w-full rounded-xl border border-[#EAD6DC] bg-white pl-9 pr-3.5 py-2 text-sm text-[#2C161D] placeholder:text-[#9E8089] focus:border-[#6B1D2F] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={openCreateBook}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6B1D2F] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#521322] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              Tambah Koleksi Buku
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#EAD6DC] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#F3DFE5] bg-[#FDF8F9] text-[#7D5C66]">
                <tr>
                  <th className="px-4 py-3 font-medium">Buku</th>
                  <th className="px-4 py-3 font-medium">ISBN</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Rak</th>
                  <th className="px-4 py-3 font-medium text-right">Stok Tersedia</th>
                  <th className="px-4 py-3 font-medium text-right">Dipinjam</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3DFE5]">
                {filteredBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-[#FDF8F9]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-8 shrink-0 overflow-hidden rounded bg-[#F9EEF1]">
                          <BookCover
                            src={book.coverUrl}
                            title={book.title}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#2C161D] truncate max-w-[240px]">
                            {book.title}
                          </p>
                          <p className="text-[11px] text-[#7D5C66]">
                            {book.author} · {book.year}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[#7D5C66]">
                      {book.isbn}
                    </td>
                    <td className="px-4 py-3 text-[#4E313B]">{book.category}</td>
                    <td className="px-4 py-3 font-mono text-[#7D5C66]">
                      {book.shelfLocation}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-right">
                      <span
                        className={
                          book.availableCopies === 0
                            ? 'font-semibold text-[#BE123C]'
                            : 'text-[#15803D] font-semibold'
                        }
                      >
                        {book.availableCopies}
                      </span>{' '}
                      <span className="text-[#9E8089]">/ {book.totalCopies}</span>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-right text-[#2C161D]">
                      {book.borrowCount}x
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditBook(book)}
                          className="rounded-lg p-1.5 text-[#7D5C66] hover:bg-[#F9EEF1] hover:text-[#6B1D2F]"
                          title="Edit buku"
                          aria-label={`Edit ${book.title}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBook(book)}
                          className="rounded-lg p-1.5 text-[#7D5C66] hover:bg-[#FFF1F4] hover:text-[#BE123C]"
                          title="Hapus buku"
                          aria-label={`Hapus ${book.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CIRCULATION & MEMBERS */}
      {activeTab === 'circulation' && (
        <div className="space-y-8">
          {/* Loans Management */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-xl bg-[#F9EEF1] p-1 overflow-x-auto">
                {[
                  { id: 'all', label: 'Semua Transaksi' },
                  { id: 'dipinjam', label: 'Dipinjam' },
                  { id: 'terlambat', label: 'Terlambat' },
                  { id: 'dikembalikan', label: 'Selesai' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLoanFilter(f.id as typeof loanFilter)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      loanFilter === f.id
                        ? 'bg-white text-[#6B1D2F] shadow-xs'
                        : 'text-[#7D5C66] hover:text-[#2C161D]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setWalkInMemberId(members.find((m) => m.status === 'aktif')?.id || '');
                  setWalkInBookId(books.find((b) => b.availableCopies > 0)?.id || '');
                  setWalkInOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6B1D2F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#521322] whitespace-nowrap shrink-0"
              >
                <BookPlus className="h-4 w-4" />
                Catat Peminjaman Langsung
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#EAD6DC] bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#F3DFE5] bg-[#FDF8F9] text-[#7D5C66]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Kode</th>
                    <th className="px-4 py-3 font-medium">Peminjam</th>
                    <th className="px-4 py-3 font-medium">Judul Buku</th>
                    <th className="px-4 py-3 font-medium">Jatuh Tempo</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Denda</th>
                    <th className="px-4 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3DFE5]">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#9E8089]">
                        Belum ada transaksi peminjaman pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-[#FDF8F9]">
                        <td className="px-4 py-3 font-mono tabular-nums text-[#7D5C66]">
                          {loan.loanCode}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-[#2C161D] block">
                            {loan.memberName}
                          </span>
                          <span className="font-mono text-[11px] text-[#9E8089]">
                            {loan.memberCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#2C161D] max-w-[220px] truncate">
                          {loan.bookTitle}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-[#4E313B]">
                          {formatDateId(loan.dueAt)}
                        </td>
                        <td className="px-4 py-3">
                          {loan.status === 'dikembalikan' ? (
                            <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Dikembalikan
                            </span>
                          ) : loan.status === 'terlambat' ? (
                            <span className="inline-flex items-center gap-1 font-medium text-[#BE123C]">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Terlambat
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-[#B45309]">
                              <Clock className="h-3.5 w-3.5" />
                              Dipinjam
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-right text-[#2C161D]">
                          Rp {loan.fineAmount.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {loan.status !== 'dikembalikan' ? (
                            <button
                              type="button"
                              onClick={() => handleReturnLoan(loan)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#EAD6DC] bg-[#FDF8F9] px-2.5 py-1.5 text-[11px] font-semibold text-[#6B1D2F] hover:bg-[#F9EEF1]"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Proses Kembali
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#9E8089]">Selesai</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Members Directory */}
          <section className="space-y-3">
            <h2 className="font-editorial text-xl font-semibold text-[#2C161D]">
              Direktori Anggota
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[#EAD6DC] bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#F3DFE5] bg-[#FDF8F9] text-[#7D5C66]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Kode Anggota</th>
                    <th className="px-4 py-3 font-medium">Nama & Email</th>
                    <th className="px-4 py-3 font-medium text-right">Pinjaman Aktif</th>
                    <th className="px-4 py-3 font-medium text-right">Total Riwayat</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Kontrol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3DFE5]">
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#9E8089]">
                        Belum ada anggota yang mendaftar.
                      </td>
                    </tr>
                  ) : (
                    members.map((m) => (
                      <tr key={m.id} className="hover:bg-[#FDF8F9]">
                        <td className="px-4 py-3 font-mono tabular-nums text-[#7D5C66]">
                          {m.memberCode}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-[#2C161D] block">{m.name}</span>
                          <span className="text-[11px] text-[#7D5C66]">{m.email}</span>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-right text-[#2C161D]">
                          {m.activeLoanCount ?? 0}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-right text-[#7D5C66]">
                          {m.totalLoanCount ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          {m.status === 'aktif' ? (
                            <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
                              <UserCheck className="h-3.5 w-3.5" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-[#BE123C]">
                              <UserX className="h-3.5 w-3.5" />
                              Ditangguhkan
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleMemberStatus(m)}
                            className="rounded-lg border border-[#EAD6DC] px-2.5 py-1.5 text-[11px] font-semibold text-[#4E313B] hover:bg-[#F9EEF1]"
                          >
                            {m.status === 'aktif' ? 'Tangguhkan' : 'Aktifkan'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: AUTOMATED REPORTING */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#EAD6DC] bg-white p-5">
            <div>
              <h2 className="font-editorial text-xl font-semibold text-[#2C161D]">
                Sistem Pelaporan Otomatis
              </h2>
              <p className="text-xs text-[#7D5C66] mt-0.5">
                Sistem membuat rekap harian secara terjadwal setiap hari. Anda juga dapat memicu laporan baru kapan saja.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl bg-[#F9EEF1] p-1">
                {(['harian', 'mingguan', 'bulanan'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setReportPeriod(p)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      reportPeriod === p
                        ? 'bg-white text-[#6B1D2F] shadow-xs'
                        : 'text-[#7D5C66]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={generatingReport}
                onClick={handleGenerateReport}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6B1D2F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#521322] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {generatingReport ? 'Menyusun...' : 'Buat Laporan'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Report Archive List */}
            <aside className="no-print lg:col-span-4 rounded-xl border border-[#EAD6DC] bg-white p-4">
              <h3 className="font-editorial text-base font-semibold text-[#2C161D] px-2 pb-3 border-b border-[#F3DFE5]">
                Arsip Laporan Tersimpan
              </h3>
              <div className="mt-2 space-y-1.5 max-h-[460px] overflow-y-auto">
                {reports.map((rep) => {
                  const isSelected = activeReport?.id === rep.id;
                  return (
                    <button
                      key={rep.id}
                      type="button"
                      onClick={() => setSelectedReportId(rep.id)}
                      className={`w-full text-left rounded-xl p-3 transition-colors ${
                        isSelected
                          ? 'bg-[#F9EEF1] border border-[#D8B0BC]'
                          : 'hover:bg-[#FDF8F9] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#82263C]">
                        <span>{rep.reportCode}</span>
                        <span className="capitalize">{rep.triggerSource}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#2C161D]">
                        {rep.periodLabel}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[#7D5C66]">
                        {formatDateId(rep.generatedAt)} · {formatTimeId(rep.generatedAt)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Printable Report Preview */}
            <div className="lg:col-span-8 rounded-xl border border-[#EAD6DC] bg-white p-6 lg:p-8">
              {activeReport ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#EAD6DC] pb-5">
                    <div>
                      <p className="font-mono text-xs text-[#82263C]">
                        {activeReport.reportCode} · Pembuatan {activeReport.triggerSource}
                      </p>
                      <h3 className="mt-1 font-editorial text-2xl font-semibold text-[#2C161D]">
                        Laporan Sirkulasi Acelivre
                      </h3>
                      <p className="mt-1 text-xs text-[#7D5C66]">
                        {activeReport.periodLabel} · Dicatat pada{' '}
                        {formatDateId(activeReport.generatedAt)} pukul{' '}
                        {formatTimeId(activeReport.generatedAt)}
                      </p>
                    </div>

                    <div className="no-print flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownloadCsv(activeReport)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3.5 py-2 text-xs font-semibold text-[#6B1D2F] hover:bg-[#F9EEF1]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Unduh CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1D2F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#521322]"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Cetak / PDF
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-[#F3DFE5] bg-[#FDF8F9] p-3.5">
                      <span className="text-[11px] text-[#7D5C66] block">Pinjaman Periode</span>
                      <span className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#2C161D] block">
                        {activeReport.summary.totalLoansInPeriod}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#F3DFE5] bg-[#FDF8F9] p-3.5">
                      <span className="text-[11px] text-[#7D5C66] block">Pengembalian</span>
                      <span className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#15803D] block">
                        {activeReport.summary.returnedInPeriod}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#F3DFE5] bg-[#FDF8F9] p-3.5">
                      <span className="text-[11px] text-[#7D5C66] block">Terlambat</span>
                      <span className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#BE123C] block">
                        {activeReport.summary.overdueCount}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#F3DFE5] bg-[#FDF8F9] p-3.5">
                      <span className="text-[11px] text-[#7D5C66] block">Total Denda</span>
                      <span className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#6B1D2F] block">
                        Rp {activeReport.summary.totalFines.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-y border-[#F3DFE5] py-4">
                    <div>
                      <span className="text-[#7D5C66] block">Kategori Terpopuler</span>
                      <span className="mt-1 font-semibold text-[#2C161D] block">
                        {activeReport.summary.topCategory}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#7D5C66] block">Judul Paling Sering Dipinjam</span>
                      <span className="mt-1 font-semibold text-[#2C161D] block">
                        {activeReport.summary.topBookTitle}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-[#4E313B] mb-2.5">
                      Rincian Koleksi per Kategori
                    </h4>
                    <table className="w-full text-left text-xs border border-[#F3DFE5] rounded-lg overflow-hidden">
                      <thead className="bg-[#FDF8F9] text-[#7D5C66] border-b border-[#F3DFE5]">
                        <tr>
                          <th className="px-3.5 py-2.5 font-medium">Kategori</th>
                          <th className="px-3.5 py-2.5 font-medium text-right">Jumlah Judul</th>
                          <th className="px-3.5 py-2.5 font-medium text-right">Akumulasi Peminjaman</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3DFE5]">
                        {activeReport.categoryBreakdown.map((row) => (
                          <tr key={row.category}>
                            <td className="px-3.5 py-2.5 text-[#2C161D]">{row.category}</td>
                            <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#7D5C66]">
                              {row.books}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-semibold text-[#6B1D2F]">
                              {row.borrows}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="py-10 text-center text-xs text-[#9E8089]">
                  Pilih atau buat laporan untuk melihat pratinjau.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOOK CRUD MODAL */}
      {bookModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C161D]/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#EAD6DC] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#F3DFE5] pb-4">
              <h3 className="font-editorial text-xl font-semibold text-[#2C161D]">
                {editingBook ? 'Edit Koleksi Buku' : 'Tambah Koleksi Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setBookModalOpen(false)}
                className="rounded-lg p-1.5 text-[#7D5C66] hover:bg-[#F9EEF1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBook} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-[#4E313B] mb-1">Judul Buku</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={bookForm.title}
                    onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 text-sm text-[#2C161D] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">Penulis</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={bookForm.author}
                    onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 text-sm text-[#2C161D] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">ISBN</label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    value={bookForm.isbn}
                    onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                    placeholder="978-602-..."
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 font-mono text-sm text-[#2C161D] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">Kategori</label>
                  <select
                    value={bookForm.category}
                    onChange={(e) =>
                      setBookForm({ ...bookForm, category: e.target.value as BookCategory })
                    }
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 text-sm text-[#2C161D] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
                  >
                    {BOOK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">Penerbit</label>
                  <input
                    type="text"
                    value={bookForm.publisher}
                    onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })}
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 text-sm text-[#2C161D] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">Tahun Terbit</label>
                  <input
                    type="number"
                    required
                    min={1800}
                    max={2100}
                    value={bookForm.year}
                    onChange={(e) => setBookForm({ ...bookForm, year: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 font-mono text-sm text-[#2C161D] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">Lokasi Rak</label>
                  <input
                    type="text"
                    required
                    value={bookForm.shelfLocation}
                    onChange={(e) => setBookForm({ ...bookForm, shelfLocation: e.target.value })}
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 font-mono text-sm text-[#2C161D] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">Total Eksemplar</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={500}
                    value={bookForm.totalCopies}
                    onChange={(e) =>
                      setBookForm({ ...bookForm, totalCopies: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 font-mono text-sm text-[#2C161D] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">Sampul Preset</label>
                  <select
                    value={bookForm.coverUrl}
                    onChange={(e) => setBookForm({ ...bookForm, coverUrl: e.target.value })}
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 text-sm text-[#2C161D] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
                  >
                    {COVER_PRESETS.map((p) => (
                      <option key={p.url} value={p.url}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-[#4E313B] mb-1">Sinopsis Singkat</label>
                  <textarea
                    rows={3}
                    value={bookForm.synopsis}
                    onChange={(e) => setBookForm({ ...bookForm, synopsis: e.target.value })}
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 text-sm text-[#2C161D] focus:border-[#6B1D2F] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBookModalOpen(false)}
                  className="rounded-xl border border-[#EAD6DC] px-4 py-2 font-semibold text-[#4E313B] hover:bg-[#F9EEF1]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBook}
                  className="rounded-xl bg-[#6B1D2F] px-5 py-2 font-semibold text-white hover:bg-[#521322] disabled:opacity-60"
                >
                  {savingBook ? 'Menyimpan...' : 'Simpan Koleksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WALK-IN LOAN MODAL */}
      {walkInOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C161D]/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#EAD6DC] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#F3DFE5] pb-4">
              <h3 className="font-editorial text-xl font-semibold text-[#2C161D]">
                Catat Peminjaman Langsung
              </h3>
              <button
                type="button"
                onClick={() => setWalkInOpen(false)}
                className="rounded-lg p-1.5 text-[#7D5C66] hover:bg-[#F9EEF1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {members.filter((m) => m.status === 'aktif').length === 0 ? (
              <div className="mt-4 space-y-3 text-xs text-[#7D5C66]">
                <p>
                  Belum ada anggota aktif yang terdaftar. Anggota harus mendaftar terlebih dahulu melalui menu Masuk / Daftar Anggota.
                </p>
                <button
                  type="button"
                  onClick={() => setWalkInOpen(false)}
                  className="rounded-xl bg-[#6B1D2F] px-4 py-2 font-semibold text-white"
                >
                  Mengerti
                </button>
              </div>
            ) : (
              <form onSubmit={handleWalkInLoan} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">Pilih Anggota</label>
                  <select
                    required
                    value={walkInMemberId}
                    onChange={(e) => setWalkInMemberId(e.target.value)}
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 text-sm text-[#2C161D]"
                  >
                    {members
                      .filter((m) => m.status === 'aktif')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.memberCode})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">Pilih Buku Tersedia</label>
                  <select
                    required
                    value={walkInBookId}
                    onChange={(e) => setWalkInBookId(e.target.value)}
                    className="w-full rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-3 py-2 text-sm text-[#2C161D]"
                  >
                    {books
                      .filter((b) => b.availableCopies > 0)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} (Sisa {b.availableCopies})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[#4E313B] mb-1">Durasi Pinjam</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([7, 14] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setWalkInDays(d)}
                        className={`rounded-xl border py-2 text-xs font-semibold ${
                          walkInDays === d
                            ? 'border-[#6B1D2F] bg-[#F9EEF1] text-[#6B1D2F]'
                            : 'border-[#EAD6DC] text-[#7D5C66]'
                        }`}
                      >
                        {d} Hari
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWalkInOpen(false)}
                    className="rounded-xl border border-[#EAD6DC] px-4 py-2 font-semibold text-[#4E313B]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={creatingLoan}
                    className="rounded-xl bg-[#6B1D2F] px-5 py-2 font-semibold text-white hover:bg-[#521322] disabled:opacity-60"
                  >
                    {creatingLoan ? 'Memproses...' : 'Catat Pinjaman'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
