import { useMemo, useState } from 'react';
import {
  Search,
  BookOpen,
  CheckCircle2,
  XCircle,
  X,
  ArrowRight,
  MapPin,
  Calendar,
} from 'lucide-react';
import { BookCover } from './BookCover.tsx';
import { apiRequest, ApiError } from '../lib/api.ts';
import type { Book, BookCategory, PublicOverview, UserProfile } from '../types.ts';

interface CatalogViewProps {
  books: Book[];
  overview: PublicOverview | null;
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  onOpenAuth: (tab?: 'member' | 'admin') => void;
  onBorrowSuccess: (bookTitle: string) => void;
}

const CATEGORIES: ('Semua' | BookCategory)[] = [
  'Semua',
  'Sastra & Fiksi',
  'Arsitektur & Seni',
  'Teknologi & Sains',
  'Filsafat & Sejarah',
  'Puisi & Esai',
  'Bisnis & Desain',
];

export function CatalogView({
  books,
  overview,
  user,
  token,
  loading,
  onOpenAuth,
  onBorrowSuccess,
}: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | BookCategory>('Semua');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available'>('all');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [durationDays, setDurationDays] = useState<7 | 14>(7);
  const [borrowing, setBorrowing] = useState(false);
  const [borrowError, setBorrowError] = useState<string | null>(null);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books.filter((b) => {
      if (selectedCategory !== 'Semua' && b.category !== selectedCategory) return false;
      if (availabilityFilter === 'available' && b.availableCopies <= 0) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.shelfLocation.toLowerCase().includes(q)
      );
    });
  }, [books, search, selectedCategory, availabilityFilter]);

  async function handleBorrow(book: Book) {
    if (!token || !user) {
      setSelectedBook(null);
      onOpenAuth('member');
      return;
    }
    setBorrowing(true);
    setBorrowError(null);
    try {
      await apiRequest('/api/loans', {
        method: 'POST',
        token,
        body: { bookId: book.id, durationDays },
      });
      setSelectedBook(null);
      onBorrowSuccess(book.title);
    } catch (err) {
      if (err instanceof ApiError) {
        setBorrowError(err.message);
      } else {
        setBorrowError('Gagal memproses peminjaman buku.');
      }
    } finally {
      setBorrowing(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Editorial Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-[#EAD6DC] bg-white p-7 lg:p-9">
          <div className="space-y-4">
            <p className="text-xs font-medium tracking-wide text-[#82263C]">
              Perpustakaan Digital & Sirkulasi Real-Time
            </p>
            <h1 className="font-editorial text-3xl sm:text-4xl font-semibold leading-tight text-[#2C161D] [text-wrap:balance]">
              Ruang baca kuratorial dengan pencatatan peminjaman otomatis.
            </h1>
            <p className="max-w-xl text-sm sm:text-base leading-relaxed text-[#7D5C66]">
              Jelajahi koleksi literatur pilihan di Acelivre, pantau ketersediaan eksemplar secara langsung, dan kelola riwayat baca Anda tanpa antrean.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#katalog-koleksi"
              className="inline-flex items-center gap-2 rounded-xl bg-[#6B1D2F] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#521322] whitespace-nowrap shrink-0"
            >
              Jelajahi Koleksi
              <ArrowRight className="h-4 w-4" />
            </a>
            {!user && (
              <button
                type="button"
                onClick={() => onOpenAuth('member')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] px-5 py-2.5 text-sm font-semibold text-[#6B1D2F] transition-colors hover:bg-[#F9EEF1] whitespace-nowrap shrink-0"
              >
                Masuk / Daftar Anggota
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 overflow-hidden rounded-2xl border border-[#EAD6DC] bg-[#F9EEF1] min-h-[240px]">
          <img
            src="/src/assets/images/hero_acelivre_reading_1795661491467.jpg"
            alt="Sudut baca minimalis Acelivre bernuansa soft pink dan maroon"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
          <p className="text-xs text-[#7D5C66]">Judul Koleksi</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#2C161D]">
            {overview?.totalTitles ?? books.length}
          </p>
        </div>
        <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
          <p className="text-xs text-[#7D5C66]">Total Eksemplar</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#2C161D]">
            {overview?.totalCopies ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
          <p className="text-xs text-[#7D5C66]">Siap Dipinjam</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#15803D]">
            {overview?.availableCopies ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-[#EAD6DC] bg-white px-5 py-4">
          <p className="text-xs text-[#7D5C66]">Sirkulasi Aktif</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#6B1D2F]">
            {overview?.activeBorrowsCount ?? 0}
          </p>
        </div>
      </section>

      {/* Catalog Controls & Grid */}
      <section id="katalog-koleksi" className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#EAD6DC] pb-4">
          <div>
            <h2 className="font-editorial text-2xl font-semibold text-[#2C161D]">
              Katalog Koleksi
            </h2>
            <p className="text-xs text-[#7D5C66] mt-0.5 tabular-nums">
              Menampilkan {filteredBooks.length} dari {books.length} judul terkurasi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9E8089]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul, penulis, ISBN..."
                className="w-full rounded-xl border border-[#EAD6DC] bg-white pl-9 pr-3.5 py-2 text-sm text-[#2C161D] placeholder:text-[#9E8089] focus:border-[#6B1D2F] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-[#F9EEF1] p-1">
              <button
                type="button"
                onClick={() => setAvailabilityFilter('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  availabilityFilter === 'all'
                    ? 'bg-white text-[#6B1D2F] shadow-xs'
                    : 'text-[#7D5C66] hover:text-[#2C161D]'
                }`}
              >
                Semua Stok
              </button>
              <button
                type="button"
                onClick={() => setAvailabilityFilter('available')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  availabilityFilter === 'available'
                    ? 'bg-white text-[#6B1D2F] shadow-xs'
                    : 'text-[#7D5C66] hover:text-[#2C161D]'
                }`}
              >
                Tersedia Saja
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'bg-[#6B1D2F] text-white'
                  : 'border border-[#EAD6DC] bg-white text-[#4E313B] hover:bg-[#F9EEF1]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Book Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[380px] rounded-xl border border-[#EAD6DC] bg-white p-4 animate-pulse"
              >
                <div className="aspect-[3/4] w-full rounded-lg bg-[#F9EEF1]" />
                <div className="mt-4 h-4 w-3/4 rounded bg-[#F9EEF1]" />
                <div className="mt-2 h-3 w-1/2 rounded bg-[#F9EEF1]" />
              </div>
            ))}
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="rounded-2xl border border-[#EAD6DC] bg-white p-12 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-[#9E8089]" strokeWidth={1.5} />
            <p className="mt-3 font-editorial text-lg font-medium text-[#2C161D]">
              Tidak ada koleksi yang sesuai
            </p>
            <p className="mt-1 text-sm text-[#7D5C66]">
              Coba ubah kata kunci pencarian atau pilih kategori lain.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('Semua');
                setAvailabilityFilter('all');
              }}
              className="mt-4 rounded-xl border border-[#EAD6DC] px-4 py-2 text-xs font-semibold text-[#6B1D2F] hover:bg-[#F9EEF1]"
            >
              Atur Ulang Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredBooks.map((book) => {
              const isAvailable = book.availableCopies > 0;
              return (
                <article
                  key={book.id}
                  onClick={() => {
                    setBorrowError(null);
                    setSelectedBook(book);
                  }}
                  className="group flex flex-col justify-between rounded-xl border border-[#EAD6DC] bg-white p-4 transition-colors hover:border-[#D8B0BC] cursor-pointer"
                >
                  <div>
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-[#F9EEF1]">
                      <BookCover
                        src={book.coverUrl}
                        title={book.title}
                        className="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>

                    <div className="mt-3.5 flex items-center gap-1.5 text-[11px] text-[#7D5C66]">
                      <span className="truncate">{book.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums shrink-0">{book.year}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono shrink-0">{book.shelfLocation}</span>
                    </div>

                    <h3 className="mt-1.5 font-editorial text-base font-semibold leading-snug text-[#2C161D] line-clamp-2 group-hover:text-[#6B1D2F] transition-colors">
                      {book.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#7D5C66] truncate">
                      {book.author}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#F3DFE5] pt-3 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${
                        isAvailable ? 'text-[#15803D]' : 'text-[#BE123C]'
                      }`}
                    >
                      {isAvailable ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {isAvailable
                        ? `${book.availableCopies} dari ${book.totalCopies} tersedia`
                        : 'Sedang dipinjam semua'}
                    </span>

                    <span className="font-semibold text-[#6B1D2F] whitespace-nowrap">
                      Detail
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Book Detail & Borrow Modal */}
      {selectedBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C161D]/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-detail-title"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#EAD6DC] bg-white shadow-xl">
            <div className="grid grid-cols-1 sm:grid-cols-12">
              <div className="sm:col-span-5 bg-[#F9EEF1] p-6 flex items-center justify-center">
                <div className="aspect-[3/4] w-44 sm:w-full overflow-hidden rounded-xl border border-[#EAD6DC] bg-white">
                  <BookCover
                    src={selectedBook.coverUrl}
                    title={selectedBook.title}
                    className="h-full w-full"
                  />
                </div>
              </div>

              <div className="sm:col-span-7 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-[#7D5C66]">
                      {selectedBook.category} · {selectedBook.year}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedBook(null)}
                      className="rounded-lg p-1.5 text-[#7D5C66] hover:bg-[#F9EEF1] hover:text-[#2C161D]"
                      aria-label="Tutup detail buku"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <h3
                    id="book-detail-title"
                    className="mt-2 font-editorial text-2xl font-semibold text-[#2C161D]"
                  >
                    {selectedBook.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-[#6B1D2F]">
                    {selectedBook.author}
                  </p>

                  <p className="mt-4 text-sm leading-relaxed text-[#4E313B]">
                    {selectedBook.synopsis}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 border-y border-[#F3DFE5] py-3 text-xs">
                    <div>
                      <span className="text-[#9E8089] block">ISBN</span>
                      <span className="font-mono tabular-nums text-[#2C161D]">
                        {selectedBook.isbn}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#9E8089] block">Penerbit</span>
                      <span className="text-[#2C161D]">{selectedBook.publisher}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#4E313B]">
                      <MapPin className="h-3.5 w-3.5 text-[#82263C]" />
                      <span className="font-mono">{selectedBook.shelfLocation}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#4E313B] tabular-nums">
                      <BookOpen className="h-3.5 w-3.5 text-[#82263C]" />
                      <span>
                        Tersedia {selectedBook.availableCopies}/{selectedBook.totalCopies}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {borrowError && (
                    <p className="rounded-xl border border-[#F5C2CE] bg-[#FFF1F4] px-3 py-2 text-xs text-[#9F1239]">
                      {borrowError}
                    </p>
                  )}

                  {selectedBook.availableCopies > 0 ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4E313B]">
                          <Calendar className="h-3.5 w-3.5 text-[#6B1D2F]" />
                          Durasi Peminjaman
                        </span>
                        <div className="flex items-center gap-1 rounded-lg bg-[#F9EEF1] p-1">
                          <button
                            type="button"
                            onClick={() => setDurationDays(7)}
                            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                              durationDays === 7
                                ? 'bg-white text-[#6B1D2F] shadow-xs'
                                : 'text-[#7D5C66]'
                            }`}
                          >
                            7 Hari
                          </button>
                          <button
                            type="button"
                            onClick={() => setDurationDays(14)}
                            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                              durationDays === 14
                                ? 'bg-white text-[#6B1D2F] shadow-xs'
                                : 'text-[#7D5C66]'
                            }`}
                          >
                            14 Hari
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={borrowing}
                        onClick={() => handleBorrow(selectedBook)}
                        className="w-full rounded-xl bg-[#6B1D2F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#521322] disabled:opacity-60"
                      >
                        {borrowing
                          ? 'Memproses Peminjaman...'
                          : user
                          ? `Pinjam Buku (${durationDays} Hari)`
                          : 'Masuk untuk Meminjam'}
                      </button>
                    </>
                  ) : (
                    <div className="rounded-xl border border-[#F5C2CE] bg-[#FFF1F4] px-4 py-2.5 text-center text-xs font-medium text-[#9F1239]">
                      Semua eksemplar buku ini sedang dipinjam. Silakan periksa kembali nanti.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
