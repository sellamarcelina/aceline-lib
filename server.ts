import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  LibraryStore,
  MAX_ACTIVE_LOANS_PER_MEMBER,
  MAX_EXTENSIONS_PER_LOAN,
  VALID_CATEGORIES,
  type StoredUser,
} from './server/store.ts';
import type { BookCategory, Loan } from './src/types.ts';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ENV_ADMIN_PASSCODE = (process.env.ADMIN_PASSCODE || '').trim();

const store = new LibraryStore();

interface TokenPayload {
  uid: string;
  role: 'admin' | 'member';
  exp: number;
}

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

interface ClientSocket extends WebSocket {
  clientRole?: 'admin' | 'member' | 'guest';
  clientUserId?: string;
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function verifyEnvPasscode(candidate: string, expected: string): boolean {
  const h1 = crypto.createHash('sha256').update(candidate).digest();
  const h2 = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(h1, h2);
}

function signToken(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest();
  let actualSig: Buffer;
  try {
    actualSig = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as TokenPayload;
    if (!parsed.uid || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesi otentikasi diperlukan. Silakan masuk terlebih dahulu.' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Token sesi tidak valid atau telah kedaluwarsa.' });
    return;
  }
  const user = store.findUserById(payload.uid);
  if (!user) {
    res.status(401).json({ error: 'Akun pengguna tidak ditemukan.' });
    return;
  }
  if (user.status === 'ditangguhkan') {
    res.status(403).json({ error: 'Akun keanggotaan Anda sedang ditangguhkan oleh admin.' });
    return;
  }
  req.authUser = user;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.authUser?.role !== 'admin') {
      res.status(403).json({ error: 'Akses ditolak. Hanya administrator yang diizinkan.' });
      return;
    }
    next();
  });
}

function sanitizeCsvCell(val: string | number): string {
  const str = String(val);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function isValidImagePathOrUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/src/assets/images/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket: ClientSocket) => {
    socket.clientRole = 'guest';
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; token?: string };
        if (msg.type === 'auth') {
          if (!msg.token) {
            socket.clientRole = 'guest';
            socket.clientUserId = undefined;
            return;
          }
          const payload = verifyToken(msg.token);
          if (payload) {
            const user = store.findUserById(payload.uid);
            if (user && user.status === 'aktif') {
              socket.clientRole = user.role;
              socket.clientUserId = user.id;
            }
          }
        }
      } catch {
        // Ignore malformed client WS messages
      }
    });
  });

  function broadcastEvent(
    eventName: string,
    options?: {
      targetUserId?: string;
      adminOnly?: boolean;
      payload?: unknown;
    }
  ) {
    const message = JSON.stringify({
      event: eventName,
      payload: options?.payload ?? null,
      timestamp: new Date().toISOString(),
    });
    for (const client of wss.clients) {
      const ws = client as ClientSocket;
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (options?.adminOnly) {
        if (ws.clientRole === 'admin') ws.send(message);
        continue;
      }
      if (options?.targetUserId) {
        if (ws.clientRole === 'admin' || ws.clientUserId === options.targetUserId) {
          ws.send(message);
        }
        continue;
      }
      ws.send(message);
    }
  }

  // Schedule automatic daily report every 6 hours
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    const created = store.ensureDailyReport();
    if (created) {
      broadcastEvent('report:generated', { adminOnly: true, payload: created });
      broadcastEvent('activity:new', { adminOnly: true });
    }
  }, SIX_HOURS_MS);

  // --- AUTH ROUTES ---
  app.get('/api/auth/status', (_req, res) => {
    res.json({
      adminClaimed: store.hasAdmin(),
      usesEnvPasscode: ENV_ADMIN_PASSCODE.length > 0,
    });
  });

  app.post('/api/auth/admin-claim', (req, res) => {
    if (ENV_ADMIN_PASSCODE.length > 0 || store.hasAdmin()) {
      res.status(409).json({ error: 'Akun administrator sudah diklaim atau dikonfigurasi.' });
      return;
    }
    const { name, email, password } = req.body as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      name.trim().length < 2 ||
      !email.includes('@') ||
      password.length < 8
    ) {
      res.status(400).json({
        error: 'Nama (min 2 karakter), email valid, dan kata sandi (min 8 karakter) wajib diisi.',
      });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (store.findUserByEmail(cleanEmail)) {
      res.status(409).json({ error: 'Email sudah terdaftar.' });
      return;
    }
    const { hash, salt } = hashPassword(password);
    const nowIso = new Date().toISOString();
    const adminUser: StoredUser = {
      id: `usr-adm-${crypto.randomUUID().slice(0, 8)}`,
      memberCode: 'ADM-001',
      name: name.trim().slice(0, 80),
      email: cleanEmail,
      role: 'admin',
      status: 'aktif',
      joinedAt: nowIso,
      passwordHash: hash,
      salt,
    };
    store.addUser(adminUser);
    const token = signToken({
      uid: adminUser.id,
      role: 'admin',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ token, user: store.toPublicUser(adminUser) });
  });

  app.post('/api/auth/admin-login', (req, res) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (typeof password !== 'string' || password.length === 0) {
      res.status(400).json({ error: 'Kata sandi administrator diperlukan.' });
      return;
    }

    if (ENV_ADMIN_PASSCODE.length > 0) {
      if (!verifyEnvPasscode(password, ENV_ADMIN_PASSCODE)) {
        res.status(401).json({ error: 'Passcode administrator tidak sesuai.' });
        return;
      }
      let adminUser = store.getUsers().find((u) => u.role === 'admin');
      if (!adminUser) {
        const cleanEmail =
          typeof email === 'string' && email.includes('@')
            ? email.trim().toLowerCase()
            : 'admin@acelivre.id';
        const { hash, salt } = hashPassword(crypto.randomBytes(16).toString('hex'));
        adminUser = {
          id: `usr-adm-${crypto.randomUUID().slice(0, 8)}`,
          memberCode: 'ADM-001',
          name: 'Administrator Acelivre',
          email: cleanEmail,
          role: 'admin',
          status: 'aktif',
          joinedAt: new Date().toISOString(),
          passwordHash: hash,
          salt,
        };
        store.addUser(adminUser);
      }
      const token = signToken({
        uid: adminUser.id,
        role: 'admin',
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ token, user: store.toPublicUser(adminUser) });
      return;
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Email administrator tidak valid.' });
      return;
    }
    const adminUser = store.findUserByEmail(email);
    if (!adminUser || adminUser.role !== 'admin') {
      res.status(401).json({ error: 'Email atau kata sandi administrator salah.' });
      return;
    }
    if (!verifyPassword(password, adminUser.salt, adminUser.passwordHash)) {
      res.status(401).json({ error: 'Email atau kata sandi administrator salah.' });
      return;
    }
    const token = signToken({
      uid: adminUser.id,
      role: 'admin',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ token, user: store.toPublicUser(adminUser) });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      name.trim().length < 2 ||
      !email.includes('@') ||
      password.length < 6
    ) {
      res.status(400).json({
        error: 'Nama (min 2 karakter), email valid, dan kata sandi (min 6 karakter) wajib diisi.',
      });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (store.findUserByEmail(cleanEmail)) {
      res.status(409).json({ error: 'Email sudah terdaftar. Silakan masuk.' });
      return;
    }
    const { hash, salt } = hashPassword(password);
    const memberCount = store.getUsers().filter((u) => u.role === 'member').length + 1;
    const memberCode = `ACL-2026-${String(memberCount).padStart(3, '0')}`;
    const newUser: StoredUser = {
      id: `usr-mem-${crypto.randomUUID().slice(0, 8)}`,
      memberCode,
      name: name.trim().slice(0, 80),
      email: cleanEmail,
      role: 'member',
      status: 'aktif',
      joinedAt: new Date().toISOString(),
      passwordHash: hash,
      salt,
    };
    store.addUser(newUser);
    store.addActivity({
      type: 'anggota_baru',
      actorName: newUser.name,
      actorRole: 'member',
      description: `Anggota baru ${newUser.name} (${memberCode}) bergabung ke perpustakaan.`,
    });
    broadcastEvent('member:registered', { adminOnly: true });
    broadcastEvent('activity:new', { adminOnly: true });

    const token = signToken({
      uid: newUser.id,
      role: 'member',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ token, user: store.toPublicUser(newUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }
    const user = store.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Email atau kata sandi salah.' });
      return;
    }
    if (user.role === 'admin' && ENV_ADMIN_PASSCODE.length > 0) {
      if (!verifyEnvPasscode(password, ENV_ADMIN_PASSCODE)) {
        res.status(401).json({ error: 'Email atau kata sandi salah.' });
        return;
      }
    } else if (!verifyPassword(password, user.salt, user.passwordHash)) {
      res.status(401).json({ error: 'Email atau kata sandi salah.' });
      return;
    }
    if (user.status === 'ditangguhkan') {
      res.status(403).json({ error: 'Akun keanggotaan Anda sedang ditangguhkan.' });
      return;
    }
    const token = signToken({
      uid: user.id,
      role: user.role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ token, user: store.toPublicUser(user) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: store.toPublicUser(req.authUser!) });
  });

  // --- PUBLIC CATALOG & OVERVIEW ---
  app.get('/api/catalog', (_req, res) => {
    res.json({
      books: store.getBooks(),
      overview: store.getPublicOverview(),
    });
  });

  // --- ADMIN COLLECTION MANAGEMENT ---
  app.post('/api/books', requireAdmin, (req: AuthedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const author = typeof body.author === 'string' ? body.author.trim() : '';
    const isbn = typeof body.isbn === 'string' ? body.isbn.trim() : '';
    const publisher = typeof body.publisher === 'string' ? body.publisher.trim() : 'Pustaka Acelivre';
    const synopsis = typeof body.synopsis === 'string' ? body.synopsis.trim() : '';
    const shelfLocation = typeof body.shelfLocation === 'string' ? body.shelfLocation.trim() : 'Rak A-01';
    const category = body.category as BookCategory;
    const year = Number(body.year);
    const totalCopies = Number(body.totalCopies);
    const coverUrl =
      typeof body.coverUrl === 'string' && body.coverUrl.trim()
        ? body.coverUrl.trim()
        : '/src/assets/images/cover_filosofi_senja_1795661487312.jpg';

    if (
      title.length < 2 ||
      author.length < 2 ||
      isbn.length < 5 ||
      !VALID_CATEGORIES.includes(category) ||
      !Number.isInteger(year) ||
      year < 1800 ||
      year > 2100 ||
      !Number.isInteger(totalCopies) ||
      totalCopies < 1 ||
      totalCopies > 500 ||
      !isValidImagePathOrUrl(coverUrl)
    ) {
      res.status(400).json({ error: 'Data buku tidak valid. Periksa judul, penulis, ISBN, kategori, tahun, dan stok.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const newBook = {
      id: `bk-${crypto.randomUUID().slice(0, 8)}`,
      isbn: isbn.slice(0, 40),
      title: title.slice(0, 140),
      author: author.slice(0, 100),
      publisher: publisher.slice(0, 100),
      year,
      category,
      synopsis: synopsis.slice(0, 800) || 'Koleksi buku digital dan fisik perpustakaan Acelivre.',
      coverUrl,
      shelfLocation: shelfLocation.slice(0, 40),
      totalCopies,
      availableCopies: totalCopies,
      borrowCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.addBook(newBook);
    store.addActivity({
      type: 'koleksi_tambah',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      description: `Menambahkan koleksi baru "${newBook.title}" (${newBook.totalCopies} eksemplar).`,
      bookTitle: newBook.title,
    });
    broadcastEvent('catalog:updated', { payload: { action: 'create', book: newBook } });
    broadcastEvent('activity:new');
    res.status(201).json({ book: newBook });
  });

  app.put('/api/books/:id', requireAdmin, (req: AuthedRequest, res) => {
    const existing = store.findBookById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : existing.title;
    const author = typeof body.author === 'string' ? body.author.trim() : existing.author;
    const isbn = typeof body.isbn === 'string' ? body.isbn.trim() : existing.isbn;
    const publisher = typeof body.publisher === 'string' ? body.publisher.trim() : existing.publisher;
    const synopsis = typeof body.synopsis === 'string' ? body.synopsis.trim() : existing.synopsis;
    const shelfLocation =
      typeof body.shelfLocation === 'string' ? body.shelfLocation.trim() : existing.shelfLocation;
    const category = VALID_CATEGORIES.includes(body.category as BookCategory)
      ? (body.category as BookCategory)
      : existing.category;
    const year = body.year !== undefined ? Number(body.year) : existing.year;
    const totalCopies =
      body.totalCopies !== undefined ? Number(body.totalCopies) : existing.totalCopies;
    const coverUrl =
      typeof body.coverUrl === 'string' && body.coverUrl.trim()
        ? body.coverUrl.trim()
        : existing.coverUrl;

    const activeLoanedCount = existing.totalCopies - existing.availableCopies;
    if (
      title.length < 2 ||
      author.length < 2 ||
      !Number.isInteger(year) ||
      year < 1800 ||
      year > 2100 ||
      !Number.isInteger(totalCopies) ||
      totalCopies < activeLoanedCount ||
      totalCopies > 500 ||
      !isValidImagePathOrUrl(coverUrl)
    ) {
      res.status(400).json({
        error: `Data pembaruan buku tidak valid. Total stok tidak boleh kurang dari jumlah yang sedang dipinjam (${activeLoanedCount}).`,
      });
      return;
    }

    const updated = store.updateBook(existing.id, {
      title: title.slice(0, 140),
      author: author.slice(0, 100),
      isbn: isbn.slice(0, 40),
      publisher: publisher.slice(0, 100),
      synopsis: synopsis.slice(0, 800),
      shelfLocation: shelfLocation.slice(0, 40),
      category,
      year,
      totalCopies,
      availableCopies: totalCopies - activeLoanedCount,
      coverUrl,
    });

    store.addActivity({
      type: 'koleksi_ubah',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      description: `Memperbarui data koleksi "${updated!.title}".`,
      bookTitle: updated!.title,
    });
    broadcastEvent('catalog:updated', { payload: { action: 'update', book: updated } });
    broadcastEvent('activity:new');
    res.json({ book: updated });
  });

  app.delete('/api/books/:id', requireAdmin, (req: AuthedRequest, res) => {
    const existing = store.findBookById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }
    const activeLoans = store
      .getLoans()
      .filter((l) => l.bookId === existing.id && l.status !== 'dikembalikan');
    if (activeLoans.length > 0) {
      res.status(409).json({
        error: `Buku "${existing.title}" masih memiliki ${activeLoans.length} peminjaman aktif.`,
      });
      return;
    }
    const deleted = store.deleteBook(existing.id);
    store.addActivity({
      type: 'koleksi_hapus',
      actorName: req.authUser!.name,
      actorRole: 'admin',
      description: `Menghapus buku "${deleted!.title}" dari katalog.`,
      bookTitle: deleted!.title,
    });
    broadcastEvent('catalog:updated', { payload: { action: 'delete', bookId: existing.id } });
    broadcastEvent('activity:new');
    res.json({ deletedId: existing.id });
  });

  // --- LOANS & TRANSACTIONS ---
  app.get('/api/loans', requireAuth, (req: AuthedRequest, res) => {
    const allLoans = store.getLoans();
    if (req.authUser!.role === 'admin') {
      res.json({ loans: allLoans });
      return;
    }
    res.json({ loans: allLoans.filter((l) => l.userId === req.authUser!.id) });
  });

  app.post('/api/loans', requireAuth, (req: AuthedRequest, res) => {
    const { bookId, durationDays, targetUserId } = req.body as {
      bookId?: unknown;
      durationDays?: unknown;
      targetUserId?: unknown;
    };
    if (typeof bookId !== 'string') {
      res.status(400).json({ error: 'ID buku wajib disertakan.' });
      return;
    }
    const days = Number(durationDays) === 14 ? 14 : 7;

    let borrower = req.authUser!;
    if (req.authUser!.role === 'admin' && typeof targetUserId === 'string' && targetUserId.trim()) {
      const target = store.findUserById(targetUserId.trim());
      if (!target) {
        res.status(404).json({ error: 'Anggota tujuan tidak ditemukan.' });
        return;
      }
      borrower = target;
    }

    if (borrower.status === 'ditangguhkan') {
      res.status(403).json({ error: 'Anggota sedang ditangguhkan dan tidak dapat meminjam buku.' });
      return;
    }

    const book = store.findBookById(bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan di katalog.' });
      return;
    }
    if (book.availableCopies <= 0) {
      res.status(409).json({ error: 'Stok buku ini sedang habis dipinjam.' });
      return;
    }

    const borrowerLoans = store
      .getLoans()
      .filter((l) => l.userId === borrower.id && l.status !== 'dikembalikan');
    if (borrowerLoans.length >= MAX_ACTIVE_LOANS_PER_MEMBER) {
      res.status(409).json({
        error: `Batas maksimal ${MAX_ACTIVE_LOANS_PER_MEMBER} peminjaman aktif telah tercapai.`,
      });
      return;
    }
    if (borrowerLoans.some((l) => l.bookId === book.id)) {
      res.status(409).json({ error: 'Anda sudah memiliki peminjaman aktif untuk judul buku ini.' });
      return;
    }

    const now = new Date();
    const due = new Date(now);
    due.setDate(now.getDate() + days);

    const loanCode = `TRX-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    const newLoan: Loan = {
      id: `ln-${crypto.randomUUID().slice(0, 8)}`,
      loanCode,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      bookCoverUrl: book.coverUrl,
      bookCategory: book.category,
      userId: borrower.id,
      memberName: borrower.name,
      memberCode: borrower.memberCode,
      borrowedAt: now.toISOString(),
      dueAt: due.toISOString(),
      returnedAt: null,
      extendedCount: 0,
      status: 'dipinjam',
      fineAmount: 0,
    };

    store.updateBook(book.id, {
      availableCopies: book.availableCopies - 1,
      borrowCount: book.borrowCount + 1,
    });
    store.addLoan(newLoan);
    store.addActivity({
      type: 'pinjam',
      actorName: borrower.name,
      actorRole: borrower.role,
      description: `${borrower.name} meminjam "${book.title}" selama ${days} hari.`,
      bookTitle: book.title,
      loanCode,
    });

    broadcastEvent('catalog:updated');
    broadcastEvent('loan:updated', { targetUserId: borrower.id, payload: newLoan });
    broadcastEvent('activity:new', { targetUserId: borrower.id });

    res.status(201).json({ loan: newLoan });
  });

  app.post('/api/loans/:id/return', requireAuth, (req: AuthedRequest, res) => {
    const loan = store.findLoanById(req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi peminjaman tidak ditemukan.' });
      return;
    }
    if (req.authUser!.role !== 'admin' && loan.userId !== req.authUser!.id) {
      res.status(403).json({ error: 'Anda tidak berhak mengembalikan transaksi milik anggota lain.' });
      return;
    }
    const returned = store.recordReturn(loan.id);
    if (!returned) {
      res.status(409).json({ error: 'Buku ini sudah dikembalikan sebelumnya.' });
      return;
    }

    store.addActivity({
      type: 'kembali',
      actorName: req.authUser!.name,
      actorRole: req.authUser!.role,
      description: `Pengembalian "${returned.bookTitle}" (${returned.loanCode})${
        returned.fineAmount > 0 ? ` · Denda Rp ${returned.fineAmount.toLocaleString('id-ID')}` : ''
      }.`,
      bookTitle: returned.bookTitle,
      loanCode: returned.loanCode,
    });

    broadcastEvent('catalog:updated');
    broadcastEvent('loan:updated', { targetUserId: returned.userId, payload: returned });
    broadcastEvent('activity:new', { targetUserId: returned.userId });

    res.json({ loan: returned });
  });

  app.post('/api/loans/:id/extend', requireAuth, (req: AuthedRequest, res) => {
    const loan = store.findLoanById(req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi peminjaman tidak ditemukan.' });
      return;
    }
    if (req.authUser!.role !== 'admin' && loan.userId !== req.authUser!.id) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }
    if (loan.status === 'terlambat') {
      res.status(409).json({ error: 'Buku yang sudah melewati jatuh tempo tidak dapat diperpanjang.' });
      return;
    }
    if (loan.extendedCount >= MAX_EXTENSIONS_PER_LOAN) {
      res.status(409).json({ error: `Batas maksimal ${MAX_EXTENSIONS_PER_LOAN} kali perpanjangan tercapai.` });
      return;
    }
    const extended = store.extendLoan(loan.id);
    if (!extended) {
      res.status(409).json({ error: 'Peminjaman tidak dapat diperpanjang.' });
      return;
    }
    store.addActivity({
      type: 'perpanjang',
      actorName: req.authUser!.name,
      actorRole: req.authUser!.role,
      description: `Perpanjangan +7 hari untuk "${extended.bookTitle}" (${extended.loanCode}).`,
      bookTitle: extended.bookTitle,
      loanCode: extended.loanCode,
    });

    broadcastEvent('loan:updated', { targetUserId: extended.userId, payload: extended });
    broadcastEvent('activity:new', { targetUserId: extended.userId });

    res.json({ loan: extended });
  });

  // --- MEMBERS & ACTIVITIES ---
  app.get('/api/members', requireAdmin, (_req, res) => {
    const members = store
      .getUsers()
      .filter((u) => u.role === 'member')
      .map((u) => store.toPublicUser(u));
    res.json({ members });
  });

  app.patch('/api/members/:id/status', requireAdmin, (req: AuthedRequest, res) => {
    const { status } = req.body as { status?: unknown };
    if (status !== 'aktif' && status !== 'ditangguhkan') {
      res.status(400).json({ error: 'Status anggota tidak valid.' });
      return;
    }
    const updated = store.updateUserStatus(req.params.id, status);
    if (!updated) {
      res.status(404).json({ error: 'Anggota tidak ditemukan.' });
      return;
    }
    broadcastEvent('member:updated', { adminOnly: true });
    res.json({ member: store.toPublicUser(updated) });
  });

  app.get('/api/activities', requireAuth, (req: AuthedRequest, res) => {
    const all = store.getActivities();
    if (req.authUser!.role === 'admin') {
      res.json({ activities: all.slice(0, 60) });
      return;
    }
    const myLoans = new Set(
      store
        .getLoans()
        .filter((l) => l.userId === req.authUser!.id)
        .map((l) => l.loanCode)
    );
    const filtered = all.filter(
      (a) =>
        a.type === 'koleksi_tambah' ||
        a.type === 'koleksi_ubah' ||
        (a.loanCode && myLoans.has(a.loanCode)) ||
        a.actorName === req.authUser!.name
    );
    res.json({ activities: filtered.slice(0, 40) });
  });

  // --- AUTOMATED REPORTING ---
  app.get('/api/reports', requireAdmin, (_req, res) => {
    res.json({
      reports: store.getReports(),
      overview: store.getPublicOverview(),
    });
  });

  app.post('/api/reports/generate', requireAdmin, (req, res) => {
    const { periodType } = req.body as { periodType?: unknown };
    if (periodType !== 'harian' && periodType !== 'mingguan' && periodType !== 'bulanan') {
      res.status(400).json({ error: 'Periode laporan harus harian, mingguan, atau bulanan.' });
      return;
    }
    const report = store.generateReport(periodType, 'manual');
    broadcastEvent('report:generated', { adminOnly: true, payload: report });
    broadcastEvent('activity:new', { adminOnly: true });
    res.status(201).json({ report });
  });

  app.get('/api/reports/:id/csv', requireAdmin, (req, res) => {
    const report = store.findReportById(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Laporan tidak ditemukan.' });
      return;
    }
    const lines: string[] = [];
    lines.push(['Kode Laporan', report.reportCode].map(sanitizeCsvCell).join(','));
    lines.push(['Periode', report.periodLabel].map(sanitizeCsvCell).join(','));
    lines.push(['Sumber', report.triggerSource].map(sanitizeCsvCell).join(','));
    lines.push(['Dibuat Pada', report.generatedAt].map(sanitizeCsvCell).join(','));
    lines.push('');
    lines.push(['Metrik Ringkasan', 'Nilai'].map(sanitizeCsvCell).join(','));
    lines.push(['Total Judul Koleksi', report.summary.totalBooks].map(sanitizeCsvCell).join(','));
    lines.push(['Total Eksemplar', report.summary.totalCopies].map(sanitizeCsvCell).join(','));
    lines.push(['Eksemplar Tersedia', report.summary.availableCopies].map(sanitizeCsvCell).join(','));
    lines.push(['Peminjaman Periode Ini', report.summary.totalLoansInPeriod].map(sanitizeCsvCell).join(','));
    lines.push(['Sedang Dipinjam', report.summary.activeLoans].map(sanitizeCsvCell).join(','));
    lines.push(['Dikembalikan Periode Ini', report.summary.returnedInPeriod].map(sanitizeCsvCell).join(','));
    lines.push(['Terlambat', report.summary.overdueCount].map(sanitizeCsvCell).join(','));
    lines.push(['Total Denda (IDR)', report.summary.totalFines].map(sanitizeCsvCell).join(','));
    lines.push(['Kategori Terpopuler', report.summary.topCategory].map(sanitizeCsvCell).join(','));
    lines.push(['Buku Terpopuler', report.summary.topBookTitle].map(sanitizeCsvCell).join(','));
    lines.push('');
    lines.push(['Kategori', 'Jumlah Judul', 'Total Peminjaman'].map(sanitizeCsvCell).join(','));
    for (const row of report.categoryBreakdown) {
      lines.push([row.category, row.books, row.borrows].map(sanitizeCsvCell).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${report.reportCode}.csv"`
    );
    res.send(lines.join('\n'));
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build belum tersedia.');
      }
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`acelivre server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
