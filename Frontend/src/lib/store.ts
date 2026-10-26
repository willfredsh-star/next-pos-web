/* ------------------------------------------------------------------ */
/*  NEXT POS data layer                                                */
/*                                                                     */
/*  Everything the UI needs (accounts, sessions, shifts, transactions) */
/*  goes through the functions in this file. They are async/Result     */
/*  based and currently persist to localStorage, so you can replace    */
/*  each function body with a fetch() call to your backend later       */
/*  without touching any component.                                    */
/*                                                                     */
/*  NOTE: checks made here (for example "only a manager may create a   */
/*  cashier") only protect the demo. Your backend must enforce them.   */
/* ------------------------------------------------------------------ */

import { useSyncExternalStore } from "react"

export type Role = "manager" | "cashier"

export type Account = {
  id: string
  name: string
  email: string
  title: string
  role: Role
  active: boolean
  createdAt: number
  createdBy: string | null
}

type StoredAccount = Account & { passwordHash: string }

export type Shift = {
  id: string
  cashierId: string
  startedAt: number
  endedAt: number | null
}

export type Transaction = {
  id: string
  number: number
  cashierId: string
  shiftId: string
  at: number
  items: number
  subtotal: number
  /** Discount applied before tax. Missing on orders recorded before discounts existed. */
  discount?: number
  tax: number
  total: number
  orderType: string
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export type ShiftStats = {
  shift: Shift
  orders: number
  items: number
  sales: number
  avgTicket: number
  durationMs: number
  ordersPerHour: number
}

export type CashierSummary = {
  account: Account
  activeShift: Shift | null
  shifts: number
  orders: number
  items: number
  sales: number
  avgTicket: number
  ordersPerHour: number
  durationMs: number
  recent: ShiftStats[]
}

export const MIN_PASSWORD = 6
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HOUR = 3_600_000
const DAY = 86_400_000

export const DEMO_ACCOUNTS = [
  { label: "Manajer", email: "manager@nextgen.id", password: "manager123" },
  { label: "Kasir", email: "kasir@nextgen.id", password: "kasir123" },
] as const

const KEYS = {
  accounts: "nextpos.accounts",
  shifts: "nextpos.shifts",
  transactions: "nextpos.transactions",
  session: "nextpos.session",
  seeded: "nextpos.seeded",
} as const

/* ---------- storage helpers (fall back to memory if blocked) ---------- */

const memory = new Map<string, string>()

function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

function setItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    memory.set(key, value)
  }
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  setItem(key, JSON.stringify(value))
  emit()
}

/* ---------- change notification (also reacts to other browser tabs) ---------- */

let version = 0
const listeners = new Set<() => void>()

function emit() {
  version += 1
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key.startsWith("nextpos.")) emit()
  })
}

/** Re-renders a component whenever accounts, shifts or transactions change. */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

/* ---------- small utilities ---------- */

function uid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function startOfToday(): number {
  return startOfDay(Date.now())
}

async function hashPassword(password: string, email: string): Promise<string> {
  const data = new TextEncoder().encode(
    `nextpos:${email.trim().toLowerCase()}:${password}`,
  )
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }
  // Non-secure context fallback (plain http). Demo only.
  let hash = 5381
  data.forEach((byte) => {
    hash = ((hash * 33) ^ byte) >>> 0
  })
  return `weak-${hash.toString(16)}`
}

function toPublic(account: StoredAccount): Account {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    title: account.title,
    role: account.role,
    active: account.active,
    createdAt: account.createdAt,
    createdBy: account.createdBy,
  }
}

function readAccounts(): StoredAccount[] {
  return load<StoredAccount[]>(KEYS.accounts, [])
}
function readShifts(): Shift[] {
  return load<Shift[]>(KEYS.shifts, [])
}
function readTransactions(): Transaction[] {
  return load<Transaction[]>(KEYS.transactions, [])
}

function validateIdentity(
  name: string,
  email: string,
  password: string,
): string | null {
  if (name.trim().length < 2) return "Nama lengkap minimal 2 karakter."
  if (!EMAIL_PATTERN.test(email.trim())) return "Masukkan alamat email yang valid."
  if (password.length < MIN_PASSWORD)
    return `Kata sandi minimal ${MIN_PASSWORD} karakter.`
  return null
}

function findManager(actorId: string): StoredAccount | null {
  const actor = readAccounts().find((account) => account.id === actorId)
  return actor && actor.role === "manager" && actor.active ? actor : null
}

/* ---------- session ---------- */

function readSession(): string | null {
  try {
    return (
      localStorage.getItem(KEYS.session) ?? sessionStorage.getItem(KEYS.session)
    )
  } catch {
    return memory.get(KEYS.session) ?? null
  }
}

function clearSession() {
  try {
    localStorage.removeItem(KEYS.session)
    sessionStorage.removeItem(KEYS.session)
  } catch {
    /* ignore */
  }
  memory.delete(KEYS.session)
}

function writeSession(id: string, remember: boolean) {
  clearSession()
  try {
    ;(remember ? localStorage : sessionStorage).setItem(KEYS.session, id)
  } catch {
    memory.set(KEYS.session, id)
  }
}

export function currentAccount(): Account | null {
  const id = readSession()
  if (!id) return null
  const account = readAccounts().find((item) => item.id === id)
  return account && account.active ? toPublic(account) : null
}

export function logout() {
  clearSession()
  emit()
}

/* ---------- accounts ---------- */

export async function registerManager(
  input: { name: string; email: string; password: string },
  remember: boolean,
): Promise<Result<Account>> {
  const problem = validateIdentity(input.name, input.email, input.password)
  if (problem) return { ok: false, error: problem }
  const accounts = readAccounts()
  const email = input.email.trim().toLowerCase()
  if (accounts.some((account) => account.email === email))
    return { ok: false, error: "Email ini sudah terdaftar. Silakan masuk." }
  const stored: StoredAccount = {
    id: uid(),
    name: input.name.trim(),
    email,
    title: "Manajer toko",
    role: "manager",
    active: true,
    createdAt: Date.now(),
    createdBy: null,
    passwordHash: await hashPassword(input.password, email),
  }
  save(KEYS.accounts, [...accounts, stored])
  writeSession(stored.id, remember)
  return { ok: true, value: toPublic(stored) }
}

export async function login(
  emailInput: string,
  password: string,
  remember: boolean,
): Promise<Result<Account>> {
  const email = emailInput.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email))
    return { ok: false, error: "Masukkan alamat email yang valid." }
  if (!password) return { ok: false, error: "Masukkan kata sandi Anda." }
  const account = readAccounts().find((item) => item.email === email)
  const hash = await hashPassword(password, email)
  if (!account || account.passwordHash !== hash)
    return { ok: false, error: "Email atau kata sandi salah." }
  if (!account.active)
    return {
      ok: false,
      error: "Akun ini dinonaktifkan. Hubungi manajer Anda.",
    }
  writeSession(account.id, remember)
  emit()
  return { ok: true, value: toPublic(account) }
}

export async function createCashier(
  actorId: string,
  input: { name: string; email: string; password: string; title: string },
): Promise<Result<Account>> {
  if (!findManager(actorId))
    return { ok: false, error: "Hanya manajer yang dapat mendaftarkan kasir." }
  const problem = validateIdentity(input.name, input.email, input.password)
  if (problem) return { ok: false, error: problem }
  const accounts = readAccounts()
  const email = input.email.trim().toLowerCase()
  if (accounts.some((account) => account.email === email))
    return { ok: false, error: "Email ini sudah terdaftar." }
  const stored: StoredAccount = {
    id: uid(),
    name: input.name.trim(),
    email,
    title: input.title.trim() || "Kasir",
    role: "cashier",
    active: true,
    createdAt: Date.now(),
    createdBy: actorId,
    passwordHash: await hashPassword(input.password, email),
  }
  save(KEYS.accounts, [...accounts, stored])
  return { ok: true, value: toPublic(stored) }
}

export async function resetCashierPassword(
  actorId: string,
  cashierId: string,
  password: string,
): Promise<Result<true>> {
  if (!findManager(actorId))
    return { ok: false, error: "Hanya manajer yang dapat mengatur ulang kata sandi." }
  if (password.length < MIN_PASSWORD)
    return { ok: false, error: `Kata sandi minimal ${MIN_PASSWORD} karakter.` }
  const accounts = readAccounts()
  const target = accounts.find(
    (account) => account.id === cashierId && account.role === "cashier",
  )
  if (!target) return { ok: false, error: "Kasir tidak ditemukan." }
  const passwordHash = await hashPassword(password, target.email)
  save(
    KEYS.accounts,
    accounts.map((account) =>
      account.id === cashierId ? { ...account, passwordHash } : account,
    ),
  )
  return { ok: true, value: true }
}

export function setCashierActive(
  actorId: string,
  cashierId: string,
  active: boolean,
): Result<true> {
  if (!findManager(actorId))
    return { ok: false, error: "Hanya manajer yang dapat mengubah status kasir." }
  const accounts = readAccounts()
  if (!accounts.some((a) => a.id === cashierId && a.role === "cashier"))
    return { ok: false, error: "Kasir tidak ditemukan." }
  if (!active) endShift(cashierId)
  save(
    KEYS.accounts,
    accounts.map((account) =>
      account.id === cashierId ? { ...account, active } : account,
    ),
  )
  return { ok: true, value: true }
}

export function updateProfile(
  accountId: string,
  changes: { name: string; title: string },
): Result<Account> {
  const accounts = readAccounts()
  const target = accounts.find((account) => account.id === accountId)
  if (!target) return { ok: false, error: "Akun tidak ditemukan." }
  if (changes.name.trim().length < 2)
    return { ok: false, error: "Nama lengkap minimal 2 karakter." }
  const updated: StoredAccount = {
    ...target,
    name: changes.name.trim(),
    title: changes.title.trim() || target.title,
  }
  save(
    KEYS.accounts,
    accounts.map((account) => (account.id === accountId ? updated : account)),
  )
  return { ok: true, value: toPublic(updated) }
}

export function listCashiers(): Account[] {
  return readAccounts()
    .filter((account) => account.role === "cashier")
    .map(toPublic)
}

/* ---------- shifts & transactions ---------- */

export function listShifts(since = 0): Shift[] {
  return readShifts()
    .filter((shift) => (shift.endedAt ?? Date.now()) >= since)
    .sort((a, b) => b.startedAt - a.startedAt)
}

export function activeShift(cashierId: string): Shift | null {
  return (
    readShifts().find(
      (shift) => shift.cashierId === cashierId && shift.endedAt === null,
    ) ?? null
  )
}

/** A shift left open (tab closed without signing out) is closed after this long. */
const STALE_SHIFT_MS = 14 * HOUR

export function startShift(cashierId: string): Shift {
  const existing = activeShift(cashierId)
  if (existing && Date.now() - existing.startedAt < STALE_SHIFT_MS) return existing
  if (existing) endShift(cashierId, existing.startedAt + STALE_SHIFT_MS)
  const shift: Shift = {
    id: uid(),
    cashierId,
    startedAt: Date.now(),
    endedAt: null,
  }
  save(KEYS.shifts, [...readShifts(), shift])
  return shift
}

export function endShift(
  cashierId: string,
  endedAt: number = Date.now(),
): Shift | null {
  const shifts = readShifts()
  const open = shifts.find(
    (shift) => shift.cashierId === cashierId && shift.endedAt === null,
  )
  if (!open) return null
  const closed: Shift = { ...open, endedAt }
  save(
    KEYS.shifts,
    shifts.map((shift) => (shift.id === open.id ? closed : shift)),
  )
  return closed
}

export function nextOrderNumber(): number {
  const numbers = readTransactions().map((tx) => tx.number)
  return numbers.length ? Math.max(...numbers) + 1 : 2001
}

export function recordTransaction(input: {
  cashierId: string
  items: number
  subtotal: number
  discount?: number
  tax: number
  orderType: string
}): Result<Transaction> {
  const shift = activeShift(input.cashierId)
  if (!shift)
    return {
      ok: false,
      error: "Aktifkan shift terlebih dahulu sebelum memproses pembayaran.",
    }
  const transaction: Transaction = {
    id: uid(),
    number: nextOrderNumber(),
    cashierId: input.cashierId,
    shiftId: shift.id,
    at: Date.now(),
    items: input.items,
    subtotal: Math.round(input.subtotal),
    discount: Math.round(input.discount ?? 0),
    tax: Math.round(input.tax),
    total:
      Math.round(input.subtotal) -
      Math.round(input.discount ?? 0) +
      Math.round(input.tax),
    orderType: input.orderType,
  }
  save(KEYS.transactions, [...readTransactions(), transaction])
  return { ok: true, value: transaction }
}

export function listTransactions(options?: {
  cashierId?: string
  since?: number
}): Transaction[] {
  return readTransactions()
    .filter(
      (tx) =>
        (!options?.cashierId || tx.cashierId === options.cashierId) &&
        (!options?.since || tx.at >= options.since),
    )
    .sort((a, b) => b.at - a.at)
}

/* ---------- performance ---------- */

export function shiftStats(
  shift: Shift,
  transactions: Transaction[],
  now = Date.now(),
): ShiftStats {
  const own = transactions.filter((tx) => tx.shiftId === shift.id)
  const orders = own.length
  const items = own.reduce((sum, tx) => sum + tx.items, 0)
  const sales = own.reduce((sum, tx) => sum + tx.total, 0)
  const durationMs = Math.max(0, (shift.endedAt ?? now) - shift.startedAt)
  // avoid absurd orders/hour numbers for very short shifts
  const hours = Math.max(durationMs, 10 * 60_000) / HOUR
  return {
    shift,
    orders,
    items,
    sales,
    avgTicket: orders ? sales / orders : 0,
    durationMs,
    ordersPerHour: orders / hours,
  }
}

/** Live numbers for the cashier's open shift, or null when no shift is open. */
export function currentShiftStats(cashierId: string): ShiftStats | null {
  const shift = activeShift(cashierId)
  return shift ? shiftStats(shift, readTransactions()) : null
}

/** Per-cashier performance. `since` limits it to shifts that overlap that time. */
export function cashierSummaries(since = 0): CashierSummary[] {
  const shifts = readShifts()
  const transactions = readTransactions()
  const now = Date.now()
  return listCashiers().map((account) => {
    const recent = shifts
      .filter(
        (shift) =>
          shift.cashierId === account.id && (shift.endedAt ?? now) >= since,
      )
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((shift) => shiftStats(shift, transactions, now))
    const orders = recent.reduce((sum, s) => sum + s.orders, 0)
    const sales = recent.reduce((sum, s) => sum + s.sales, 0)
    const durationMs = recent.reduce((sum, s) => sum + s.durationMs, 0)
    return {
      account,
      activeShift: recent.find((s) => s.shift.endedAt === null)?.shift ?? null,
      shifts: recent.length,
      orders,
      items: recent.reduce((sum, s) => sum + s.items, 0),
      sales,
      avgTicket: orders ? sales / orders : 0,
      durationMs,
      ordersPerHour: orders / (Math.max(durationMs, 10 * 60_000) / HOUR),
      recent,
    }
  })
}

/* ---------- demo data (created once, on first launch) ---------- */

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PRICES = [32000, 55000, 58000, 64000, 69000, 72000, 76000, 85000]

export async function ensureSeed(): Promise<void> {
  if (getItem(KEYS.seeded) && readAccounts().length > 0) return

  const now = Date.now()
  const today = startOfDay(now)
  const rand = mulberry32(20241014)

  const people = [
    { name: "Rina Pratama", email: "manager@nextgen.id", title: "Manajer toko", role: "manager" as Role, password: "manager123", pace: 0, startHour: 0 },
    { name: "Andi Maulana", email: "kasir@nextgen.id", title: "Kasir · Shift malam", role: "cashier" as Role, password: "kasir123", pace: 1, startHour: 15 },
    { name: "Sari Wulandari", email: "sari@nextgen.id", title: "Kasir · Shift pagi", role: "cashier" as Role, password: "kasir123", pace: 1.3, startHour: 7 },
    { name: "Budi Santoso", email: "budi@nextgen.id", title: "Kasir · Shift siang", role: "cashier" as Role, password: "kasir123", pace: 0.8, startHour: 11 },
  ]

  const accounts: StoredAccount[] = []
  for (const person of people) {
    accounts.push({
      id: uid(),
      name: person.name,
      email: person.email,
      title: person.title,
      role: person.role,
      active: true,
      createdAt: today - 30 * DAY,
      createdBy: null,
      passwordHash: await hashPassword(person.password, person.email),
    })
  }

  const shifts: Shift[] = []
  const drafts: Omit<Transaction, "number">[] = []

  const makeOrders = (
    cashierId: string,
    shiftId: string,
    from: number,
    to: number,
    count: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const items = 1 + Math.floor(rand() * 5)
      let subtotal = 0
      for (let k = 0; k < items; k++)
        subtotal += PRICES[Math.floor(rand() * PRICES.length)]
      const tax = Math.round(subtotal * 0.11)
      drafts.push({
        id: uid(),
        cashierId,
        shiftId,
        at: Math.round(from + ((i + rand() * 0.8) / count) * (to - from)),
        items,
        subtotal,
        tax,
        total: subtotal + tax,
        orderType: rand() < 0.7 ? "Makan di tempat" : "Bawa pulang",
      })
    }
  }

  accounts.forEach((account, index) => {
    const person = people[index]
    if (account.role !== "cashier") return
    // five finished shifts on previous days
    for (let back = 1; back <= 5; back++) {
      const startedAt = today - back * DAY + person.startHour * HOUR
      const length = (6 + rand() * 2) * HOUR
      const shift: Shift = {
        id: uid(),
        cashierId: account.id,
        startedAt,
        endedAt: Math.round(startedAt + length),
      }
      shifts.push(shift)
      const count = Math.round((22 + rand() * 14) * person.pace)
      makeOrders(account.id, shift.id, shift.startedAt, shift.endedAt!, count)
    }
    // Sari is already on shift today, so the manager sees a live example
    if (person.name === "Sari Wulandari") {
      const startedAt = now - 3 * HOUR
      const shift: Shift = { id: uid(), cashierId: account.id, startedAt, endedAt: null }
      shifts.push(shift)
      makeOrders(account.id, shift.id, startedAt, now - 4 * 60_000, 14)
    }
  })

  drafts.sort((a, b) => a.at - b.at)
  const transactions: Transaction[] = drafts.map((draft, index) => ({
    ...draft,
    number: 1001 + index,
  }))

  setItem(KEYS.accounts, JSON.stringify(accounts))
  setItem(KEYS.shifts, JSON.stringify(shifts))
  setItem(KEYS.transactions, JSON.stringify(transactions))
  setItem(KEYS.seeded, "1")
  emit()
}
