import { useEffect, useMemo, useRef, useState } from "react"

type IconName = "grid" | "orders" | "chart" | "settings" | "search" | "bell" | "plus" | "minus" | "trash" | "chevron" | "close" | "card" | "bag" | "user" | "lock" | "eye"

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    orders: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
        <path d="M10 19h4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3 10h18M7 15h3" />
      </>
    ),
    bag: (
      <>
        <path d="M6 8h12l1 13H5L6 8Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {paths[name]}
      </g>
    </svg>
  )
}

const photos = {
  table:
    "https://images.unsplash.com/photo-1643757343278-5d50309dfa44?auto=format&fit=crop&w=900&q=85",
  pizza:
    "https://images.unsplash.com/photo-1624340209361-bfad6e30dbf4?auto=format&fit=crop&w=900&q=85",
  burger:
    "https://images.unsplash.com/photo-1575367439051-9be800a160d8?auto=format&fit=crop&w=900&q=85",
  greenPizza:
    "https://images.unsplash.com/photo-1622257892554-c162e47a3a5e?auto=format&fit=crop&w=900&q=85",
  feast:
    "https://images.unsplash.com/photo-1653026645442-5dae0f5b9090?auto=format&fit=crop&w=900&q=85",
  wine: "https://images.unsplash.com/photo-1733159680303-1bd3875eb71b?auto=format&fit=crop&w=900&q=85",
  cocktail:
    "https://images.unsplash.com/photo-1756572323135-d242095298ec?auto=format&fit=crop&w=900&q=85",
  pizzas:
    "https://images.unsplash.com/photo-1659367736714-e3f0344a6266?auto=format&fit=crop&w=900&q=85",
}

type Product = {
  id: number
  name: string
  description: string
  price: number
  category: string
  image: string
  tag: string
  active: boolean
}

const initialProducts: Product[] = [
  {
    id: 1,
    name: "Menu 1",
    description: "Gurih banget",
    price: 69000,
    category: "Burger",
    image: photos.burger,
    tag: "Terlaris",
    active: true,
  },
  {
    id: 2,
    name: "Menu 2",
    description: "Mama mia",
    price: 58000,
    category: "Pizza",
    image: photos.pizza,
    tag: "Klasik",
    active: true,
  },
  {
    id: 3,
    name: "Menu 3",
    description: "Sehat banget",
    price: 55000,
    category: "Mangkok",
    image: photos.feast,
    tag: "Nabati",
    active: true,
  },
  {
    id: 4,
    name: "Menu 4",
    description: "Lezatos",
    price: 72000,
    category: "Pizza",
    image: photos.greenPizza,
    tag: "Baru",
    active: true,
  },
  {
    id: 5,
    name: "Menu 5",
    description: "Hola como estas",
    price: 64000,
    category: "Taco",
    image: photos.table,
    tag: "Pilihan koki",
    active: true,
  },
  {
    id: 6,
    name: "Menu 6",
    description: "Seger banget",
    price: 32000,
    category: "Minuman",
    image: photos.cocktail,
    tag: "Tanpa alkohol",
    active: true,
  },
  {
    id: 7,
    name: "Menu 7",
    description: "Kenyang banget",
    price: 85000,
    category: "Pendamping",
    image: photos.wine,
    tag: "Terbatas",
    active: true,
  },
  {
    id: 8,
    name: "Menu 8",
    description: "Rame banget",
    price: 76000,
    category: "Pizza",
    image: photos.pizzas,
    tag: "Untuk berbagi",
    active: true,
  },
]

const categories = [
  "Semua menu",
  "Burger",
  "Pizza",
  "Mangkok",
  "Taco",
  "Pendamping",
  "Minuman",
]
const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})
type View = "kasir" | "pesanan" | "laporan" | "pengaturan" | "akun"

type Cart = Record<number, number>

function WorkspaceView({
  view,
  onBack,
  products,
  onAddProduct,
  onToggleProduct,
  onDeleteProduct,
}: {
  view: Exclude<View, "kasir">
  onBack: () => void
  products: Product[]
  onAddProduct: (product: Product) => void
  onToggleProduct: (id: number) => void
  onDeleteProduct: (id: number) => void
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [productCategory, setProductCategory] = useState("Burger")
  const [image, setImage] = useState("")

  function submitProduct(event: React.FormEvent) {
    event.preventDefault()
    const parsedPrice = Number(price)
    if (!name.trim() || !parsedPrice) return
    onAddProduct({
      id: Date.now(),
      name: name.trim(),
      description: description.trim() || "Menu baru",
      price: parsedPrice,
      category: productCategory,
      image: image || photos.feast,
      tag: "Baru",
      active: true,
    })
    setName("")
    setDescription("")
    setPrice("")
    setImage("")
    setFormOpen(false)
  }

  function readImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result))
    reader.readAsDataURL(file)
  }

  if (view === "pesanan") {
    return (
      <section className="workspace-view">
        <div className="workspace-header">
          <div>
            <span className="eyebrow">Hari ini</span>
            <h2>Pesanan terbaru</h2>
            <p>Pantau semua transaksi yang sedang berjalan.</p>
          </div>
          <button className="workspace-primary" onClick={onBack}>
            <Icon name="plus" size={17} /> Pesanan baru
          </button>
        </div>
        <div className="order-list">
          {[
            ["#2048", "Meja 04", "Sedang disiapkan", 235000],
            ["#2047", "Bawa pulang", "Siap diambil", 128000],
            ["#2046", "Meja 08", "Selesai", 312000],
            ["#2045", "Meja 02", "Selesai", 174000],
          ].map(([number, type, status, total]) => (
            <button className="order-row" key={number}>
              <span className="order-row-icon">
                <Icon name="orders" size={19} />
              </span>
              <span>
                <strong>{number}</strong>
                <small>{type}</small>
              </span>
              <span
                className={`order-status ${
                  status === "Selesai" ? "complete" : ""
                }`}
              >
                {status}
              </span>
              <strong>{rupiah.format(total as number)}</strong>
              <Icon name="chevron" size={17} />
            </button>
          ))}
        </div>
      </section>
    )
  }

  if (view === "laporan") {
    return (
      <section className="workspace-view">
        <div className="workspace-header">
          <div>
            <span className="eyebrow">Dasbor bisnis</span>
            <h2>Ringkasan penjualan</h2>
            <p>Diperbarui beberapa detik yang lalu.</p>
          </div>
          <button className="workspace-secondary">Unduh laporan</button>
        </div>
        <div className="metric-grid">
          <article>
            <span>Total penjualan</span>
            <strong>{rupiah.format(12845000)}</strong>
            <small>↑ 12,4% dari kemarin</small>
          </article>
          <article>
            <span>Total pesanan</span>
            <strong>148</strong>
            <small>↑ 8 pesanan hari ini</small>
          </article>
          <article>
            <span>Rata-rata transaksi</span>
            <strong>{rupiah.format(86791)}</strong>
            <small>↑ 4,2% dari kemarin</small>
          </article>
        </div>
        <div className="chart-card">
          <div>
            <h3>Penjualan per jam</h3>
            <span>09.00 — 22.00</span>
          </div>
          <div className="bar-chart">
            {[28, 38, 31, 54, 68, 45, 78, 61, 84, 72, 92, 58].map(
              (height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ),
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="workspace-view">
      <div className="workspace-header">
        <div>
          <span className="eyebrow">Katalog</span>
          <h2>Kelola menu</h2>
          <p>Tambah, nonaktifkan, atau hapus menu yang dijual.</p>
        </div>
        <button
          className="workspace-primary"
          onClick={() => setFormOpen((current) => !current)}
        >
          <Icon name={formOpen ? "close" : "plus"} size={17} />{" "}
          {formOpen ? "Tutup" : "Tambah menu"}
        </button>
      </div>
      {formOpen && (
        <form className="product-form" onSubmit={submitProduct}>
          <label className="image-upload">
            {image ? (
              <img alt="Pratinjau menu" src={image} />
            ) : (
              <span>
                <Icon name="plus" />
                <strong>Tambah gambar</strong>
                <small>JPG atau PNG</small>
              </span>
            )}
            <input accept="image/*" onChange={readImage} type="file" />
          </label>
          <div className="form-fields">
            <label>
              <span>Nama menu</span>
              <input
                onChange={(event) => setName(event.target.value)}
                placeholder="Contoh: Nasi Goreng Enak"
                required
                value={name}
              />
            </label>
            <label>
              <span>Deskripsi</span>
              <input
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Deskripsi singkat menu"
                value={description}
              />
            </label>
            <div>
              <label>
                <span>Harga</span>
                <input
                  min="1000"
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="50000"
                  required
                  type="number"
                  value={price}
                />
              </label>
              <label>
                <span>Kategori</span>
                <select
                  onChange={(event) => setProductCategory(event.target.value)}
                  value={productCategory}
                >
                  {categories.slice(1).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <button className="save-product" type="submit">
              Simpan menu
            </button>
          </div>
        </form>
      )}
      <div className="manage-list">
        {products.map((product) => (
          <article
            className={!product.active ? "menu-disabled" : ""}
            key={product.id}
          >
            <img alt={product.name} src={product.image} />
            <div>
              <strong>{product.name}</strong>
              <span>
                {product.category} · {rupiah.format(product.price)}
              </span>
            </div>
            <span
              className={
                product.active ? "availability active" : "availability"
              }
            >
              {product.active ? "Aktif" : "Nonaktif"}
            </span>
            <button
              className="toggle-button"
              onClick={() => onToggleProduct(product.id)}
            >
              {product.active ? "Nonaktifkan" : "Aktifkan"}
            </button>
            <button
              aria-label={`Hapus ${product.name}`}
              className="delete-menu"
              onClick={() => onDeleteProduct(product.id)}
            >
              <Icon name="trash" size={18} />
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function AccountSettingsView({
  employeeName,
  shiftName,
  shiftActive,
  onSave,
  onToggleShift,
}: {
  employeeName: string
  shiftName: string
  shiftActive: boolean
  onSave: (name: string, shift: string) => void
  onToggleShift: () => void
}) {
  const [name, setName] = useState(employeeName)
  const [shift, setShift] = useState(shiftName)
  const [saved, setSaved] = useState(false)

  function submitAccount(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || !shift.trim()) return
    onSave(name.trim(), shift.trim())
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }

  return (
    <section className="workspace-view">
      <div className="workspace-header account-header">
        <div>
          <span className="eyebrow">Profil pekerja</span>
          <h2>Pengaturan akun</h2>
          <p>Kelola identitas kasir dan status shift yang sedang berjalan.</p>
        </div>
        <span
          className={`shift-status ${shiftActive ? "shift-status-active" : ""}`}
        >
          <i></i>
          {shiftActive ? "Shift aktif" : "Shift nonaktif"}
        </span>
      </div>

      <div className="account-layout">
        <form className="account-card" onSubmit={submitAccount}>
          <div className="account-card-heading">
            <div className="account-avatar">
              {employeeName
                .split(" ")
                .map((word) => word[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h3>Informasi pekerja</h3>
              <p>Informasi ini tampil pada profil kasir.</p>
            </div>
          </div>
          <label>
            <span>Nama lengkap</span>
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="Nama pekerja"
              required
              value={name}
            />
          </label>
          <label>
            <span>Nama shift / jabatan</span>
            <input
              onChange={(event) => setShift(event.target.value)}
              placeholder="Contoh: Kasir · Shift malam"
              required
              value={shift}
            />
          </label>
          <button className={saved ? "account-save saved" : "account-save"}>
            {saved ? "Perubahan tersimpan" : "Simpan perubahan"}
          </button>
        </form>

        <aside className="shift-card">
          <span className="shift-card-icon">
            <Icon name="orders" size={21} />
          </span>
          <div>
            <span className="eyebrow">Kontrol shift</span>
            <h3>{shiftActive ? "Shift sedang aktif" : "Shift telah dinonaktifkan"}</h3>
            <p>
              {shiftActive
                ? "Anda masih dapat menerima dan memproses transaksi."
                : "Aktifkan kembali shift untuk mulai menerima transaksi."}
            </p>
          </div>
          <button
            className={shiftActive ? "end-shift-button" : "start-shift-button"}
            onClick={onToggleShift}
          >
            {shiftActive ? "Nonaktifkan shift" : "Aktifkan shift"}
          </button>
          <small>
            Status shift pada versi ini disimpan selama aplikasi masih terbuka.
          </small>
        </aside>
      </div>
    </section>
  )
}

function LoginView({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("kasir@nextgen.id")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function submitLogin(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    if (!email.includes("@")) {
      setError("Masukkan alamat email yang valid.")
      return
    }
    if (password.length < 6) {
      setError("Kata sandi minimal 6 karakter.")
      return
    }
    setLoading(true)
    window.setTimeout(onLogin, 650)
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
        <form className="login-form" onSubmit={submitLogin}>
          <div className="login-heading">
            <span className="eyebrow">Akses pekerja</span>
            <h2>Selamat datang kembali</h2>
            <p>Masuk menggunakan akun pekerja yang telah terdaftar.</p>
          </div>

          <label className="login-field">
            <span>Email pekerja</span>
            <div>
              <Icon name="user" size={18} />
              <input
                autoComplete="email"
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
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan kata sandi"
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

          <div className="login-options">
            <label>
              <input
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                type="checkbox"
              />
              <span>Ingat perangkat ini</span>
            </label>
            <button
              onClick={() =>
                setError("Hubungi admin untuk mengatur ulang kata sandi.")
              }
              type="button"
            >
              Lupa kata sandi?
            </button>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="login-submit" disabled={loading} type="submit">
            <span>{loading ? "Memverifikasi..." : "Masuk ke NEXT"}</span>
            {!loading && <Icon name="chevron" size={18} />}
          </button>

          <div className="demo-account">
            <span>Akun demo</span>
            <p>
              Email <strong>kasir@nextgen.id</strong> · gunakan kata sandi apa pun
              minimal 6 karakter.
            </p>
          </div>
        </form>
        <p className="login-legal">
          Dengan masuk, Anda menyetujui kebijakan keamanan tempat kerja.
        </p>
      </section>
    </main>
  )
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [category, setCategory] = useState("Semua menu")
  const [view, setView] = useState<View>("kasir")
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [query, setQuery] = useState("")
  const [cart, setCart] = useState<Cart>({ 1: 1, 6: 2 })
  const [cartOpen, setCartOpen] = useState(false)
  const [paid, setPaid] = useState(false)
  const [orderType, setOrderType] = useState<"Makan di tempat" | "Bawa pulang">(
    "Makan di tempat",
  )
  const [guestCount, setGuestCount] = useState(4)
  const [orderTypeOpen, setOrderTypeOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(2)
  const [message, setMessage] = useState("")
  const [employeeName, setEmployeeName] = useState("Andi Maulana")
  const [shiftName, setShiftName] = useState("Kasir · Shift malam")
  const [shiftActive, setShiftActive] = useState(true)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const employeeInitials = employeeName
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => setMessage(""), 2400)
    return () => window.clearTimeout(timeout)
  }, [message])

  const filtered = products.filter((product) => {
    const inCategory =
      category === "Semua menu" || product.category === category
    return (
      product.active &&
      inCategory &&
      `${product.name} ${product.description}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
  })

  const cartItems = products.filter((product) => cart[product.id])
  const itemCount = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0,
  )
  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, product) => sum + product.price * cart[product.id],
        0,
      ),
    [cart, cartItems],
  )
  const tax = subtotal * 0.11

  if (!authenticated) {
    return <LoginView onLogin={() => setAuthenticated(true)} />
  }

  function updateCart(id: number, change: number) {
    setPaid(false)
    setCart((current) => {
      const nextQuantity = (current[id] || 0) + change
      const next = { ...current }
      if (nextQuantity <= 0) delete next[id]
      else next[id] = nextQuantity
      return next
    })
  }

  function deleteProduct(id: number) {
    setProducts((current) => current.filter((product) => product.id !== id))
    setCart((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function OrderPanel() {
    return (
      <aside className={`order-panel ${cartOpen ? "order-panel-open" : ""}`}>
        <div className="order-heading">
          <div>
            <span className="eyebrow">Pesanan aktif</span>
            <div className="order-title-row">
              <h2>Meja 04</h2>
              <span className="order-number">#2048</span>
            </div>
          </div>
          <button
            aria-label="Tutup pesanan"
            className="icon-button mobile-only"
            onClick={() => setCartOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="order-type-wrap">
          <button
            aria-expanded={orderTypeOpen}
            className="order-type"
            onClick={() => setOrderTypeOpen((current) => !current)}
          >
            <span className="order-type-icon">
              <Icon name="bag" size={18} />
            </span>
            <span>
              <strong>{orderType}</strong>
              <small>
                {orderType === "Makan di tempat"
                  ? `${guestCount} tamu`
                  : "Pesanan dibungkus"}
              </small>
            </span>
            <Icon name="chevron" size={18} />
          </button>
          {orderTypeOpen && (
            <div className="order-type-menu">
              <span className="popover-label">Tipe pesanan</span>
              {(["Makan di tempat", "Bawa pulang"] as const).map((type) => (
                <button
                  className={orderType === type ? "selected" : ""}
                  key={type}
                  onClick={() => {
                    setOrderType(type)
                    if (type === "Bawa pulang") setOrderTypeOpen(false)
                  }}
                >
                  <span>
                    <strong>{type}</strong>
                    <small>
                      {type === "Makan di tempat"
                        ? "Pesanan untuk meja"
                        : "Pesanan untuk dibawa"}
                    </small>
                  </span>
                  {orderType === type && <i>✓</i>}
                </button>
              ))}
              {orderType === "Makan di tempat" && (
                <div className="guest-picker">
                  <span>Jumlah tamu</span>
                  <div className="stepper">
                    <button
                      aria-label="Kurangi jumlah tamu"
                      disabled={guestCount === 1}
                      onClick={() =>
                        setGuestCount((current) => Math.max(1, current - 1))
                      }
                    >
                      <Icon name="minus" size={14} />
                    </button>
                    <strong>{guestCount}</strong>
                    <button
                      aria-label="Tambah jumlah tamu"
                      onClick={() => setGuestCount((current) => current + 1)}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                </div>
              )}
              <button
                className="confirm-order-type"
                onClick={() => setOrderTypeOpen(false)}
              >
                Terapkan
              </button>
            </div>
          )}
        </div>

        <div className="cart-items">
          {cartItems.length ? (
            cartItems.map((product) => (
              <div className="cart-item" key={product.id}>
                <img alt="" src={product.image} />
                <div className="cart-item-main">
                  <div className="cart-item-top">
                    <div>
                      <h3>{product.name}</h3>
                      <span>{rupiah.format(product.price)}</span>
                    </div>
                    <button
                      aria-label={`Hapus ${product.name}`}
                      className="delete-button"
                      onClick={() => updateCart(product.id, -cart[product.id])}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                  <div className="stepper">
                    <button
                      aria-label={`Kurangi ${product.name}`}
                      onClick={() => updateCart(product.id, -1)}
                    >
                      <Icon name="minus" size={14} />
                    </button>
                    <span>{cart[product.id]}</span>
                    <button
                      aria-label={`Tambah ${product.name}`}
                      onClick={() => updateCart(product.id, 1)}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-cart">
              <Icon name="bag" size={28} />
              <strong>Pesanan masih kosong</strong>
              <span>Tambahkan menu untuk memulai.</span>
            </div>
          )}
        </div>

        <div className="checkout">
          <button className="discount-button">
            <span>Tambah diskon</span>
            <Icon name="chevron" size={17} />
          </button>
          <div className="totals">
            <div>
              <span>Subtotal</span>
              <strong>{rupiah.format(subtotal)}</strong>
            </div>
            <div>
              <span>Pajak</span>
              <strong>{rupiah.format(tax)}</strong>
            </div>
            <div className="total">
              <span>Total</span>
              <strong>{rupiah.format(subtotal + tax)}</strong>
            </div>
          </div>
          <button
            className={`pay-button ${paid ? "pay-button-success" : ""}`}
            disabled={!itemCount}
            onClick={() => setPaid(true)}
          >
            <span className="pay-icon">
              <Icon name={paid ? "bag" : "card"} size={20} />
            </span>
            <span>{paid ? "Pesanan terkirim" : "Bayar"}</span>
            <strong>{rupiah.format(subtotal + tax)}</strong>
          </button>
        </div>
      </aside>
    )
  }

  return (
    <div className="app-shell">
      <nav aria-label="Navigasi utama" className="side-nav">
        <div className="brand-mark">
          <span>N</span>
        </div>
        <div className="nav-group">
          <button
            aria-label="Kasir"
            className={`nav-button ${view === "kasir" ? "active" : ""}`}
            onClick={() => setView("kasir")}
          >
            <Icon name="grid" />
          </button>
          <button
            aria-label="Pesanan"
            className={`nav-button ${view === "pesanan" ? "active" : ""}`}
            onClick={() => setView("pesanan")}
          >
            <Icon name="orders" />
          </button>
          <button
            aria-label="Dasbor"
            className={`nav-button ${view === "laporan" ? "active" : ""}`}
            onClick={() => setView("laporan")}
          >
            <Icon name="chart" />
          </button>
        </div>
        <button
          aria-label="Kelola menu"
          className={`nav-button nav-settings ${
            view === "pengaturan" ? "active" : ""
          }`}
          onClick={() => setView("pengaturan")}
        >
          <Icon name="settings" />
        </button>
        <div className="profile-wrap">
          <button
            aria-expanded={profileOpen}
            aria-label="Buka profil"
            className="avatar"
            onClick={() => setProfileOpen((current) => !current)}
          >
            {employeeInitials}
            {shiftActive && <span></span>}
          </button>
          {profileOpen && (
            <div className="profile-menu">
              <div className="profile-summary">
                <span>{employeeInitials}</span>
                <div>
                  <strong>{employeeName}</strong>
                  <small>{shiftName}</small>
                </div>
              </div>
              <button
                onClick={() => {
                  setView("akun")
                  setProfileOpen(false)
                }}
              >
                <Icon name="settings" size={17} />
                Pengaturan akun
              </button>
              <button
                onClick={() => {
                  setMessage(
                    shiftActive ? "Shift Anda masih aktif" : "Shift sedang nonaktif",
                  )
                  setProfileOpen(false)
                }}
              >
                <Icon name="orders" size={17} />
                Status shift
              </button>
              <button
                className="logout-button"
                onClick={() => {
                  setProfileOpen(false)
                  setAuthenticated(false)
                }}
              >
                Keluar
              </button>
            </div>
          )}
        </div>
      </nav>

      <main
        className={`menu-panel ${view !== "kasir" ? "menu-panel-full" : ""}`}
      >
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark">
              <span>N</span>
            </div>
            <strong>NEXT</strong>
          </div>
          <div className="greeting">
            <span className="eyebrow">Selasa, 14 Mei</span>
            <h1>
              {view === "kasir"
                ? "Selamat malam, NextGen Coders."
                : view === "pesanan"
                  ? "Daftar pesanan"
                  : view === "laporan"
                    ? "Ringkasan penjualan"
                    : view === "pengaturan"
                      ? "Kelola menu"
                      : "Pengaturan akun"}
            </h1>
          </div>
          <div className="top-actions">
            <label className="search">
              <Icon name="search" size={19} />
              <input
                aria-label="Cari menu"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={view === "kasir" ? "Cari menu..." : "Cari..."}
                ref={searchInputRef}
                value={query}
              />
              <kbd title="Tekan Command atau Control + K untuk mencari">
                ⌘ K
              </kbd>
            </label>
            <div className="notification-wrap">
              <button
                aria-expanded={notificationsOpen}
                aria-label={`Notifikasi, ${unreadNotifications} belum dibaca`}
                className="icon-button notification"
                onClick={() => setNotificationsOpen((current) => !current)}
              >
                <Icon name="bell" />
                {unreadNotifications > 0 && <span></span>}
              </button>
              {notificationsOpen && (
                <div className="notification-menu">
                  <div className="popover-heading">
                    <div>
                      <strong>Notifikasi</strong>
                      <small>{unreadNotifications} belum dibaca</small>
                    </div>
                    <button onClick={() => setUnreadNotifications(0)}>
                      Tandai dibaca
                    </button>
                  </div>
                  <button className={unreadNotifications ? "unread" : ""}>
                    <span className="notification-symbol">
                      <Icon name="orders" size={17} />
                    </span>
                    <span>
                      <strong>Pesanan #2047 siap</strong>
                      <small>Siap diserahkan ke pelanggan · 2 menit lalu</small>
                    </span>
                  </button>
                  <button className={unreadNotifications ? "unread" : ""}>
                    <span className="notification-symbol">
                      <Icon name="bag" size={17} />
                    </span>
                    <span>
                      <strong>Stok hampir habis</strong>
                      <small>Orbit Margherita tersisa 4 porsi · 8 menit lalu</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
            <div className="mobile-profile-wrap">
              <button
                aria-expanded={profileOpen}
                aria-label="Buka profil"
                className="mobile-profile-button"
                onClick={() => setProfileOpen((current) => !current)}
              >
                {employeeInitials}
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-summary">
                    <span>{employeeInitials}</span>
                    <div>
                      <strong>{employeeName}</strong>
                      <small>{shiftName}</small>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setView("akun")
                      setProfileOpen(false)
                    }}
                  >
                    <Icon name="settings" size={17} />
                    Pengaturan akun
                  </button>
                  <button
                    onClick={() => {
                      setMessage(
                        shiftActive
                          ? "Shift Anda masih aktif"
                          : "Shift sedang nonaktif",
                      )
                      setProfileOpen(false)
                    }}
                  >
                    <Icon name="orders" size={17} />
                    Status shift
                  </button>
                  <button
                    className="logout-button"
                    onClick={() => {
                      setProfileOpen(false)
                      setAuthenticated(false)
                    }}
                  >
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <nav aria-label="Navigasi seluler" className="mobile-view-nav">
          {([
            ["kasir", "Kasir", "grid"],
            ["pesanan", "Pesanan", "orders"],
            ["laporan", "Dasbor", "chart"],
            ["pengaturan", "Menu", "settings"],
          ] as [View, string, IconName][]).map(([itemView, label, icon]) => (
            <button
              className={view === itemView ? "active" : ""}
              key={itemView}
              onClick={() => setView(itemView)}
            >
              <Icon name={icon} size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {view === "kasir" ? (
          <section className="menu-content">
            <div className="section-heading">
              <div>
                <h2>Pilih menu</h2>
                <p>{filtered.length} menu siap dipesan</p>
              </div>
              <span className="status-pill">
                <i></i> Dapur aktif
              </span>
            </div>

            <div className="categories">
              {categories.map((item) => (
                <button
                  className={category === item ? "category active" : "category"}
                  key={item}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="product-grid">
              {filtered.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-image">
                    <img alt={product.name} src={product.image} />
                    <span>{product.tag}</span>
                    <button
                      aria-label={`Tambah ${product.name}`}
                      onClick={() => updateCart(product.id, 1)}
                    >
                      <Icon name="plus" size={19} />
                    </button>
                  </div>
                  <div className="product-info">
                    <div>
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                    </div>
                    <strong>{rupiah.format(product.price)}</strong>
                  </div>
                </article>
              ))}
            </div>

            {!filtered.length && (
              <div className="no-results">
                <Icon name="search" size={28} />
                <h3>Menu tidak ditemukan</h3>
                <p>Coba kata kunci atau kategori lain.</p>
              </div>
            )}
          </section>
        ) : view === "akun" ? (
          <AccountSettingsView
            employeeName={employeeName}
            onSave={(name, shift) => {
              setEmployeeName(name)
              setShiftName(shift)
            }}
            onToggleShift={() => {
              setShiftActive((current) => !current)
              setMessage(
                shiftActive
                  ? "Shift berhasil dinonaktifkan"
                  : "Shift berhasil diaktifkan",
              )
            }}
            shiftActive={shiftActive}
            shiftName={shiftName}
          />
        ) : (
          <WorkspaceView
            onAddProduct={(product) =>
              setProducts((current) => [product, ...current])
            }
            onBack={() => setView("kasir")}
            onDeleteProduct={deleteProduct}
            onToggleProduct={(id) =>
              setProducts((current) =>
                current.map((product) =>
                  product.id === id
                    ? { ...product, active: !product.active }
                    : product,
                ),
              )
            }
            products={products}
            view={view}
          />
        )}
      </main>

      {view === "kasir" && <OrderPanel />}

      {view === "kasir" && cartOpen && (
        <button
          aria-label="Tutup keranjang"
          className="cart-backdrop"
          onClick={() => setCartOpen(false)}
        />
      )}
      {view === "kasir" && (
        <button className="mobile-cart" onClick={() => setCartOpen(true)}>
          <span className="cart-count">{itemCount}</span>
          <span>Lihat pesanan</span>
          <strong>{rupiah.format(subtotal + tax)}</strong>
        </button>
      )}
      {message && (
        <div aria-live="polite" className="toast" role="status">
          {message}
        </div>
      )}
    </div>
  )
}
