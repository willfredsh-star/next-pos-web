import { useEffect, useMemo, useState } from "react"
import { Icon } from "./Icon"
import {
  formatDay,
  formatDuration,
  formatTime,
  initials,
  rupiah,
} from "./lib/format"
import {
  MIN_PASSWORD,
  cashierSummaries,
  createCashier,
  resetCashierPassword,
  setCashierActive,
  startOfToday,
  useStoreVersion,
  type Account,
  type CashierSummary,
} from "./lib/store"

type Range = "today" | "week" | "all"

const RANGES: { id: Range; label: string; title: string }[] = [
  { id: "today", label: "Hari ini", title: "hari ini" },
  { id: "week", label: "7 hari", title: "7 hari terakhir" },
  { id: "all", label: "Semua", title: "seluruh riwayat" },
]

function rangeStart(range: Range): number {
  if (range === "today") return startOfToday()
  if (range === "week") return startOfToday() - 6 * 86_400_000
  return 0
}

function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

const perHour = (value: number) => value.toFixed(1).replace(".", ",")

export function TeamView({
  manager,
  onMessage,
  query = "",
}: {
  manager: Account
  onMessage: (text: string) => void
  query?: string
}) {
  const version = useStoreVersion()
  const [tick, setTick] = useState(0)
  const [range, setRange] = useState<Range>("today")
  const [openId, setOpenId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [title, setTitle] = useState("Kasir")
  const [password, setPassword] = useState("")
  const [formError, setFormError] = useState("")
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{
    name: string
    email: string
    password: string
  } | null>(null)
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetValue, setResetValue] = useState("")

  // keep live shift durations fresh
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const summaries = useMemo<CashierSummary[]>(
    () =>
      cashierSummaries(rangeStart(range)).sort((a, b) => b.sales - a.sales),
    // version/tick make the list refresh when data changes or time passes
    [version, tick, range],
  )

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? summaries.filter((item) =>
        `${item.account.name} ${item.account.email} ${item.account.title}`
          .toLowerCase()
          .includes(needle),
      )
    : summaries

  const rangeTitle = RANGES.find((item) => item.id === range)!.title
  const totalSales = summaries.reduce((sum, item) => sum + item.sales, 0)
  const totalOrders = summaries.reduce((sum, item) => sum + item.orders, 0)
  const onDuty = summaries.filter((item) => item.activeShift).length
  const activeCashiers = summaries.filter((item) => item.account.active).length
  const topSales = Math.max(1, ...summaries.map((item) => item.sales))

  async function submitCashier(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setFormError("")
    setBusy(true)
    const result = await createCashier(manager.id, {
      name,
      email,
      password,
      title,
    })
    setBusy(false)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    setCreated({
      name: result.value.name,
      email: result.value.email,
      password,
    })
    setName("")
    setEmail("")
    setPassword("")
    setTitle("Kasir")
    setFormOpen(false)
    onMessage(`Kasir ${result.value.name} berhasil didaftarkan`)
  }

  async function copyCredentials() {
    if (!created) return
    const text = `NEXT POS\nEmail: ${created.email}\nKata sandi: ${created.password}`
    try {
      await navigator.clipboard.writeText(text)
      onMessage("Kredensial disalin")
    } catch {
      onMessage("Tidak dapat menyalin otomatis. Salin secara manual.")
    }
  }

  async function submitReset(event: React.FormEvent, cashier: Account) {
    event.preventDefault()
    const result = await resetCashierPassword(manager.id, cashier.id, resetValue)
    if (!result.ok) {
      onMessage(result.error)
      return
    }
    setResetId(null)
    setResetValue("")
    onMessage(`Kata sandi ${cashier.name} diperbarui`)
  }

  function toggleActive(cashier: Account) {
    const result = setCashierActive(manager.id, cashier.id, !cashier.active)
    if (!result.ok) {
      onMessage(result.error)
      return
    }
    onMessage(
      cashier.active
        ? `${cashier.name} dinonaktifkan`
        : `${cashier.name} diaktifkan kembali`,
    )
  }

  return (
    <section className="workspace-view team-view">
      <div className="workspace-header">
        <div>
          <span className="eyebrow">Manajer</span>
          <h2>Tim kasir</h2>
          <p>Pantau kinerja shift setiap kasir dan daftarkan kasir baru.</p>
        </div>
        <button
          className="workspace-primary"
          onClick={() => {
            setFormOpen((current) => !current)
            setFormError("")
          }}
        >
          <Icon name={formOpen ? "close" : "plus"} size={17} />{" "}
          {formOpen ? "Tutup" : "Daftarkan kasir"}
        </button>
      </div>

      {created && (
        <div className="credentials-card" role="status">
          <span className="credentials-icon">
            <Icon name="check" size={20} />
          </span>
          <div>
            <strong>{created.name} siap bekerja</strong>
            <p>
              Bagikan kredensial ini sekarang. Kata sandi tidak dapat dilihat
              lagi setelah kartu ini ditutup.
            </p>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{created.email}</dd>
              </div>
              <div>
                <dt>Kata sandi</dt>
                <dd>{created.password}</dd>
              </div>
            </dl>
          </div>
          <div className="credentials-actions">
            <button className="workspace-secondary" onClick={copyCredentials}>
              Salin
            </button>
            <button className="workspace-primary" onClick={() => setCreated(null)}>
              Selesai
            </button>
          </div>
        </div>
      )}

      {formOpen && (
        <form className="cashier-form" onSubmit={submitCashier} noValidate>
          <div className="cashier-form-heading">
            <span className="shift-card-icon">
              <Icon name="users" size={21} />
            </span>
            <div>
              <h3>Kasir baru</h3>
              <p>Kasir dapat langsung masuk memakai email dan kata sandi ini.</p>
            </div>
          </div>
          <label>
            <span>Nama lengkap</span>
            <input
              autoComplete="off"
              name="cashier-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Dewi Lestari"
              value={name}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              autoComplete="off"
              name="cashier-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="dewi@nextgen.id"
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Jabatan / shift</span>
            <input
              name="cashier-title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Kasir · Shift pagi"
              value={title}
            />
          </label>
          <label>
            <span>Kata sandi awal</span>
            <div className="input-with-action">
              <input
                autoComplete="new-password"
                name="cashier-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={`Minimal ${MIN_PASSWORD} karakter`}
                value={password}
              />
              <button
                onClick={() => setPassword(generatePassword())}
                type="button"
              >
                Buat otomatis
              </button>
            </div>
          </label>
          {formError && (
            <div className="login-error form-wide" role="alert">
              {formError}
            </div>
          )}
          <button className="save-product" disabled={busy} type="submit">
            {busy ? "Menyimpan..." : "Daftarkan kasir"}
          </button>
        </form>
      )}

      <div className="team-toolbar">
        <div className="range-switch" role="group" aria-label="Rentang waktu">
          {RANGES.map((item) => (
            <button
              aria-pressed={range === item.id}
              className={range === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setRange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="team-toolbar-note">
          Data kinerja dihitung dari shift kasir {rangeTitle}.
        </span>
      </div>

      <div className="metric-grid">
        <article>
          <span>Total penjualan · {rangeTitle}</span>
          <strong>{rupiah.format(totalSales)}</strong>
          <small>
            {totalOrders} pesanan dari {summaries.length} kasir
          </small>
        </article>
        <article>
          <span>Rata-rata per pesanan</span>
          <strong>
            {rupiah.format(totalOrders ? totalSales / totalOrders : 0)}
          </strong>
          <small>Semua kasir digabung</small>
        </article>
        <article>
          <span>Kasir sedang bertugas</span>
          <strong>
            {onDuty} / {activeCashiers}
          </strong>
          <small>{onDuty ? "Shift berjalan sekarang" : "Belum ada shift aktif"}</small>
        </article>
      </div>

      <div className="team-list">
        {shown.length === 0 && (
          <div className="no-results">
            <Icon name="users" size={28} />
            <h3>{needle ? "Kasir tidak ditemukan" : "Belum ada kasir"}</h3>
            <p>
              {needle
                ? "Coba nama atau email kasir lain."
                : "Daftarkan kasir pertama Anda dengan tombol di kanan atas."}
            </p>
          </div>
        )}
        {shown.map((item) => {
          const account = item.account
          const isOpen = openId === account.id
          const status = !account.active
            ? { className: "off", text: "Nonaktif" }
            : item.activeShift
              ? {
                  className: "live",
                  text: `Shift sejak ${formatTime(item.activeShift.startedAt)}`,
                }
              : { className: "idle", text: "Tidak bertugas" }
          return (
            <article
              className={`team-card ${isOpen ? "open" : ""} ${
                account.active ? "" : "inactive"
              }`}
              key={account.id}
            >
              <button
                aria-expanded={isOpen}
                className="team-card-head"
                onClick={() => setOpenId(isOpen ? null : account.id)}
              >
                <span className="team-rank">{item.sales > 0 ? summaries.indexOf(item) + 1 : "–"}</span>
                <span className="team-avatar">{initials(account.name)}</span>
                <span className="team-who">
                  <strong>{account.name}</strong>
                  <small>
                    {account.title} · {account.email}
                  </small>
                </span>
                <span className={`chip chip-${status.className}`}>
                  <i></i>
                  {status.text}
                </span>
                <span className="team-chevron">
                  <Icon name="chevron" size={17} />
                </span>
              </button>

              <div className="team-stats">
                <div>
                  <small>Penjualan</small>
                  <strong>{rupiah.format(item.sales)}</strong>
                </div>
                <div>
                  <small>Pesanan</small>
                  <strong>{item.orders}</strong>
                </div>
                <div>
                  <small>Rata-rata / pesanan</small>
                  <strong>{rupiah.format(item.avgTicket)}</strong>
                </div>
                <div>
                  <small>Pesanan / jam</small>
                  <strong>{perHour(item.ordersPerHour)}</strong>
                </div>
                <div>
                  <small>Jam kerja</small>
                  <strong>{formatDuration(item.durationMs)}</strong>
                </div>
              </div>
              <div className="perf-bar" aria-hidden="true">
                <i style={{ width: `${(item.sales / topSales) * 100}%` }} />
              </div>

              {isOpen && (
                <div className="team-detail">
                  <div className="shift-table" role="table">
                    <div className="shift-table-head" role="row">
                      <span>Tanggal</span>
                      <span>Jam</span>
                      <span>Durasi</span>
                      <span>Pesanan</span>
                      <span>Penjualan</span>
                      <span>Per jam</span>
                    </div>
                    {item.recent.length === 0 && (
                      <p className="shift-table-empty">
                        Belum ada shift pada rentang ini.
                      </p>
                    )}
                    {item.recent.slice(0, 6).map((entry) => (
                      <div
                        className="shift-table-row"
                        key={entry.shift.id}
                        role="row"
                      >
                        <span>{formatDay(entry.shift.startedAt)}</span>
                        <span>
                          {formatTime(entry.shift.startedAt)}–
                          {entry.shift.endedAt
                            ? formatTime(entry.shift.endedAt)
                            : "sekarang"}
                        </span>
                        <span>{formatDuration(entry.durationMs)}</span>
                        <span>{entry.orders}</span>
                        <span>{rupiah.format(entry.sales)}</span>
                        <span>{perHour(entry.ordersPerHour)}</span>
                      </div>
                    ))}
                  </div>

                  {resetId === account.id ? (
                    <form
                      className="reset-form"
                      onSubmit={(event) => submitReset(event, account)}
                    >
                      <input
                        autoComplete="new-password"
                        autoFocus
                        name="reset-password"
                        onChange={(event) => setResetValue(event.target.value)}
                        placeholder={`Kata sandi baru (min. ${MIN_PASSWORD})`}
                        value={resetValue}
                      />
                      <button
                        onClick={() => setResetValue(generatePassword())}
                        type="button"
                      >
                        Buat otomatis
                      </button>
                      <button className="reset-save" type="submit">
                        Simpan
                      </button>
                      <button
                        onClick={() => {
                          setResetId(null)
                          setResetValue("")
                        }}
                        type="button"
                      >
                        Batal
                      </button>
                    </form>
                  ) : (
                    <div className="team-actions">
                      <button
                        className="toggle-button"
                        onClick={() => {
                          setResetId(account.id)
                          setResetValue("")
                        }}
                      >
                        Atur ulang kata sandi
                      </button>
                      <button
                        className={
                          account.active ? "toggle-button danger" : "toggle-button"
                        }
                        onClick={() => toggleActive(account)}
                      >
                        {account.active ? "Nonaktifkan akun" : "Aktifkan akun"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
