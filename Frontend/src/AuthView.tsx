import { useState } from "react"
import { Icon } from "./Icon"
import {
  DEMO_ACCOUNTS,
  MIN_PASSWORD,
  login,
  registerManager,
  type Account,
} from "./lib/store"

type Mode = "login" | "register"

export function AuthView({
  onAuthenticated,
}: {
  onAuthenticated: (account: Account) => void
}) {
  const [mode, setMode] = useState<Mode>("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState<string>(DEMO_ACCOUNTS[1].email)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)

  const registering = mode === "register"

  function switchMode(next: Mode) {
    setMode(next)
    setError("")
    setNotice("")
    setPassword("")
    setConfirm("")
    setEmail(next === "login" ? DEMO_ACCOUNTS[1].email : "")
  }

  function fillDemo(demo: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(demo.email)
    setPassword(demo.password)
    setError("")
    setNotice("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (loading) return
    setError("")
    setNotice("")
    if (registering && password !== confirm) {
      setError("Konfirmasi kata sandi tidak sama.")
      return
    }
    setLoading(true)
    const result = registering
      ? await registerManager({ name, email, password }, remember)
      : await login(email, password, remember)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onAuthenticated(result.value)
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <div className="brand-mark">
            <span>N</span>
          </div>
          <strong>NEXT POS</strong>
        </div>
        <div className="login-brand-copy">
          <span className="login-kicker">Point of sale generasi baru</span>
          <h1>Kelola setiap pesanan dalam satu orbit.</h1>
          <p>
            Penjualan, menu, dan aktivitas shift tersinkron dalam ruang kerja
            yang cepat dan mudah digunakan.
          </p>
        </div>
        <div className="login-orbit" aria-hidden="true">
          <span className="orbit-core">N</span>
          <i></i>
          <i></i>
          <i></i>
        </div>
        <div className="login-brand-footer">
          <span>
            <i></i> Sistem operasional
          </span>
          <strong>Online</strong>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-mobile-brand">
          <div className="brand-mark">
            <span>N</span>
          </div>
          <strong>NEXT POS</strong>
        </div>
        <form className="login-form" onSubmit={submit} noValidate>
          <div className="login-heading">
            <span className="eyebrow">
              {registering ? "Pendaftaran" : "Akses pekerja"}
            </span>
            <h2>{registering ? "Buat akun manajer" : "Selamat datang kembali"}</h2>
            <p>
              {registering
                ? "Manajer dapat mendaftarkan kasir dan memantau kinerja shift mereka."
                : "Masuk menggunakan akun pekerja yang telah terdaftar."}
            </p>
          </div>

          {registering && (
            <label className="login-field">
              <span>Nama lengkap</span>
              <div>
                <Icon name="user" size={18} />
                <input
                  autoComplete="name"
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nama Anda"
                  value={name}
                />
              </div>
            </label>
          )}

          <label className="login-field">
            <span>{registering ? "Email" : "Email pekerja"}</span>
            <div>
              <Icon name="mail" size={18} />
              <input
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@restoran.id"
                type="email"
                value={email}
              />
            </div>
          </label>

          <label className="login-field">
            <span>Kata sandi</span>
            <div>
              <Icon name="lock" size={18} />
              <input
                autoComplete={registering ? "new-password" : "current-password"}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  registering
                    ? `Minimal ${MIN_PASSWORD} karakter`
                    : "Masukkan kata sandi"
                }
                type={passwordVisible ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={
                  passwordVisible
                    ? "Sembunyikan kata sandi"
                    : "Tampilkan kata sandi"
                }
                className="password-toggle"
                onClick={() => setPasswordVisible((current) => !current)}
                type="button"
              >
                <Icon name="eye" size={17} />
              </button>
            </div>
          </label>

          {registering && (
            <label className="login-field">
              <span>Ulangi kata sandi</span>
              <div>
                <Icon name="shield" size={18} />
                <input
                  autoComplete="new-password"
                  name="confirm-password"
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Ketik ulang kata sandi"
                  type={passwordVisible ? "text" : "password"}
                  value={confirm}
                />
              </div>
            </label>
          )}

          <div className="login-options">
            <label>
              <input
                checked={remember}
                name="remember"
                onChange={(event) => setRemember(event.target.checked)}
                type="checkbox"
              />
              <span>Ingat perangkat ini</span>
            </label>
            {!registering && (
              <button
                onClick={() => {
                  setError("")
                  setNotice(
                    "Hubungi manajer Anda untuk mengatur ulang kata sandi.",
                  )
                }}
                type="button"
              >
                Lupa kata sandi?
              </button>
            )}
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="login-notice" role="status">
              {notice}
            </div>
          )}

          <button className="login-submit" disabled={loading} type="submit">
            <span>
              {loading
                ? "Memverifikasi..."
                : registering
                  ? "Buat akun"
                  : "Masuk ke NEXT"}
            </span>
            {!loading && <Icon name="chevron" size={18} />}
          </button>

          <p className="auth-switch">
            {registering ? "Sudah punya akun?" : "Pemilik toko baru?"}{" "}
            <button
              onClick={() => switchMode(registering ? "login" : "register")}
              type="button"
            >
              {registering ? "Masuk" : "Daftar sebagai manajer"}
            </button>
          </p>

          {!registering && (
            <div className="demo-account">
              <span>Akun demo · ketuk untuk mengisi</span>
              <div className="demo-account-list">
                {DEMO_ACCOUNTS.map((demo) => (
                  <button
                    key={demo.email}
                    onClick={() => fillDemo(demo)}
                    type="button"
                  >
                    <strong>{demo.label}</strong>
                    <small>
                      {demo.email} · {demo.password}
                    </small>
                  </button>
                ))}
              </div>
              <p>Akun kasir baru dibuat oleh manajer dari menu Tim.</p>
            </div>
          )}
        </form>
        <p className="login-legal">
          Dengan masuk, Anda menyetujui kebijakan keamanan tempat kerja.
        </p>
      </section>
    </main>
  )
}
