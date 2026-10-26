import { useState } from "react"
import { Icon } from "./Icon"
import { formatTime, rupiah } from "./lib/format"
import { startOfToday, type Transaction } from "./lib/store"

const DAY = 86_400_000

const pct = (value: number) => `${Math.abs(value).toFixed(1).replace(".", ",")}%`

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
        `${tx.number} ${names[tx.cashierId] ?? ""} ${tx.orderType}`
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
              ? "Coba nomor pesanan atau nama kasir lain."
              : "Pesanan yang sudah dibayar akan muncul di sini."}
          </p>
        </div>
      ) : (
        <div className="order-list">
          {visible.map((tx) => {
            const isOpen = openId === tx.id
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
                    <small>
                      {tx.orderType} · {formatTime(tx.at)}
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
const LAST_HOUR = 22

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
  // compare with the same stretch of yesterday so a half-finished day is not unfair
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

  const hours = Array.from(
    { length: LAST_HOUR - FIRST_HOUR + 1 },
    (_, index) => FIRST_HOUR + index,
  )
  const perHour = hours.map((hour) => {
    const inHour = todays.filter((tx) => new Date(tx.at).getHours() === hour)
    return {
      hour,
      orders: inHour.length,
      sales: inHour.reduce((sum, tx) => sum + tx.total, 0),
    }
  })
  const peak = Math.max(1, ...perHour.map((slot) => slot.sales))
  const pad = (hour: number) => String(hour).padStart(2, "0")

  function downloadReport() {
    if (!todays.length) {
      onMessage("Belum ada transaksi hari ini untuk diunduh")
      return
    }
    const header = ["Nomor", "Waktu", "Kasir", "Tipe", "Item", "Subtotal", "Diskon", "Pajak", "Total"]
    const lines = [...todays].reverse().map((tx) =>
      [
        tx.number,
        new Date(tx.at).toLocaleString("id-ID"),
        `"${(names[tx.cashierId] ?? "").replace(/"/g, '""')}"`,
        tx.orderType,
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
    link.download = `laporan-penjualan-${new Date().toISOString().slice(0, 10)}.csv`
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
      <div className="chart-card">
        <div>
          <h3>Penjualan per jam</h3>
          <span>
            {pad(FIRST_HOUR)}.00 — {pad(LAST_HOUR + 1)}.00
          </span>
        </div>
        <div className="bar-chart">
          {perHour.map((slot) => (
            <i
              key={slot.hour}
              style={{ height: `${(slot.sales / peak) * 100}%` }}
              title={`${pad(slot.hour)}.00 · ${rupiah.format(slot.sales)} · ${slot.orders} pesanan`}
            />
          ))}
        </div>
        <div className="bar-labels" aria-hidden="true">
          {perHour.map((slot) => (
            <span key={slot.hour}>{slot.hour % 3 === FIRST_HOUR % 3 ? pad(slot.hour) : ""}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
