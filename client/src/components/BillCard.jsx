import React from 'react'
import QRCode from 'qrcode.react'

function money(n){ return (Number(n||0)).toFixed(2) }

export default function BillCard({
  invoice,
  customer,
  owner,
  previousDue = 0,
  previousDueDateSnapshot,
  includePrevInPayable = true,
  amountPaid
}){
    console.log(owner)
  const createdAt = invoice?.createdAt ? new Date(invoice.createdAt) : new Date()
  // Prefer backend-calculated fields when present for accuracy
  const prevDueFromProp = Number(previousDue) || 0
  const prevDueFromInvoice = Number(invoice?.previousDue ?? 0)
  const effectivePrevDue = prevDueFromProp || prevDueFromInvoice
  const computedFromItems = Number.isFinite(Number(invoice?.subTotal)) && Number.isFinite(Number(invoice?.taxTotal))
    ? Number(invoice.subTotal) + Number(invoice.taxTotal) - Number(invoice?.discount||0) + Number(invoice?.rounding||0)
    : (subTotal + taxTotal)
  const currentAmount = Number(
    invoice?.currentTotal ?? invoice?.amountDue ?? (invoice?.total ? Math.max(0, Number(invoice.total) - Number(invoice?.previousDue||0)) : computedFromItems)
  )
  // Historical total at issuance (stable before/after payment)
  const historicalTotal = Number(invoice?.total ?? (currentAmount + effectivePrevDue))
  const amountPaidVal = Number(invoice?.amountPaid || 0)
  const balanceDue = Math.max(0, +(historicalTotal - amountPaidVal).toFixed(2))
  const items = Array.isArray(invoice?.items) ? invoice.items : []
  const totalQty = items.reduce((s,i)=> s + Number(i?.qty||0), 0)
  const subTotalCalc = items.reduce((s,i)=> s + Number(i?.qty||0)*Number(i?.unitPrice||0), 0)
  const taxTotalCalc = items.reduce((s,i)=> {
    const base = Number(i?.qty||0)*Number(i?.unitPrice||0)
    const pct = Number(i?.taxPercent||0)
    return s + (base * pct)/100
  }, 0)
  const subTotal = Number.isFinite(subTotalCalc) ? subTotalCalc : 0
  const taxTotal = Number.isFinite(taxTotalCalc) ? taxTotalCalc : 0

  return (
    <div className="w-[300px] bg-white text-black p-4 font-mono text-[12px] leading-[1.2]">
      {/* Header */}
      <div className="text-center">
        <div className="text-[14px] font-bold">{owner?.name || 'STORE'}</div>
        {owner?.address && <div className="mt-1">{owner.address}</div>}
        {owner?.phone && <div>Ph: {owner.phone}</div>}
        {owner?.gstin && <div>GSTIN: {owner.gstin}</div>}
        {owner?.email && <div>{owner.email}</div>}
      </div>

      {/* Meta */}
      <div className="mt-2 flex justify-between">
        <div>#{invoice?.number || '-'}</div>
        <div>{createdAt.toLocaleDateString()} {createdAt.toLocaleTimeString()}</div>
      </div>
      <div className="border-t border-black my-2" />

      {/* Customer */}
      <div>
        <div>To: {customer?.name || customer?.companyName || 'Customer'}</div>
        {(customer?.phone || customer?.address) && (
          <div className="truncate">{customer?.phone || ''} {customer?.address? `| ${customer.address}`:''}</div>
        )}
      </div>
      <div className="border-t border-black my-2" />

      {/* Items */}
      <div>
        <div className="flex justify-between">
          <div className="flex-1">Item</div>
          <div className="w-10 text-right">Qty</div>
          <div className="w-14 text-right">Price</div>
          <div className="w-16 text-right">Amount</div>
        </div>
        <div className="border-t border-dashed border-black my-1" />
        {items.map((it, idx)=> (
          <div key={idx} className="flex justify-between">
            <div className="flex-1 truncate">{it?.nameSnapshot || it?.name || 'Item'}</div>
            <div className="w-10 text-right">{it?.qty||0}</div>
            <div className="w-14 text-right">{money(it?.unitPrice||0)}</div>
            <div className="w-16 text-right">{money(it?.lineTotal ?? (Number(it?.qty||0)*Number(it?.unitPrice||0)))}</div>
          </div>
        ))}
        <div className="border-t border-black my-2" />
        <div className="flex justify-between"><div>Items:</div><div>{items.length} types / {totalQty} pcs</div></div>
      </div>

      {/* Totals (stable) */}
      <div className="mt-2">
        <div className="flex justify-between"><div>Sub Total</div><div>₹ {money(subTotal)}</div></div>
        <div className="flex justify-between"><div>Tax</div><div>₹ {money(taxTotal)}</div></div>
        <div className="flex justify-between"><div>Bill Amount</div><div>₹ {money(currentAmount)}</div></div>
        {Number(effectivePrevDue) > 0 && (
          <div className="flex justify-between">
            <div>Previous Due</div>
            <div className="text-red-600 font-semibold">₹ {money(effectivePrevDue)}</div>
          </div>
        )}
        {previousDueDateSnapshot && Number(effectivePrevDue) > 0 && (
          <div className="flex justify-between">
            <div>Due As Of</div>
            <div className="text-red-500">{new Date(previousDueDateSnapshot).toLocaleString()}</div>
          </div>
        )}
        <div className="border-t border-black my-2" />
        <div className="flex justify-between"><div>Total</div><div>₹ {money(historicalTotal)}</div></div>
        {amountPaidVal > 0 && (
          <div className="flex justify-between"><div>Amount Paid</div><div>₹ {money(amountPaidVal)}</div></div>
        )}
        <div className="flex justify-between font-bold"><div>Balance Due</div><div>₹ {money(balanceDue)}</div></div>
      </div>

      {/* QR */}
      {owner?.upi && balanceDue>0 && (
        <div className="mt-3 text-center">
          <QRCode value={`upi://pay?pa=${encodeURIComponent(owner.upi.vpa)}&pn=${encodeURIComponent(owner.name||'')}&am=${balanceDue}&cu=${owner.upi?.currency||'INR'}`} size={120} />
          <div className="mt-1 break-all">{`upi://pay?pa=${encodeURIComponent(owner.upi.vpa)}&pn=${encodeURIComponent(owner.name||'')}&am=${balanceDue}&cu=${owner.upi?.currency||'INR'}`}</div>
        </div>
      )}

      <div className="mt-2 text-center">Thank you! Visit again.</div>
    </div>
  )
}
