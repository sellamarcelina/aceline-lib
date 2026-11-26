import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  ActivityEvent,
  AutomatedReport,
  Book,
  BookCategory,
  CategoryStat,
  DailyTrendPoint,
  Loan,
  PublicOverview,
  UserProfile,
} from '../src/types.ts';

export interface StoredUser extends UserProfile {
  passwordHash: string;
  salt: string;
}

export interface LibraryDatabase {
  users: StoredUser[];
  books: Book[];
  loans: Loan[];
  activities: ActivityEvent[];
  reports: AutomatedReport[];
  historicalDailyCounts: Record<string, { borrows: number; returns: number }>;
}

export const FINE_PER_DAY_IDR = 2000;
export const MAX_ACTIVE_LOANS_PER_MEMBER = 5;
export const MAX_EXTENSIONS_PER_LOAN = 2;

export const VALID_CATEGORIES: BookCategory[] = [
  'Sastra & Fiksi',
  'Arsitektur & Seni',
  'Teknologi & Sains',
  'Filsafat & Sejarah',
  'Puisi & Esai',
  'Bisnis & Desain',
];

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'acelivre-db.json');

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createInitialBooks(nowIso: string): Book[] {
  return [
    {
      id: 'bk-senja-01',
      isbn: '978-602-424-812-1',
      title: 'Filosofi Senja di Taman Rose',
      author: 'Nadia Pramudita',
      publisher: 'Pustaka Narasi',
      year: 2024,
      category: 'Sastra & Fiksi',
      synopsis:
        'Novel reflektif tentang ingatan, ruang sunyi, dan perjalanan seorang kurator arsip menemukan manuskrip tua di kota pesisir.',
      coverUrl: '/src/assets/images/cover_filosofi_senja_1795661487312.jpg',
      shelfLocation: 'Rak A-01',
      totalCopies: 6,
      availableCopies: 5,
      borrowCount: 38,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-arsitektur-02',
      isbn: '978-623-102-334-8',
      title: 'Arsitektur Ruang Sunyi',
      author: 'Raka Maheswara',
      publisher: 'Studio Bentuk',
      year: 2025,
      category: 'Arsitektur & Seni',
      synopsis:
        'Kajian mendalam mengenai proporsi cahaya alami, material travertine, serta estetika ketenangan pada ruang baca kontemporer.',
      coverUrl: '/src/assets/images/cover_arsitektur_sunyi_1795661488261.jpg',
      shelfLocation: 'Rak B-04',
      totalCopies: 4,
      availableCopies: 4,
      borrowCount: 29,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-algoritma-03',
      isbn: '978-602-889-510-2',
      title: 'Sistem Terdistribusi & Desain Data',
      author: 'Dimas Wirawan',
      publisher: 'Inovasi Press',
      year: 2025,
      category: 'Teknologi & Sains',
      synopsis:
        'Panduan praktis merancang arsitektur perangkat lunak yang tangguh, konsisten, dan dapat diamati secara real-time.',
      coverUrl: '/src/assets/images/cover_algoritma_data_1795661484624.jpg',
      shelfLocation: 'Rak C-02',
      totalCopies: 5,
      availableCopies: 4,
      borrowCount: 44,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-puisi-04',
      isbn: '978-623-551-019-4',
      title: 'Antologi Surat Musim Hujan',
      author: 'Klara Kusuma',
      publisher: 'Balai Aksara',
      year: 2023,
      category: 'Puisi & Esai',
      synopsis:
        'Kumpulan puisi lirik dan esai singkat mengenai keheningan kota, secangkir teh hangat, dan ritme waktu.',
      coverUrl: '/src/assets/images/cover_antologi_puisi_1795661485987.jpg',
      shelfLocation: 'Rak A-07',
      totalCopies: 5,
      availableCopies: 5,
      borrowCount: 31,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-filsafat-05',
      isbn: '978-602-774-209-7',
      title: 'Etika Perhatian di Era Digital',
      author: 'Prof. Hendra Santoso',
      publisher: 'Wacana Nusantara',
      year: 2024,
      category: 'Filsafat & Sejarah',
      synopsis:
        'Tinjauan filosofis mengenai bagaimana teknologi informasi mengubah kapasitas fokus, memori kolektif, dan budaya membaca.',
      coverUrl: '/src/assets/images/cover_filosofi_senja_1795661487312.jpg',
      shelfLocation: 'Rak D-03',
      totalCopies: 4,
      availableCopies: 3,
      borrowCount: 22,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-desain-06',
      isbn: '978-623-901-745-0',
      title: 'Tipografi & Tata Letak Editorial',
      author: 'Sinta Maharani',
      publisher: 'Studio Bentuk',
      year: 2025,
      category: 'Bisnis & Desain',
      synopsis:
        'Prinsip grid editorial, hierarki huruf serif-sans, angka tabular, dan keseimbangan ruang putih untuk publikasi modern.',
      coverUrl: '/src/assets/images/cover_arsitektur_sunyi_1795661488261.jpg',
      shelfLocation: 'Rak B-09',
      totalCopies: 3,
      availableCopies: 3,
      borrowCount: 27,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-sastra-07',
      isbn: '978-602-312-908-6',
      title: 'Catatan dari Rumah Kaca Merah',
      author: 'Larasati Dewi',
      publisher: 'Pustaka Narasi',
      year: 2022,
      category: 'Sastra & Fiksi',
      synopsis:
        'Kisah lintas generasi tentang sebuah perpustakaan keluarga yang menyimpan surat-surat rahasia dari tahun 1960-an.',
      coverUrl: '/src/assets/images/cover_antologi_puisi_1795661485987.jpg',
      shelfLocation: 'Rak A-12',
      totalCopies: 4,
      availableCopies: 4,
      borrowCount: 19,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'bk-sains-08',
      isbn: '978-623-411-882-3',
      title: 'Visualisasi Statistik & Inferensi',
      author: 'Bima Pratama',
      publisher: 'Inovasi Press',
      year: 2024,
      category: 'Teknologi & Sains',
      synopsis:
        'Metode membaca distribusi data, mendeteksi anomali, dan menyajikan grafik analitik yang jujur dan mudah dicerna.',
      coverUrl: '/src/assets/images/cover_algoritma_data_1795661484624.jpg',
      shelfLocation: 'Rak C-08',
      totalCopies: 5,
      availableCopies: 5,
      borrowCount: 25,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

function createInitialHistoricalTrends(): Record<string, { borrows: number; returns: number }> {
  const result: Record<string, { borrows: number; returns: number }> = {};
  const baseline = [
    { borrows: 6, returns: 4 },
    { borrows: 8, returns: 5 },
    { borrows: 5, returns: 7 },
    { borrows: 11, returns: 6 },
    { borrows: 9, returns: 8 },
    { borrows: 7, returns: 9 },
    { borrows: 4, returns: 3 },
  ];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = formatDateKey(d);
    result[key] = baseline[6 - i];
  }
  return result;
}

function createEmptyDb(): LibraryDatabase {
  const nowIso = new Date().toISOString();
  return {
    users: [],
    books: createInitialBooks(nowIso),
    loans: [],
    activities: [
      {
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        type: 'koleksi_tambah',
        actorName: 'Sistem Acelivre',
        actorRole: 'sistem',
        description: 'Katalog awal perpustakaan digital Acelivre telah siap digunakan.',
        timestamp: nowIso,
      },
    ],
    reports: [],
    historicalDailyCounts: createInitialHistoricalTrends(),
  };
}

export class LibraryStore {
  private db: LibraryDatabase;

  constructor() {
    this.db = this.load();
    this.reconcileLoans();
    this.ensureDailyReport();
  }

  private load(): LibraryDatabase {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      const initial = createEmptyDb();
      this.writeAtomic(initial);
      return initial;
    }
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as LibraryDatabase;
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        books: Array.isArray(parsed.books) ? parsed.books : [],
        loans: Array.isArray(parsed.loans) ? parsed.loans : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        historicalDailyCounts: parsed.historicalDailyCounts ?? createInitialHistoricalTrends(),
      };
    } catch {
      const fallback = createEmptyDb();
      this.writeAtomic(fallback);
      return fallback;
    }
  }

  private writeAtomic(data: LibraryDatabase): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${DB_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, DB_PATH);
  }

  public save(): void {
    this.writeAtomic(this.db);
  }

  public reconcileLoans(): void {
    const now = Date.now();
    let changed = false;
    for (const loan of this.db.loans) {
      if (loan.returnedAt) {
        if (loan.status !== 'dikembalikan') {
          loan.status = 'dikembalikan';
          changed = true;
        }
        continue;
      }
      const dueMs = new Date(loan.dueAt).getTime();
      if (now > dueMs) {
        const overdueDays = Math.max(1, Math.ceil((now - dueMs) / (1000 * 60 * 60 * 24)));
        const computedFine = overdueDays * FINE_PER_DAY_IDR;
        if (loan.status !== 'terlambat' || loan.fineAmount !== computedFine) {
          loan.status = 'terlambat';
          loan.fineAmount = computedFine;
          changed = true;
        }
      } else {
        if (loan.status !== 'dipinjam' || loan.fineAmount !== 0) {
          loan.status = 'dipinjam';
          loan.fineAmount = 0;
          changed = true;
        }
      }
    }
    if (changed) {
      this.save();
    }
  }

  public hasAdmin(): boolean {
    return this.db.users.some((u) => u.role === 'admin');
  }

  public getUsers(): StoredUser[] {
    return this.db.users;
  }

  public findUserByEmail(email: string): StoredUser | undefined {
    const normalized = email.trim().toLowerCase();
    return this.db.users.find((u) => u.email.toLowerCase() === normalized);
  }

  public findUserById(id: string): StoredUser | undefined {
    return this.db.users.find((u) => u.id === id);
  }

  public toPublicUser(user: StoredUser): UserProfile {
    const userLoans = this.db.loans.filter((l) => l.userId === user.id);
    const activeLoanCount = userLoans.filter((l) => l.status !== 'dikembalikan').length;
    const totalFines = userLoans.reduce((acc, l) => acc + l.fineAmount, 0);
    return {
      id: user.id,
      memberCode: user.memberCode,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      joinedAt: user.joinedAt,
      activeLoanCount,
      totalLoanCount: userLoans.length,
      totalFines,
    };
  }

  public addUser(user: StoredUser): void {
    this.db.users.push(user);
    this.save();
  }

  public updateUserStatus(userId: string, status: 'aktif' | 'ditangguhkan'): StoredUser | null {
    const user = this.findUserById(userId);
    if (!user || user.role === 'admin') return null;
    user.status = status;
    this.save();
    return user;
  }

  public getBooks(): Book[] {
    return this.db.books;
  }

  public findBookById(id: string): Book | undefined {
    return this.db.books.find((b) => b.id === id);
  }

  public addBook(book: Book): void {
    this.db.books.unshift(book);
    this.save();
  }

  public updateBook(id: string, patch: Partial<Book>): Book | null {
    const book = this.findBookById(id);
    if (!book) return null;
    Object.assign(book, patch, { updatedAt: new Date().toISOString() });
    this.save();
    return book;
  }

  public deleteBook(id: string): Book | null {
    const idx = this.db.books.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    const [removed] = this.db.books.splice(idx, 1);
    this.save();
    return removed;
  }

  public getLoans(): Loan[] {
    this.reconcileLoans();
    return this.db.loans;
  }

  public findLoanById(id: string): Loan | undefined {
    this.reconcileLoans();
    return this.db.loans.find((l) => l.id === id);
  }

  public addLoan(loan: Loan): void {
    this.db.loans.unshift(loan);
    const dayKey = formatDateKey(new Date(loan.borrowedAt));
    if (!this.db.historicalDailyCounts[dayKey]) {
      this.db.historicalDailyCounts[dayKey] = { borrows: 0, returns: 0 };
    }
    this.db.historicalDailyCounts[dayKey].borrows += 1;
    this.save();
  }

  public recordReturn(loanId: string): Loan | null {
    this.reconcileLoans();
    const loan = this.db.loans.find((l) => l.id === loanId);
    if (!loan || loan.status === 'dikembalikan') return null;

    const now = new Date();
    const dueMs = new Date(loan.dueAt).getTime();
    if (now.getTime() > dueMs) {
      const overdueDays = Math.max(1, Math.ceil((now.getTime() - dueMs) / (1000 * 60 * 60 * 24)));
      loan.fineAmount = overdueDays * FINE_PER_DAY_IDR;
    }
    loan.returnedAt = now.toISOString();
    loan.status = 'dikembalikan';

    const book = this.findBookById(loan.bookId);
    if (book && book.availableCopies < book.totalCopies) {
      book.availableCopies += 1;
      book.updatedAt = now.toISOString();
    }

    const dayKey = formatDateKey(now);
    if (!this.db.historicalDailyCounts[dayKey]) {
      this.db.historicalDailyCounts[dayKey] = { borrows: 0, returns: 0 };
    }
    this.db.historicalDailyCounts[dayKey].returns += 1;

    this.save();
    return loan;
  }

  public extendLoan(loanId: string): Loan | null {
    this.reconcileLoans();
    const loan = this.db.loans.find((l) => l.id === loanId);
    if (!loan || loan.status !== 'dipinjam' || loan.extendedCount >= MAX_EXTENSIONS_PER_LOAN) {
      return null;
    }
    const currentDue = new Date(loan.dueAt);
    currentDue.setDate(currentDue.getDate() + 7);
    loan.dueAt = currentDue.toISOString();
    loan.extendedCount += 1;
    this.save();
    return loan;
  }

  public addActivity(
    event: Omit<ActivityEvent, 'id' | 'timestamp'>
  ): ActivityEvent {
    const entry: ActivityEvent = {
      ...event,
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
    };
    this.db.activities.unshift(entry);
    if (this.db.activities.length > 200) {
      this.db.activities = this.db.activities.slice(0, 200);
    }
    this.save();
    return entry;
  }

  public getActivities(): ActivityEvent[] {
    return this.db.activities;
  }

  public getPublicOverview(): PublicOverview {
    this.reconcileLoans();
    const totalTitles = this.db.books.length;
    const totalCopies = this.db.books.reduce((sum, b) => sum + b.totalCopies, 0);
    const availableCopies = this.db.books.reduce((sum, b) => sum + b.availableCopies, 0);
    const activeBorrowsCount = this.db.loans.filter((l) => l.status !== 'dikembalikan').length;

    const categoryMap = new Map<string, CategoryStat>();
    for (const cat of VALID_CATEGORIES) {
      categoryMap.set(cat, {
        category: cat,
        books: 0,
        totalCopies: 0,
        availableCopies: 0,
        borrows: 0,
      });
    }
    for (const book of this.db.books) {
      const entry = categoryMap.get(book.category);
      if (entry) {
        entry.books += 1;
        entry.totalCopies += book.totalCopies;
        entry.availableCopies += book.availableCopies;
        entry.borrows += book.borrowCount;
      }
    }

    const dailyTrends: DailyTrendPoint[] = [];
    const today = new Date();
    const idDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = formatDateKey(d);
      const counts = this.db.historicalDailyCounts[key] || { borrows: 0, returns: 0 };
      dailyTrends.push({
        date: key,
        label: `${idDays[d.getDay()]} ${d.getDate()}`,
        borrows: counts.borrows,
        returns: counts.returns,
      });
    }

    return {
      totalTitles,
      totalCopies,
      availableCopies,
      activeBorrowsCount,
      categories: Array.from(categoryMap.values()),
      dailyTrends,
    };
  }

  public generateReport(
    periodType: 'harian' | 'mingguan' | 'bulanan',
    triggerSource: 'otomatis' | 'manual'
  ): AutomatedReport {
    this.reconcileLoans();
    const now = new Date();
    const periodDays = periodType === 'harian' ? 1 : periodType === 'mingguan' ? 7 : 30;
    const cutoff = now.getTime() - periodDays * 24 * 60 * 60 * 1000;

    const loansInPeriod = this.db.loans.filter(
      (l) => new Date(l.borrowedAt).getTime() >= cutoff
    );
    const returnedInPeriod = this.db.loans.filter(
      (l) => l.returnedAt && new Date(l.returnedAt).getTime() >= cutoff
    ).length;
    const activeLoans = this.db.loans.filter((l) => l.status !== 'dikembalikan').length;
    const overdueCount = this.db.loans.filter((l) => l.status === 'terlambat').length;
    const totalFines = this.db.loans.reduce((sum, l) => sum + l.fineAmount, 0);

    const overview = this.getPublicOverview();
    const sortedCats = [...overview.categories].sort((a, b) => b.borrows - a.borrows);
    const sortedBooks = [...this.db.books].sort((a, b) => b.borrowCount - a.borrowCount);

    const periodLabelMap = {
      harian: `Harian · ${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      mingguan: `Mingguan · 7 Hari Terakhir (${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })})`,
      bulanan: `Bulanan · ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
    };

    const report: AutomatedReport = {
      id: `rep-${crypto.randomUUID().slice(0, 8)}`,
      reportCode: `RPT-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${String(this.db.reports.length + 1).padStart(3, '0')}`,
      periodType,
      periodLabel: periodLabelMap[periodType],
      generatedAt: now.toISOString(),
      triggerSource,
      summary: {
        totalBooks: overview.totalTitles,
        totalCopies: overview.totalCopies,
        availableCopies: overview.availableCopies,
        totalLoansInPeriod: loansInPeriod.length,
        activeLoans,
        returnedInPeriod,
        overdueCount,
        totalFines,
        topCategory: sortedCats[0]?.category || '-',
        topBookTitle: sortedBooks[0]?.title || '-',
      },
      categoryBreakdown: overview.categories.map((c) => ({
        category: c.category,
        books: c.books,
        borrows: c.borrows,
      })),
    };

    this.db.reports.unshift(report);
    if (this.db.reports.length > 50) {
      this.db.reports = this.db.reports.slice(0, 50);
    }

    this.addActivity({
      type: 'laporan_otomatis',
      actorName: triggerSource === 'otomatis' ? 'Penjadwal Acelivre' : 'Administrator',
      actorRole: triggerSource === 'otomatis' ? 'sistem' : 'admin',
      description: `Laporan ${periodType} (${report.reportCode}) dibuat secara ${triggerSource}.`,
    });

    this.save();
    return report;
  }

  public getReports(): AutomatedReport[] {
    return this.db.reports;
  }

  public findReportById(id: string): AutomatedReport | undefined {
    return this.db.reports.find((r) => r.id === id);
  }

  public ensureDailyReport(): AutomatedReport | null {
    const todayKey = formatDateKey(new Date());
    const hasTodayDaily = this.db.reports.some(
      (r) => r.periodType === 'harian' && r.generatedAt.slice(0, 10) === todayKey
    );
    if (!hasTodayDaily) {
      return this.generateReport('harian', 'otomatis');
    }
    return null;
  }
}
