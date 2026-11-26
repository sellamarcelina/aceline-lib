export type BookCategory =
  | 'Sastra & Fiksi'
  | 'Arsitektur & Seni'
  | 'Teknologi & Sains'
  | 'Filsafat & Sejarah'
  | 'Puisi & Esai'
  | 'Bisnis & Desain';

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  year: number;
  category: BookCategory;
  synopsis: string;
  coverUrl: string;
  shelfLocation: string;
  totalCopies: number;
  availableCopies: number;
  borrowCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  memberCode: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  status: 'aktif' | 'ditangguhkan';
  joinedAt: string;
  activeLoanCount?: number;
  totalLoanCount?: number;
  totalFines?: number;
}

export interface Loan {
  id: string;
  loanCode: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCoverUrl: string;
  bookCategory: BookCategory;
  userId: string;
  memberName: string;
  memberCode: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  extendedCount: number;
  status: 'dipinjam' | 'dikembalikan' | 'terlambat';
  fineAmount: number;
}

export type ActivityType =
  | 'pinjam'
  | 'kembali'
  | 'perpanjang'
  | 'koleksi_tambah'
  | 'koleksi_ubah'
  | 'koleksi_hapus'
  | 'laporan_otomatis'
  | 'anggota_baru';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  actorName: string;
  actorRole: 'admin' | 'member' | 'sistem';
  description: string;
  bookTitle?: string;
  loanCode?: string;
  timestamp: string;
}

export interface DailyTrendPoint {
  date: string;
  label: string;
  borrows: number;
  returns: number;
}

export interface CategoryStat {
  category: string;
  books: number;
  totalCopies: number;
  availableCopies: number;
  borrows: number;
}

export interface AutomatedReport {
  id: string;
  reportCode: string;
  periodType: 'harian' | 'mingguan' | 'bulanan';
  periodLabel: string;
  generatedAt: string;
  triggerSource: 'otomatis' | 'manual';
  summary: {
    totalBooks: number;
    totalCopies: number;
    availableCopies: number;
    totalLoansInPeriod: number;
    activeLoans: number;
    returnedInPeriod: number;
    overdueCount: number;
    totalFines: number;
    topCategory: string;
    topBookTitle: string;
  };
  categoryBreakdown: {
    category: string;
    books: number;
    borrows: number;
  }[];
}

export interface AuthStatus {
  adminClaimed: boolean;
  usesEnvPasscode: boolean;
}

export interface PublicOverview {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  activeBorrowsCount: number;
  categories: CategoryStat[];
  dailyTrends: DailyTrendPoint[];
}
