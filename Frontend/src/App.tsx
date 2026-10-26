import { useEffect, useMemo, useRef, useState } from "react"
import "./features.css"
import "./motion.css"
import { AuthView } from "./AuthView"
import { Icon, type IconName } from "./Icon"
import { TeamView } from "./TeamView"
import { isMuted, playChing, playSound, setMuted, soundForTarget } from "./lib/sound"
import { formatRelative, formatTime, initials, rupiah } from "./lib/format"
import { OrdersView, ReportView } from "./SalesViews"
import {
  activeShift,
  currentAccount,
  currentShiftStats,
  endShift,
  ensureSeed,
  listCashiers,
  listShifts,
  listTransactions,
  logout as logoutAccount,
  nextOrderNumber,
  recordTransaction,
  startShift,
  updateProfile,
  useStoreVersion,
  type Account,
  type Role,
} from "./lib/store"

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
type View = "tim" | "kasir" | "pesanan" | "laporan" | "pengaturan" | "akun"

/* Which screens each role may open. The first entry is the landing screen. */
const VIEWS_BY_ROLE: Record<Role, View[]> = {
  manager: ["tim", "pesanan", "laporan", "pengaturan", "akun"],
  cashier: ["kasir", "pesanan", "akun"],
}

const NAV_ITEMS: { view: View; label: string; icon: IconName; short: string }[] = [
  { view: "tim", label: "Tim kasir", icon: "users", short: "Tim" },
  { view: "kasir", label: "Kasir", icon: "grid", short: "Kasir" },
  { view: "pesanan", label: "Pesanan", icon: "orders", short: "Pesanan" },
  { view: "laporan", label: "Dasbor", icon: "chart", short: "Dasbor" },
  { view: "pengaturan", label: "Kelola menu", icon: "settings", short: "Menu" },
]

type Cart = Record<number, number>
type Discount = { type: "percent" | "amount"; value: number }
type Notice = {
  id: string
  icon: IconName
  title: string
  detail: string
  at: number
  view: View
}

const SEARCH_PLACEHOLDER: Partial<Record<View, string>> = {
  kasir: "Cari menu...",
  pesanan: "Cari pesanan...",
  tim: "Cari kasir...",
  pengaturan: "Cari menu...",
}

function WorkspaceView({
  products,
  query,
  onAddProduct,
  onToggleProduct,
  onDeleteProduct,
}: {
  products: Product[]
  query: string
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
        {products
          .filter((product) =>
            `${product.name} ${product.category} ${product.description}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
          )
          .map((product) => (
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
  isManager,
  onSave,
  onToggleShift,
}: {
  employeeName: string
  shiftName: string
  shiftActive: boolean
  isManager: boolean
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
          <p>
            {isManager
              ? "Kelola identitas dan jabatan Anda."
              : "Kelola identitas kasir dan status shift yang sedang berjalan."}
          </p>
        </div>
        {!isManager && (
          <span
            className={`shift-status ${shiftActive ? "shift-status-active" : ""}`}
          >
            <i></i>
            {shiftActive ? "Shift aktif" : "Shift nonaktif"}
          </span>
        )}
      </div>

      <div
        className="account-layout"
        style={isManager ? { gridTemplateColumns: "minmax(0, 640px)" } : undefined}
      >
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

        {!isManager && (
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
        )}
      </div>
    </section>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [account, setAccount] = useState<Account | null>(null)
  const [category, setCategory] = useState("Semua menu")
  const [requestedView, setView] = useState<View>("kasir")
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [query, setQuery] = useState("")
  const [cart, setCart] = useState<Cart>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [paid, setPaid] = useState(false)
  const [orderType, setOrderType] = useState<"Makan di tempat" | "Bawa pulang">(
    "Makan di tempat",
  )
  const [guestCount, setGuestCount] = useState(4)
  const [orderTypeOpen, setOrderTypeOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(0)
  const [soundMuted, setSoundMuted] = useState(isMuted)
  const [discount, setDiscount] = useState<Discount | null>(null)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountType, setDiscountType] = useState<Discount["type"]>("percent")
  const [discountValue, setDiscountValue] = useState("")
  const [message, setMessage] = useState("")
  const [paying, setPaying] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  // re-render when accounts / shifts change (also from other browser tabs)
  const storeVersion = useStoreVersion()

  // The cashier's shift lives in the data layer, so the manager sees it too.
  // Managers do not work shifts.
  const shiftRecord =
    account && account.role === "cashier" ? activeShift(account.id) : null
  const shiftActive = account?.role === "manager" ? true : !!shiftRecord
  const orderNumber = useMemo(() => nextOrderNumber(), [storeVersion])
  const transactions = useMemo(
    () =>
      account
        ? listTransactions(
            account.role === "cashier" ? { cashierId: account.id } : undefined,
          )
        : [],
    [storeVersion, account],
  )
  const names = useMemo(() => {
    const map: Record<string, string> = {}
    listCashiers().forEach((cashier) => {
      map[cashier.id] = cashier.name
    })
    if (account) map[account.id] = account.name
    return map
  }, [storeVersion, account])

  const employeeName = account?.name ?? ""
  const shiftName = account?.title ?? ""
  const employeeInitials = initials(employeeName)
  const role: Role = account?.role ?? "cashier"
  const allowedViews = VIEWS_BY_ROLE[role]
  // a view the role may not open falls back to its landing screen
  const view: View = allowedViews.includes(requestedView)
    ? requestedView
    : allowedViews[0]

  useEffect(() => {
    let cancelled = false
    ensureSeed().then(() => {
      if (cancelled) return
      setAccount(currentAccount())
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // if the signed-in account is removed or deactivated (e.g. from another tab), sign out
  useEffect(() => {
    if (ready && account && !currentAccount()) setAccount(null)
  }, [ready, account, storeVersion])

  function handleAuthenticated(next: Account) {
    // signing in as a cashier clocks them in
    if (next.role === "cashier") startShift(next.id)
    setAccount(next)
    setView(VIEWS_BY_ROLE[next.role][0])
    setCart({})
    setDiscount(null)
    setPaid(false)
    setPaying(false)
  }

  function handleLogout() {
    // signing out clocks the cashier out
    if (account?.role === "cashier") endShift(account.id)
    setCart({})
    setDiscount(null)
    setPaid(false)
    setPaying(false)
    logoutAccount()
    setProfileOpen(false)
    setNotificationsOpen(false)
    setMessage("")
    setAccount(null)
  }

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
  const discountAmount = discount
    ? Math.min(
        subtotal,
        discount.type === "percent"
          ? Math.round((subtotal * discount.value) / 100)
          : discount.value,
      )
    : 0
  const discountLabel = discount
    ? discount.type === "percent"
      ? `${String(discount.value).replace(".", ",")}%`
      : rupiah.format(discount.value)
    : ""
  const taxable = subtotal - discountAmount
  const tax = taxable * 0.11
  const total = taxable + tax

  // a discount belongs to one order: drop it when the cart is emptied
  useEffect(() => {
    if (!itemCount) {
      setDiscount(null)
      setDiscountOpen(false)
    }
  }, [itemCount])

  // notifications are built from real activity in the last 24 hours
  const notices = useMemo<Notice[]>(() => {
    if (!account) return []
    const since = Date.now() - 86_400_000
    const list: Notice[] = transactions
      .filter((tx) => tx.at >= since)
      .slice(0, 6)
      .map((tx) => ({
        id: tx.id,
        icon: "orders" as IconName,
        title: `Pesanan #${tx.number} dibayar`,
        detail: `${rupiah.format(tx.total)}${
          account.role === "manager" ? ` · ${names[tx.cashierId] ?? "Kasir"}` : ""
        }`,
        at: tx.at,
        view: "pesanan" as View,
      }))
    if (account.role === "manager") {
      listShifts(since)
        .filter((shift) => shift.startedAt >= since)
        .slice(0, 6)
        .forEach((shift) =>
          list.push({
            id: `shift-${shift.id}`,
            icon: "clock",
            title: `${names[shift.cashierId] ?? "Kasir"} memulai shift`,
            detail: shift.endedAt
              ? `Selesai ${formatTime(shift.endedAt)}`
              : "Sedang bertugas",
            at: shift.startedAt,
            view: "tim",
          }),
        )
    }
    return list.sort((a, b) => b.at - a.at).slice(0, 8)
  }, [transactions, names, account, storeVersion])
  const unread = notices.filter((notice) => notice.at > lastSeen).length
  const seenKey = account ? `nextpos.seen.${account.id}` : ""

  useEffect(() => {
    if (!seenKey) return
    try {
      setLastSeen(Number(localStorage.getItem(seenKey)) || 0)
    } catch {
      setLastSeen(0)
    }
  }, [seenKey])

  // search belongs to one screen: start fresh when the screen changes
  useEffect(() => {
    setQuery("")
  }, [view])

  // one delegated listener gives every button a soft tap sound
  useEffect(() => {
    function onPress(event: PointerEvent) {
      if (event.button !== 0) return
      const kind = soundForTarget(event.target as Element | null)
      if (kind && kind !== "none") playSound(kind)
    }
    document.addEventListener("pointerdown", onPress, true)
    return () => document.removeEventListener("pointerdown", onPress, true)
  }, [])

  // close menus when clicking elsewhere or pressing Escape
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      const target = event.target as Element | null
      const inside = (selector: string) => !!target?.closest(selector)
      if (!inside(".notification-wrap")) setNotificationsOpen(false)
      if (!inside(".profile-wrap, .mobile-profile-wrap")) setProfileOpen(false)
      if (!inside(".order-type-wrap")) setOrderTypeOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      setNotificationsOpen(false)
      setProfileOpen(false)
      setOrderTypeOpen(false)
      setDiscountOpen(false)
    }
    document.addEventListener("pointerdown", closeOutside)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOutside)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [])

  if (!ready) return null
  if (!account) return <AuthView onAuthenticated={handleAuthenticated} />

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

  function toggleShift() {
    if (!account || account.role !== "cashier") return
    if (shiftActive) {
      endShift(account.id)
      setMessage("Shift berhasil dinonaktifkan")
    } else {
      startShift(account.id)
      setMessage("Shift berhasil diaktifkan")
    }
  }

  function showShiftStatus() {
    setProfileOpen(false)
    if (!account || account.role === "manager") {
      setMessage("Manajer tidak memiliki shift. Lihat kinerja kasir di menu Tim")
      return
    }
    const stats = currentShiftStats(account.id)
    setMessage(
      stats
        ? `Shift sejak ${formatTime(stats.shift.startedAt)} · ${stats.orders} pesanan · ${rupiah.format(stats.sales)}`
        : "Shift sedang nonaktif",
    )
  }

  function handlePay() {
    if (!account || paying || !itemCount) return
    if (account.role === "cashier") {
      const result = recordTransaction({
        cashierId: account.id,
        items: itemCount,
        subtotal,
        discount: discountAmount,
        tax,
        orderType,
      })
      if (!result.ok) {
        playSound("error")
        setMessage(result.error)
        return
      }
      setMessage(`Pembayaran #${result.value.number} berhasil`)
    }
    playChing()
    setPaid(true)
    setPaying(true)
    // keep the success state visible for a moment, then start a fresh order
    window.setTimeout(() => {
      setCart({})
      setDiscount(null)
      setPaid(false)
      setPaying(false)
      setCartOpen(false)
    }, 1500)
  }

  function toggleSound() {
    const next = !soundMuted
    setMuted(next)
    setSoundMuted(next)
    if (!next) playSound("success")
    setMessage(next ? "Suara dimatikan" : "Suara dihidupkan")
  }

  function markSeen() {
    const now = Date.now()
    setLastSeen(now)
    try {
      localStorage.setItem(seenKey, String(now))
    } catch {
      /* storage blocked: unread state lasts until reload */
    }
  }

  function applyDiscount(type: Discount["type"], raw: number) {
    if (!Number.isFinite(raw) || raw <= 0) {
      setMessage("Masukkan nilai diskon yang valid")
      return
    }
    if (type === "percent" && raw > 100) {
      setMessage("Diskon maksimal 100%")
      return
    }
    const value = type === "amount" ? Math.round(raw) : Math.round(raw * 10) / 10
    setDiscount({ type, value })
    setDiscountOpen(false)
    setDiscountValue("")
    setMessage(
      `Diskon ${type === "percent" ? `${value}%` : rupiah.format(value)} diterapkan`,
    )
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
              <span className="order-number">#{orderNumber}</span>
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
          <button
            aria-expanded={discountOpen}
            className={`discount-button ${discount ? "has-discount" : ""}`}
            disabled={!itemCount}
            onClick={() => setDiscountOpen((current) => !current)}
          >
            <span>{discount ? `Diskon ${discountLabel}` : "Tambah diskon"}</span>
            {discount ? (
              <strong>-{rupiah.format(discountAmount)}</strong>
            ) : (
              <Icon name="percent" size={17} />
            )}
          </button>
          {discountOpen && (
            <div className="discount-panel">
              <div className="discount-presets">
                {[5, 10, 15, 20].map((percent) => (
                  <button
                    className={
                      discount?.type === "percent" && discount.value === percent
                        ? "active"
                        : ""
                    }
                    key={percent}
                    onClick={() => applyDiscount("percent", percent)}
                    type="button"
                  >
                    {percent}%
                  </button>
                ))}
              </div>
              <form
                className="discount-custom"
                onSubmit={(event) => {
                  event.preventDefault()
                  applyDiscount(discountType, Number(discountValue))
                }}
              >
                <select
                  aria-label="Jenis diskon"
                  name="discount-type"
                  onChange={(event) =>
                    setDiscountType(event.target.value as Discount["type"])
                  }
                  value={discountType}
                >
                  <option value="percent">%</option>
                  <option value="amount">Rp</option>
                </select>
                <input
                  aria-label="Nilai diskon"
                  inputMode="decimal"
                  min="0"
                  name="discount-value"
                  onChange={(event) => setDiscountValue(event.target.value)}
                  placeholder={
                    discountType === "percent" ? "Contoh: 12" : "Contoh: 10000"
                  }
                  type="number"
                  value={discountValue}
                />
                <button type="submit">Terapkan</button>
              </form>
              {discount && (
                <button
                  className="discount-remove"
                  onClick={() => {
                    setDiscount(null)
                    setDiscountOpen(false)
                    setMessage("Diskon dihapus")
                  }}
                  type="button"
                >
                  Hapus diskon
                </button>
              )}
            </div>
          )}
          <div className="totals">
            <div>
              <span>Subtotal</span>
              <strong>{rupiah.format(subtotal)}</strong>
            </div>
            {discountAmount > 0 && (
              <div className="discount-row">
                <span>Diskon</span>
                <strong>-{rupiah.format(discountAmount)}</strong>
              </div>
            )}
            <div>
              <span>Pajak</span>
              <strong>{rupiah.format(tax)}</strong>
            </div>
            <div className="total">
              <span>Total</span>
              <strong>{rupiah.format(total)}</strong>
            </div>
          </div>
          {!shiftActive && (
            <div className="shift-warning" role="status">
              <span>Shift nonaktif. Aktifkan shift untuk menerima pembayaran.</span>
              <button onClick={toggleShift} type="button">
                Aktifkan shift
              </button>
            </div>
          )}
          <button
            className={`pay-button ${paid ? "pay-button-success" : ""}`}
            data-sound="none"
            disabled={!itemCount || !shiftActive || paying}
            onClick={handlePay}
          >
            <span className="pay-icon">
              <Icon name={paid ? "check" : "card"} size={20} />
            </span>
            <span>{paid ? "Pembayaran berhasil" : "Bayar"}</span>
            <strong>{rupiah.format(total)}</strong>
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
          {NAV_ITEMS.filter(
            (item) => item.view !== "pengaturan" && allowedViews.includes(item.view),
          ).map((item) => (
            <button
              aria-label={item.label}
              className={`nav-button ${view === item.view ? "active" : ""}`}
              key={item.view}
              onClick={() => setView(item.view)}
              title={item.label}
            >
              <Icon name={item.icon} />
            </button>
          ))}
        </div>
        <div className="nav-spacer" />
        {allowedViews.includes("pengaturan") && (
          <button
            aria-label="Kelola menu"
            className={`nav-button nav-settings ${
              view === "pengaturan" ? "active" : ""
            }`}
            onClick={() => setView("pengaturan")}
            title="Kelola menu"
          >
            <Icon name="settings" />
          </button>
        )}
        <div className="profile-wrap">
          <button
            aria-expanded={profileOpen}
            aria-label="Buka profil"
            className="avatar"
            onClick={() => setProfileOpen((current) => !current)}
          >
            {employeeInitials}
            {(role === "manager" || shiftActive) && <span></span>}
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
                onClick={showShiftStatus}
              >
                <Icon name="orders" size={17} />
                Status shift
              </button>
              <button onClick={toggleSound} data-sound="none">
                <Icon name={soundMuted ? "mute" : "volume"} size={17} />
                {soundMuted ? "Suara: mati" : "Suara: hidup"}
              </button>
              <button
                className="logout-button"
                onClick={handleLogout}
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
            <span className="eyebrow">
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
            <h1>
              {view === "kasir"
                ? `Halo, ${employeeName.split(" ")[0]}.`
                : view === "tim"
                  ? "Tim kasir"
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
            {SEARCH_PLACEHOLDER[view] && (
              <label className="search">
                <Icon name="search" size={19} />
                <input
                  aria-label={SEARCH_PLACEHOLDER[view]?.replace("...", "")}
                  name="search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={SEARCH_PLACEHOLDER[view]}
                  ref={searchInputRef}
                  value={query}
                />
                <kbd title="Tekan Command atau Control + K untuk mencari">
                  ⌘ K
                </kbd>
              </label>
            )}
            <div className="notification-wrap">
              <button
                aria-expanded={notificationsOpen}
                aria-label={`Notifikasi, ${unread} belum dibaca`}
                className="icon-button notification"
                onClick={() => setNotificationsOpen((current) => !current)}
              >
                <Icon name="bell" />
                {unread > 0 && <span></span>}
              </button>
              {notificationsOpen && (
                <div className="notification-menu">
                  <div className="popover-heading">
                    <div>
                      <strong>Notifikasi</strong>
                      <small>{unread} belum dibaca</small>
                    </div>
                    <button disabled={!unread} onClick={markSeen}>
                      Tandai dibaca
                    </button>
                  </div>
                  {notices.length === 0 && (
                    <p className="notification-empty">
                      Belum ada aktivitas dalam 24 jam terakhir.
                    </p>
                  )}
                  {notices.map((notice) => (
                    <button
                      className={notice.at > lastSeen ? "unread" : ""}
                      key={notice.id}
                      onClick={() => {
                        markSeen()
                        setNotificationsOpen(false)
                        setView(notice.view)
                      }}
                    >
                      <span className="notification-symbol">
                        <Icon name={notice.icon} size={17} />
                      </span>
                      <span>
                        <strong>{notice.title}</strong>
                        <small>
                          {notice.detail} · {formatRelative(notice.at)}
                        </small>
                      </span>
                    </button>
                  ))}
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
                    onClick={showShiftStatus}
                  >
                    <Icon name="orders" size={17} />
                    Status shift
                  </button>
                  <button onClick={toggleSound} data-sound="none">
                    <Icon name={soundMuted ? "mute" : "volume"} size={17} />
                    {soundMuted ? "Suara: mati" : "Suara: hidup"}
                  </button>
                  <button
                    className="logout-button"
                    onClick={handleLogout}
                  >
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <nav
          aria-label="Navigasi seluler"
          className="mobile-view-nav"
          style={{
            gridTemplateColumns: `repeat(${
              NAV_ITEMS.filter((item) => allowedViews.includes(item.view)).length
            }, 1fr)`,
          }}
        >
          {NAV_ITEMS.filter((item) => allowedViews.includes(item.view)).map(
            (item) => (
              <button
                className={view === item.view ? "active" : ""}
                key={item.view}
                onClick={() => setView(item.view)}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.short}</span>
              </button>
            ),
          )}
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
        ) : view === "tim" ? (
          <TeamView manager={account} onMessage={setMessage} query={query} />
        ) : view === "pesanan" ? (
          <OrdersView
            isManager={role === "manager"}
            names={names}
            onNewOrder={role === "cashier" ? () => setView("kasir") : undefined}
            query={query}
            transactions={transactions}
          />
        ) : view === "laporan" ? (
          <ReportView
            names={names}
            onMessage={setMessage}
            transactions={transactions}
          />
        ) : view === "akun" ? (
          <AccountSettingsView
            employeeName={employeeName}
            isManager={role === "manager"}
            onSave={(name, shift) => {
              const result = updateProfile(account.id, { name, title: shift })
              if (result.ok) setAccount(result.value)
              else setMessage(result.error)
            }}
            onToggleShift={toggleShift}
            shiftActive={shiftActive}
            shiftName={shiftName}
          />
        ) : (
          <WorkspaceView
            onAddProduct={(product) =>
              setProducts((current) => [product, ...current])
            }
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
            query={query}
          />
        )}
      </main>

      {view === "kasir" && OrderPanel()}

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
          <strong>{rupiah.format(total)}</strong>
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
