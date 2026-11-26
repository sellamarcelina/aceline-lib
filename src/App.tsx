import { useCallback, useEffect, useState } from 'react';
import {
  Library,
  LayoutDashboard,
  BookOpen,
  ShieldCheck,
  LogOut,
  LogIn,
  Menu,
  X,
} from 'lucide-react';
import { CatalogView } from './components/CatalogView.tsx';
import { MemberDashboard } from './components/MemberDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import {
  apiRequest,
  useLibraryRealtime,
  type RealtimeMessage,
} from './lib/api.ts';
import type {
  ActivityEvent,
  AutomatedReport,
  Book,
  Loan,
  PublicOverview,
  UserProfile,
} from './types.ts';

type AppView = 'catalog' | 'member' | 'admin';

export default function App() {
  const [view, setView] = useState<AppView>('catalog');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth held strictly in React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'member' | 'admin'>('member');

  // Server data
  const [books, setBooks] = useState<Book[]>([]);
  const [overview, setOverview] = useState<PublicOverview | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [reports, setReports] = useState<AutomatedReport[]>([]);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 4500);
  }, []);

  const fetchCatalog = useCallback(async () => {
    try {
      const data = await apiRequest<{ books: Book[]; overview: PublicOverview }>(
        '/api/catalog'
      );
      setBooks(data.books);
      setOverview(data.overview);
    } catch {
      // handled silently on background refresh
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const fetchProtectedData = useCallback(
    async (activeToken: string, activeUser: UserProfile) => {
      try {
        const [loansRes, activitiesRes] = await Promise.all([
          apiRequest<{ loans: Loan[] }>('/api/loans', { token: activeToken }),
          apiRequest<{ activities: ActivityEvent[] }>('/api/activities', {
            token: activeToken,
          }),
        ]);
        setLoans(loansRes.loans);
        setActivities(activitiesRes.activities);

        if (activeUser.role === 'admin') {
          const [membersRes, reportsRes] = await Promise.all([
            apiRequest<{ members: UserProfile[] }>('/api/members', {
              token: activeToken,
            }),
            apiRequest<{ reports: AutomatedReport[]; overview: PublicOverview }>(
              '/api/reports',
              { token: activeToken }
            ),
          ]);
          setMembers(membersRes.members);
          setReports(reportsRes.reports);
          setOverview(reportsRes.overview);
        }
      } catch {
        // ignore transient auth refresh error
      }
    },
    []
  );

  const refreshAll = useCallback(() => {
    void fetchCatalog();
    if (token && user) {
      void fetchProtectedData(token, user);
    }
  }, [fetchCatalog, fetchProtectedData, token, user]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    if (token && user) {
      void fetchProtectedData(token, user);
    } else {
      setLoans([]);
      setMembers([]);
      setActivities([]);
      setReports([]);
    }
  }, [token, user, fetchProtectedData]);

  const handleRealtimeEvent = useCallback(
    (msg: RealtimeMessage) => {
      if (msg.event === 'catalog:updated') {
        void fetchCatalog();
      }
      if (token && user) {
        if (
          msg.event === 'loan:updated' ||
          msg.event === 'activity:new' ||
          msg.event === 'report:generated' ||
          msg.event === 'member:registered' ||
          msg.event === 'member:updated'
        ) {
          void fetchProtectedData(token, user);
        }
      }
    },
    [fetchCatalog, fetchProtectedData, token, user]
  );

  const realtimeStatus = useLibraryRealtime(token, handleRealtimeEvent);

  function openAuth(tab: 'member' | 'admin' = 'member') {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }

  function handleAuthenticated(newToken: string, newUser: UserProfile) {
    setToken(newToken);
    setUser(newUser);
    if (newUser.role === 'admin') {
      setView('admin');
      showToast(`Selamat datang di Portal Admin, ${newUser.name}.`);
    } else {
      setView('member');
      showToast(`Masuk sebagai ${newUser.name} (${newUser.memberCode}).`);
    }
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    setView('catalog');
    showToast('Anda telah keluar dari sesi Acelivre.');
  }

  function handleNavigate(target: AppView) {
    setMobileMenuOpen(false);
    if (target === 'member' && !user) {
      openAuth('member');
      return;
    }
    if (target === 'admin' && user?.role !== 'admin') {
      openAuth('admin');
      return;
    }
    setView(target);
  }

  const navItems: { id: AppView; label: string; icon: typeof BookOpen }[] = [
    { id: 'catalog', label: 'Katalog Koleksi', icon: BookOpen },
    { id: 'member', label: 'Dasbor Anggota', icon: LayoutDashboard },
    { id: 'admin', label: 'Dasbor Admin', icon: ShieldCheck },
  ];

  const viewTitle =
    view === 'catalog'
      ? 'Katalog Perpustakaan'
      : view === 'member'
      ? 'Dasbor Anggota'
      : 'Dasbor Administrator';

  return (
    <div className="min-h-screen bg-[#FDF8F9] text-[#2C161D] flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden md:flex md:w-[252px] md:flex-col md:fixed md:inset-y-0 border-r border-[#EAD6DC] bg-white px-5 py-6 justify-between">
        <div>
          <button
            type="button"
            onClick={() => handleNavigate('catalog')}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6B1D2F] text-white">
              <Library className="h-4.5 w-4.5" />
            </span>
            <span className="font-editorial text-2xl font-semibold tracking-tight text-[#2C161D]">
              acelivre
            </span>
          </button>

          <nav className="mt-8 space-y-1" aria-label="Navigasi utama">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#F9EEF1] text-[#6B1D2F] font-semibold'
                      : 'text-[#4E313B] hover:bg-[#FDF8F9] hover:text-[#2C161D]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#F3DFE5] pt-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-[#7D5C66]">
            <span>Sinkronisasi Live</span>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <span
                className={`h-2 w-2 rounded-full ${
                  realtimeStatus === 'connected'
                    ? 'bg-[#16A34A]'
                    : realtimeStatus === 'connecting'
                    ? 'bg-[#D97706]'
                    : 'bg-[#BE123C]'
                }`}
              />
              {realtimeStatus === 'connected' ? 'Aktif' : 'Menghubungkan'}
            </span>
          </div>

          {user ? (
            <div className="rounded-xl border border-[#EAD6DC] bg-[#FDF8F9] p-3">
              <p className="text-xs font-semibold text-[#2C161D] truncate">
                {user.name}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-[#82263C]">
                {user.role === 'admin' ? 'Administrator' : user.memberCode}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#7D5C66] hover:text-[#BE123C]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Keluar Sesi
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuth('member')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6B1D2F] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#521322]"
            >
              <LogIn className="h-3.5 w-3.5" />
              Masuk / Daftar
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Slide-Over Navigation */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-[#2C161D]/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex w-72 flex-col justify-between bg-white p-6 border-r border-[#EAD6DC]">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-editorial text-2xl font-semibold text-[#2C161D]">
                  acelivre
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-1.5 text-[#7D5C66]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-6 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = view === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                        isActive
                          ? 'bg-[#F9EEF1] text-[#6B1D2F] font-semibold'
                          : 'text-[#4E313B]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-xl border border-[#EAD6DC] px-4 py-2.5 text-xs font-semibold text-[#BE123C]"
              >
                <LogOut className="h-4 w-4" />
                Keluar ({user.name})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuth('member');
                }}
                className="rounded-xl bg-[#6B1D2F] px-4 py-2.5 text-xs font-semibold text-white"
              >
                Masuk / Daftar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:pl-[252px] flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left — Single primary CTA on right */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-6 border-b border-[#EAD6DC] bg-[#FDF8F9]/95 px-5 lg:px-10 py-3.5 backdrop-blur-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden rounded-lg p-2 text-[#4E313B] hover:bg-[#F9EEF1]"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-[#7D5C66] truncate">
              <span className="font-editorial text-sm font-semibold text-[#2C161D] md:hidden">
                acelivre
              </span>
              <span className="hidden md:inline">acelivre</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-[#2C161D] truncate">{viewTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() =>
                  handleNavigate(user.role === 'admin' ? 'admin' : 'member')
                }
                className="rounded-xl border border-[#EAD6DC] bg-white px-4 py-2 text-xs font-semibold text-[#6B1D2F] hover:bg-[#F9EEF1] whitespace-nowrap shrink-0"
              >
                {user.role === 'admin' ? 'Portal Admin' : 'Dasbor Saya'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('member')}
                className="rounded-xl bg-[#6B1D2F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#521322] whitespace-nowrap shrink-0"
              >
                Masuk Akun
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 px-5 lg:px-10 py-8 max-w-[1280px] w-full mx-auto">
          {view === 'catalog' && (
            <CatalogView
              books={books}
              overview={overview}
              user={user}
              token={token}
              loading={loadingCatalog}
              onOpenAuth={openAuth}
              onBorrowSuccess={(title) => {
                showToast(`Berhasil meminjam "${title}".`);
                refreshAll();
              }}
            />
          )}

          {view === 'member' && user && token && (
            <MemberDashboard
              user={user}
              token={token}
              loans={loans}
              activities={activities}
              onRefresh={refreshAll}
              onGoToCatalog={() => setView('catalog')}
            />
          )}

          {view === 'admin' && user?.role === 'admin' && token && (
            <AdminDashboard
              token={token}
              books={books}
              overview={overview}
              loans={loans}
              members={members}
              activities={activities}
              reports={reports}
              realtimeStatus={realtimeStatus}
              onRefreshAll={refreshAll}
            />
          )}
        </main>

        <footer className="no-print border-t border-[#EAD6DC] px-5 lg:px-10 py-5 text-xs text-[#7D5C66]">
          <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>acelivre · Perpustakaan Digital Minimalis</span>
            <span>Sirkulasi Real-Time & Pelaporan Otomatis</span>
          </div>
        </footer>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="no-print fixed bottom-5 right-5 z-50 rounded-xl border border-[#82263C] bg-[#6B1D2F] px-4 py-3 text-xs font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialTab={authModalTab}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}
