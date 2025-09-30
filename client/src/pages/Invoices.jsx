import { useState, useEffect } from 'react'

function formatMoney(n) {
  return (Number(n || 0)).toFixed(2)
}

function getServerBase() {
  const envBase = import.meta?.env?.VITE_SERVER_PUBLIC_URL
  if (envBase) return envBase.replace(/\/$/, '')
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:5000`
}

function waText(inv) {
  const store = import.meta?.env?.VITE_OWNER_NAME || 'Invoice'
  const header = `*${store}*\nInvoice No: ${inv.number}`
  const when = inv.createdAt ? new Date(inv.createdAt).toLocaleString() : ''
  const customer = [
    inv.customerName ? `Customer: ${inv.customerName}` : null,
    inv.customerPhone ? `Phone: ${inv.customerPhone}` : null,
    inv.customerAddress ? `Address: ${inv.customerAddress}` : null,
    inv.customerCompany ? `Company: ${inv.customerCompany}` : null,
  ].filter(Boolean)

  const itemLines = (inv.items || []).map(
    (i) => `• ${i.nameSnapshot} x${i.qty} @ ₹${formatMoney(i.unitPrice)} = ₹${formatMoney(i.lineTotal)}`
  )

  const totals = [
    `Subtotal: ₹${formatMoney(inv.subTotal)}`,
    `Tax: ₹${formatMoney(inv.taxTotal)}`,
    inv.discount ? `Discount: -₹${formatMoney(inv.discount)}` : null,
    inv.rounding ? `Rounding: ₹${formatMoney(inv.rounding)}` : null,
    inv.previousDue ? `Previous Due: ₹${formatMoney(inv.previousDue)}` : null,
    `*TOTAL: ₹${formatMoney(inv.total)}*`
  ].filter(Boolean)

  const body = [
    header,
    when ? `Date: ${when}` : null,
    customer.length ? customer.join('\n') : null,
    '',
    '*Items*',
    ...itemLines,
    '',
    ...totals,
    (() => {
      const vpa = import.meta?.env?.VITE_UPI_VPA
      if (!vpa) return null
      const currency = import.meta?.env?.VITE_UPI_CURRENCY || 'INR'
      const amount = formatMoney(inv.total)
      const upiLink = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(store)}&am=${amount}&cu=${encodeURIComponent(currency)}`
      const qrUrl = `${getServerBase()}/api/invoices/${inv._id}/upi-qr.png`
      return [
        '',
        '*Pay by UPI*',
        upiLink,
        `QR: ${qrUrl}`
      ].join('\n')
    })(),
  ].filter(Boolean).join('\n')

  return encodeURIComponent(body)
}

function waHref(inv) {
  const raw = (inv.customerPhone || '').toString()
  const phone = raw.replace(/\D/g, '') // digits only; ensure your backend stores with country code
  const text = waText(inv)
  // If phone missing, fallback to generic share (no preselected chat)
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    fetch('/api/invoices')
      .then((r) => r.json())
      .then((data) => {
        if (isMounted) setInvoices(data || [])
      })
      .catch((e) => console.warn('Load invoices failed:', e?.message))
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <div className="bg-white p-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr>
              <th className="py-2 pr-2">Number</th>
              <th className="py-2 pr-2">Date</th>
              <th className="py-2 pr-2">Items</th>
              <th className="py-2 pr-2">Total</th>
              <th className="py-2 pr-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv._id} className="border-b">
                <td className="py-2 pr-2">{inv.number}</td>
                <td className="py-2 pr-2">{new Date(inv.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-2">{inv.items?.length}</td>
                <td className="py-2 pr-2">₹ {formatMoney(inv.total)}</td>
                <td className="py-2 pr-2 space-x-2">
                  <a
                    className="btn"
                    href={waHref(inv)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Share WhatsApp
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && !loading && (
          <div className="py-4 text-gray-500">No invoices found.</div>
        )}
      </div>
    </div>
  )
}

