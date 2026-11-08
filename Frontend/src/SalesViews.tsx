import { useEffect, useState } from "react"
import { Icon } from "./Icon"
import { formatTime, rupiah } from "./lib/format"
import { getHourlySales, startOfToday, type HourlySalesReport, type Transaction } from "./lib/store"

const DAY = 86_400_000

const pct = (value: number) => `${Math.abs(value).toFixed(1).replace(".", ",")}%`

// "2× Nasi goreng, 1× Es teh". Kosong untuk pesanan lama yang rinciannya belum tersimpan.
const itemsSummary = (tx: Transaction) =>
  (tx.lines ?? []).map((line) => `${line.quantity}× ${line.name}`).join(", ")

/* ------------------------------------------------------------------ */
/*  Orders: real transactions recorded when a cashier presses Bayar     */
/* ------------------------------------------------------------------ */

export function OrdersView({
  transactions,
  names,
  isManager,
  query,
  onNewOrder,
}: {
  transactions: Transaction[]
  names: Record<string, string>
  isManager: boolean
  query: string
  onNewOrder?: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const today = startOfToday()
  const needle = query.trim().toLowerCase().replace("#", "")

  const todays = transactions.filter((tx) => tx.at >= today)
  const visible = todays
    .filter(
      (tx) =>
        !needle ||
        `${tx.number} ${names[tx.cashierId] ?? ""} ${tx.orderType} ${itemsSummary(tx)}`
          .toLowerCase()
          .includes(needle),
    )
    .slice(0, 60)
  const total = todays.reduce((sum, tx) => sum + tx.total, 0)

  return (
    <section className="workspace-view">
      <div className="workspace-header">
        <div>
          <span className="eyebrow">
            Hari ini · {todays.length} pesanan · {rupiah.format(total)}
          </span>
          <h2>Pesanan terbaru</h2>
          <p>
            {isManager
              ? "Semua transaksi hari ini dari seluruh kasir."
              : "Transaksi yang Anda proses hari ini."}
          </p>
        </div>
        {onNewOrder && (
          <button className="workspace-primary" onClick={onNewOrder}>
            <Icon name="plus" size={17} /> Pesanan baru
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="no-results">
          <Icon name="orders" size={28} />
          <h3>{needle ? "Pesanan tidak ditemukan" : "Belum ada pesanan hari ini"}</h3>
          <p>
            {needle
              ? "Coba nomor pesanan, nama kasir, atau nama menu lain."
              : "Pesanan yang sudah dibayar akan muncul di sini."}
          </p>
        </div>
      ) : (
        <div className="order-list">
          {visible.map((tx) => {
            const isOpen = openId === tx.id
            const summary = itemsSummary(tx)
            return (
              <div className={`order-entry ${isOpen ? "open" : ""}`} key={tx.id}>
                <button
                  aria-expanded={isOpen}
                  className="order-row"
                  onClick={() => setOpenId(isOpen ? null : tx.id)}
                >
                  <span className="order-row-icon">
                    <Icon name="orders" size={19} />
                  </span>
                  <span>
                    <strong>#{tx.number}</strong>
                    {summary && <span className="order-items">{summary}</span>}
                    <small>
                      {tx.orderType}
                      {tx.orderType === "Makan di tempat"
                        ? ` · ${tx.guestCount != null ? `${tx.guestCount} tamu` : "jumlah tamu belum tersimpan"}`
                        : ""}
                      {` · ${formatTime(tx.at)}`}
                      {isManager && names[tx.cashierId]
                        ? ` · ${names[tx.cashierId]}`
                        : ""}
                    </small>
                  </span>
                  <span className="order-status complete">Selesai</span>
                  <strong>{rupiah.format(tx.total)}</strong>
                  <span className="order-chevron">
                    <Icon name="chevron" size={17} />
                  </span>
                </button>
                {isOpen && (
                  <dl className="order-detail">
                    <div className="order-detail-items">
                      <dt>Menu dipesan</dt>
                      <dd>
                        {tx.lines && tx.lines.length > 0 ? (
                          <ul className="order-lines">
                            {tx.lines.map((line, index) => (
                              <li key={index}>
                                <span>
                                  {line.quantity}× {line.name}
                                </span>
                                <span>{rupiah.format(line.unitPrice * line.quantity)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="order-lines-empty">
                            Rincian menu tidak tersimpan untuk pesanan ini.
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Waktu</dt>
                      <dd>{formatTime(tx.at)}</dd>
                    </div>
                    <div>
                      <dt>Kasir</dt>
                      <dd>{names[tx.cashierId] ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Tipe</dt>
                      <dd>{tx.orderType}</dd>
                    </div>
                    {tx.orderType === "Makan di tempat" && (
                      <div>
                        <dt>Jumlah tamu</dt>
                        <dd>{tx.guestCount != null ? `${tx.guestCount} orang` : "Belum tersimpan"}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Jumlah item</dt>
                      <dd>{tx.items}</dd>
                    </div>
                    <div>
                      <dt>Subtotal</dt>
                      <dd>{rupiah.format(tx.subtotal)}</dd>
                    </div>
                    {!!tx.discount && (
                      <div>
                        <dt>Diskon</dt>
                        <dd>-{rupiah.format(tx.discount)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Pajak 11%</dt>
                      <dd>{rupiah.format(tx.tax)}</dd>
                    </div>
                    <div className="order-detail-total">
                      <dt>Total dibayar</dt>
                      <dd>{rupiah.format(tx.total)}</dd>
                    </div>
                  </dl>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Sales report for managers, built from the same transactions         */
/* ------------------------------------------------------------------ */


const FIRST_HOUR = 7
const LAST_HOUR = 23
const CHART_WIDTH = 920
const CHART_HEIGHT = 340
const CHART_MARGIN = { top: 22, right: 26, bottom: 54, left: 100 }

function formatAxisMoney(value: number) {
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
  if (value >= 1_000) return `Rp${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`
  return rupiah.format(value)
}

function niceMaximum(value: number) {
  if (value <= 0) return 100_000
  const roughStep = value / 4
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const fraction = roughStep / magnitude
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return Math.ceil(value / (niceFraction * magnitude)) * niceFraction * magnitude
}

export function ReportView({
  transactions,
  names,
  onMessage,
}: {
  transactions: Transaction[]
  names: Record<string, string>
  onMessage: (text: string) => void
}) {
  const now = Date.now()
  const today = startOfToday()
  const todays = transactions.filter((tx) => tx.at >= today)
  const yesterdays = transactions.filter(
    (tx) => tx.at >= today - DAY && tx.at < now - DAY,
  )

  const sales = todays.reduce((sum, tx) => sum + tx.total, 0)
  const orders = todays.length
  const average = orders ? sales / orders : 0
  const ySales = yesterdays.reduce((sum, tx) => sum + tx.total, 0)
  const yOrders = yesterdays.length
  const yAverage = yOrders ? ySales / yOrders : 0

  function change(current: number, previous: number) {
    if (!previous) return { text: "Belum ada data pembanding kemarin", down: false }
    const delta = ((current - previous) / previous) * 100
    return {
      text: `${delta >= 0 ? "↑" : "↓"} ${pct(delta)} dari kemarin`,
      down: delta < 0,
    }
  }
  const salesChange = change(sales, ySales)
  const averageChange = change(average, yAverage)
  const orderDelta = orders - yOrders

  const [hourly, setHourly] = useState<HourlySalesReport | null>(null)
  const [hourlyError, setHourlyError] = useState("")
  const [hourlyLoading, setHourlyLoading] = useState(true)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta"
  const dateKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`

  useEffect(() => {
    let current = true
    setHourlyLoading(true)
    setHourlyError("")
    getHourlySales(dateKey, timezone)
      .then((report) => {
        if (current) setHourly(report)
      })
      .catch((error: unknown) => {
        if (current) {
          setHourly(null)
          setHourlyError((error as Error).message || "Gagal memuat grafik penjualan.")
        }
      })
      .finally(() => {
        if (current) setHourlyLoading(false)
      })
    return () => {
      current = false
    }
  }, [dateKey, timezone, transactions])

  const slots = hourly
    ? Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, index) => {
        const hour = FIRST_HOUR + index
        return hourly.hours.find((slot) => slot.hour === hour) ?? { hour, sales: 0, orders: 0 }
      })
    : []
  const maximum = niceMaximum(Math.max(0, ...slots.map((slot) => slot.sales)))
  const plotWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right
  const plotHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom
  const x = (hour: number) =>
    CHART_MARGIN.left + ((hour - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR)) * plotWidth
  const y = (amount: number) =>
    CHART_MARGIN.top + plotHeight - (amount / maximum) * plotHeight
  const line = slots.map((slot) => `${x(slot.hour)},${y(slot.sales)}`).join(" ")
  const yTicks = Array.from({ length: 5 }, (_, index) => (maximum / 4) * index)
  const xTicks = Array.from({ length: 9 }, (_, index) => FIRST_HOUR + index * 2)

  function downloadReport() {
    if (!todays.length) {
      onMessage("Belum ada transaksi hari ini untuk diunduh")
      return
    }
    const header = ["Nomor", "Waktu", "Kasir", "Tipe", "Menu", "Item", "Subtotal", "Diskon", "Pajak", "Total"]
    const lines = [...todays].reverse().map((tx) =>
      [
        tx.number,
        new Date(tx.at).toLocaleString("id-ID"),
        `"${(names[tx.cashierId] ?? "").replace(/"/g, '""')}"`,
        tx.orderType,
        `"${itemsSummary(tx).replace(/×/g, "x").replace(/"/g, '""')}"`,
        tx.items,
        tx.subtotal,
        tx.discount ?? 0,
        tx.tax,
        tx.total,
      ].join(","),
    )
    const csv = "﻿" + [header.join(","), ...lines].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `laporan-penjualan-${dateKey}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    onMessage("Laporan berhasil diunduh")
  }

  return (
    <section className="workspace-view">
      <div className="workspace-header">
        <div>
          <span className="eyebrow">Dasbor bisnis</span>
          <h2>Ringkasan penjualan</h2>
          <p>Hari ini, dihitung dari pembayaran yang dicatat kasir.</p>
        </div>
        <button className="workspace-secondary" onClick={downloadReport}>
          <Icon name="download" size={17} /> Unduh laporan
        </button>
      </div>
      <div className="metric-grid">
        <article>
          <span>Total penjualan</span>
          <strong>{rupiah.format(sales)}</strong>
          <small className={salesChange.down ? "down" : ""}>{salesChange.text}</small>
        </article>
        <article>
          <span>Total pesanan</span>
          <strong>{orders}</strong>
          <small className={orderDelta < 0 ? "down" : ""}>
            {orderDelta >= 0 ? "↑" : "↓"} {Math.abs(orderDelta)} pesanan{" "}
            {orderDelta >= 0 ? "lebih banyak" : "lebih sedikit"} dari kemarin
          </small>
        </article>
        <article>
          <span>Rata-rata transaksi</span>
          <strong>{rupiah.format(average)}</strong>
          <small className={averageChange.down ? "down" : ""}>{averageChange.text}</small>
        </article>
      </div>
      <div className="chart-card hourly-chart-card">
        <div className="hourly-chart-heading">
          <div>
            <h3>Penjualan per jam</h3>
            <span>07.00 — 23.00</span>
          </div>
          <div className="hourly-chart-summary">
            <strong>{rupiah.format(hourly?.totalSales ?? 0)}</strong>
            <small>{hourly?.totalOrders ?? 0} pesanan · 07.00–23.00</small>
          </div>
        </div>
        {hourlyError ? (
          <div className="hourly-chart-message hourly-chart-error" role="alert">
            {hourlyError}
          </div>
        ) : (
          <div className="hourly-chart-scroll" aria-busy={hourlyLoading}>
            <svg
              className="hourly-chart-svg"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              aria-label="Grafik omzet per jam dari pukul 07 sampai 23. Sumbu vertikal menunjukkan nominal rupiah."
            >
              {yTicks.map((tick, index) => (
                <g key={index}>
                  <line
                    x1={CHART_MARGIN.left}
                    x2={CHART_WIDTH - CHART_MARGIN.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    className="hourly-grid-line"
                  />
                  <text
                    x={CHART_MARGIN.left - 14}
                    y={y(tick) + 4}
                    className="hourly-y-label"
                    textAnchor="end"
                  >
                    {formatAxisMoney(tick)}
                  </text>
                </g>
              ))}
              <line
                x1={CHART_MARGIN.left}
                x2={CHART_MARGIN.left}
                y1={CHART_MARGIN.top}
                y2={CHART_MARGIN.top + plotHeight}
                className="hourly-axis-line"
              />
              <line
                x1={CHART_MARGIN.left}
                x2={CHART_WIDTH - CHART_MARGIN.right}
                y1={CHART_MARGIN.top + plotHeight}
                y2={CHART_MARGIN.top + plotHeight}
                className="hourly-axis-line"
              />
              {slots.length > 1 && (
                <polyline points={line} className="hourly-line" />
              )}
              {slots.map((slot) => (
                <circle
                  key={slot.hour}
                  cx={x(slot.hour)}
                  cy={y(slot.sales)}
                  r="5.5"
                  className="hourly-point"
                  tabIndex={0}
                  aria-label={`${String(slot.hour).padStart(2, "0")}.00, omzet ${rupiah.format(slot.sales)}, ${slot.orders} pesanan`}
                >
                  <title>
                    {String(slot.hour).padStart(2, "0")}.00 · {rupiah.format(slot.sales)} · {slot.orders} pesanan
                  </title>
                </circle>
              ))}
              {xTicks.map((hour) => (
                <text
                  key={hour}
                  x={x(hour)}
                  y={CHART_HEIGHT - 18}
                  className="hourly-x-label"
                  textAnchor="middle"
                >
                  {String(hour).padStart(2, "0")}.00
                </text>
              ))}
              {hourlyLoading && (
                <text x={CHART_WIDTH / 2} y={CHART_HEIGHT / 2} className="hourly-overlay-label" textAnchor="middle">
                  Memuat data penjualan…
                </text>
              )}
              {!hourlyLoading && hourly && hourly.totalOrders === 0 && (
                <text x={CHART_WIDTH / 2} y={CHART_HEIGHT / 2} className="hourly-overlay-label" textAnchor="middle">
                  Belum ada transaksi hari ini
                </text>
              )}
            </svg>
          </div>
        )}
        <div className="hourly-chart-footer">
          <span><i /> Omzet per jam</span>
          <small>Data berdasarkan waktu lokal perangkat ({timezone})</small>
        </div>
      </div>
    </section>
  )
}
