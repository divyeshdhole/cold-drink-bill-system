import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { toPng, toCanvas } from 'html-to-image'
import { FiX, FiShare2 } from 'react-icons/fi'
import BillCard from '../components/BillCard.jsx'

export default function Customers() {
  const [q, setQ] = useState('')
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)
  const [byCustomer, setByCustomer] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [settings, setSettings] = useState(null)
  const [dueData, setDueData] = useState(null)
  const printRef = useRef(null)
  const [printInvoice, setPrintInvoice] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [printContext, setPrintContext] = useState('pending') // 'pending' | 'paid'

  // 🔹 Delete selected customer
  async function deleteCustomer(id){
    const ok = window.confirm('Delete this customer and all their invoices and transactions? This cannot be undone.')
    if(!ok) return
    try{
      const r = await fetch(`${import.meta.env.VITE_API_URL}/api/customers/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if(!r.ok) throw new Error(await r.text())
      toast.success('Customer deleted')
      setSelected(null)
      setByCustomer(null)

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customers?q=${encodeURIComponent(q)}`)
      if(res.ok){ setCustomers(await res.json()) }
    }catch(e){
      toast.error(e?.message || 'Failed to delete customer')
    }
  }

  // 🔹 Fetch all customers
  useEffect(() => {
    let isMounted = true
    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customers?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        console.log(JSON.stringify(data) + "data is")
        if (isMounted) setCustomers(data)
      } catch (err) {
        console.error('Error fetching customers:', err)
      }
    }
    fetchCustomers()
    return () => { isMounted = false }
  }, [q])

  // 🔹 Fetch invoices by selected customer
  useEffect(() => {
    let isMounted = true
    if (!selected) {
      setByCustomer(null)
      return
    }
    const params = new URLSearchParams()
    if (selected?.phone) params.set('phone', selected.phone)
    if (selected?.name) params.set('name', selected.name)
    if (selected?.companyName) params.set('company', selected.companyName)
    fetch(`${import.meta.env.VITE_API_URL}/api/invoices/by-customer/search?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text())
        const data = await r.json()
        console.log(data)
        if (isMounted) setByCustomer(data)
      })
      .catch((e) => console.warn('Load invoices-by-customer failed:', e?.message))
    return () => { isMounted = false }
  }, [selected?.phone, selected?.name, selected?.companyName])

  // 🔹 Load settings / UPI details
  useEffect(() => {
    let isMounted = true
    fetch(`${import.meta.env.VITE_API_URL}/api/settings/upi`)
      .then(async (r)=>{ if(!r.ok) throw new Error(await r.text()); return r.json() })
      .then((data)=>{ if(isMounted) setSettings(data) })
      .catch(()=>{})
    return ()=>{ isMounted=false }
  }, [])

  // 🔹 Load previous due
  useEffect(()=>{
    let isMounted = true
    if(selected?.phone){
      fetch(`${import.meta.env.VITE_API_URL}/api/invoices/due?phone=${encodeURIComponent(selected.phone)}`)
        .then(async (r)=>{ if(!r.ok) throw new Error(await r.text()); return r.json() })
        .then((data)=>{ if(isMounted) setDueData(data) })
        .catch(()=>{})
    } else {
      setDueData(null)
    }
    return ()=>{ isMounted=false }
  }, [selected?.phone])

  // 🔹 View Bill
  async function viewBill(inv, context='pending'){
    try{
      if(selected?.phone){
        const r = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/due?phone=${encodeURIComponent(selected.phone)}`)
        if(r.ok){ setDueData(await r.json()) }
      }
    } catch(_){}
    setPrintInvoice(inv)
    setPrintContext(context)
    setShowPreview(true)
  }

  // 🔹 Patch invoice status
  async function patchStatus({ id, status, amountPaid, paymentRef }) {
    try {
      setUpdatingId(id)
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, amountPaid, paymentRef })
      })
      if (!resp.ok) throw new Error(await resp.text())
      if (selected) {
        const params = new URLSearchParams()
        if (selected?.phone) params.set('phone', selected.phone)
        if (selected?.name) params.set('name', selected.name)
        if (selected?.companyName) params.set('company', selected.companyName)
        const r = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/by-customer/search?${params.toString()}`)
        if (r.ok) setByCustomer(await r.json())
      }
      toast.success('Marked as paid')
    } catch (e) {
      toast.error(e?.message || 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  // 🔹 Download Bill as Image
  // Render bill to canvas with transparent background and trimmed margins
  async function renderBillCanvas() {
    const node = printRef.current
    if (!node) throw new Error('No bill to render')
    const canvas = await toCanvas(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: 'transparent',
      style: {
        margin: '0',
        padding: '0',
        background: 'transparent'
      }
    })
    return trimTransparent(canvas)
  }

  function trimTransparent(sourceCanvas){
    const ctx = sourceCanvas.getContext('2d')
    const w = sourceCanvas.width, h = sourceCanvas.height
    const imgData = ctx.getImageData(0,0,w,h)
    const data = imgData.data
    let top = null, left = null, right = null, bottom = null
    for(let y=0; y<h; y++){
      for(let x=0; x<w; x++){
        const idx = (y*w + x)*4
        const alpha = data[idx+3]
        if(alpha !== 0){
          if(top===null) top = y
          if(left===null || x<left) left = x
          if(right===null || x>right) right = x
          bottom = y
        }
      }
    }
    if(top===null){
      return sourceCanvas // fully transparent fallback
    }
    const tw = right-left+1, th = bottom-top+1
    const trimmed = document.createElement('canvas')
    trimmed.width = tw; trimmed.height = th
    const tctx = trimmed.getContext('2d')
    tctx.drawImage(sourceCanvas, left, top, tw, th, 0, 0, tw, th)
    return trimmed
  }

  async function downloadBill() {
    if (!printRef.current) return;
    try {
      const canvas = await renderBillCanvas()
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a');
      link.download = `${printInvoice?.number || 'invoice'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      toast.error('Failed to download bill');
      console.error('Error generating image:', error);
    }
  }

  // 🔹 Share Bill via WhatsApp
  function formatMoney(n){ return (Number(n||0)).toFixed(2) }
  function getServerBase(){
    const envBase = import.meta?.env?.VITE_SERVER_PUBLIC_URL
    if(envBase) return envBase.replace(/\/$/, '')
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:5000`
  }
  function buildWaText(inv){
    if(!inv) return ''
    const store = settings?.name || 'Invoice'
    const header = `*${store}*\nInvoice No: ${inv.number}`
    const when = inv.createdAt ? new Date(inv.createdAt).toLocaleString() : ''
    const customerLines = [
      selected?.name ? `Customer: ${selected.name}` : null,
      selected?.phone ? `Phone: ${selected.phone}` : null,
      selected?.address ? `Address: ${selected.address}` : null,
      selected?.companyName ? `Company: ${selected.companyName}` : null,
    ].filter(Boolean)
    const itemLines = (inv.items||[]).map(i=> `• ${i.nameSnapshot} x${i.qty} @ ₹${formatMoney(i.unitPrice)} = ₹${formatMoney(i.lineTotal)}`)
    const totals = [
      `Subtotal: ₹${formatMoney(inv.subTotal)}`,
      `Tax: ₹${formatMoney(inv.taxTotal)}`,
      inv.discount ? `Discount: -₹${formatMoney(inv.discount)}` : null,
      inv.rounding ? `Rounding: ₹${formatMoney(inv.rounding)}` : null,
      inv.previousDue ? `Previous Due: ₹${formatMoney(inv.previousDue)}` : null,
      `*TOTAL: ₹${formatMoney(inv.total)}*`
    ].filter(Boolean)
    const imgUrl = `${getServerBase()}/api/invoices/${inv._id}/image`
    const lines = [
      header,
      when ? `Date: ${when}` : null,
      customerLines.length? customerLines.join('\n') : null,
      '',
      '*Items*',
      ...itemLines,
      '',
      ...totals,
      '',
      '*Invoice Image*',
      imgUrl,
    ].filter(Boolean)
    return encodeURIComponent(lines.join('\n'))
  }
  function buildWaHref(inv){
    const raw = (selected?.phone || '').toString()
    const phone = raw.replace(/\D/g, '')
    const text = buildWaText(inv)
    return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`
  }
  function shareBill(){
    if(!printInvoice){ toast.info('No invoice selected'); return }
    const url = buildWaHref(printInvoice)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // 🔹 Share the image file (like gallery share) via Web Share API (Android Chrome)
  async function shareBillImage(){
    try{
      if(!printRef.current){ toast.info('Open a bill preview first'); return }
      if(!('share' in navigator)){
        toast.info('Sharing not supported on this browser');
        return
      }
      // Render trimmed canvas and convert to Blob
      const canvas = await renderBillCanvas()
      const dataUrl = canvas.toDataURL('image/png')
      const resp = await fetch(dataUrl)
      const blob = await resp.blob()
      const fileName = `${printInvoice?.number || 'invoice'}.png`
      const file = new File([blob], fileName, { type: 'image/png' })
      const shareData = {
        files: [file],
        text: `Invoice ${printInvoice?.number || ''}`,
        title: 'Invoice'
      }
      if('canShare' in navigator && !navigator.canShare(shareData)){
        toast.info('Cannot share image file on this device')
        return
      }
      await navigator.share(shareData)
    }catch(e){
      console.error(e)
      toast.error('Failed to share image')
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* 🔹 Customers List */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-3">Customers</h2>
        <input
          className="input mb-2"
          placeholder="Search by name/phone/company"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-96 overflow-auto divide-y">
          {customers?.map((c) => (
            <button
              key={c._id}
              className={`w-full text-left px-2 py-2 hover:bg-gray-50 ${
                selected?._id === c._id ? 'bg-blue-50' : ''
              }`}
              onClick={() => setSelected(c)}
            >
              <div className="text-sm font-medium">
                {c.name} {c.companyName ? `· ${c.companyName}` : ''}
              </div>
              <div className="text-xs text-gray-500">
                {c.phone} {c.address ? `· ${c.address}` : ''}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 🔹 Invoice Section */}
      <div className="md:col-span-2 bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Invoices</h2>
          {selected && (
            <button
              className="btn border-red-300 text-red-700 hover:bg-red-50"
              onClick={()=> deleteCustomer(selected._id)}
            >Delete Customer</button>
          )}
        </div>
        {!selected && (
          <div className="text-sm text-gray-500">
            Select a customer to view invoices
          </div>
        )}
        {selected && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 🔹 Pending Invoices */}
            <div>
              <h3 className="font-semibold mb-2">Pending</h3>
              <div className="space-y-3">
                {byCustomer?.pending?.map((inv, idx) => (
                  <div key={inv._id} className="border rounded-lg p-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold truncate flex items-center gap-2">
                        <span className="truncate">{inv.number}</span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          ₹ {Number(inv.total).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(inv.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2 w-full md:w-auto">
                      <button className="btn w-full md:w-auto" onClick={()=> viewBill(inv, 'pending')}>View Bill</button>
                      {idx === 0 && (
                        <button
                          className="btn-primary w-full md:w-auto"
                          disabled={updatingId === inv._id}
                          onClick={() => {
                            const ok = window.confirm('Mark this invoice and all previous pending invoices as paid?')
                            if (!ok) { toast.info('Cancelled'); return }
                            patchStatus({ id: inv._id, status: 'paid', amountPaid: inv.total })
                          }}
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {byCustomer?.pending?.length === 0 && (
                  <div className="text-xs text-gray-500">No pending invoices</div>
                )}
              </div>
            </div>

            {/* 🔹 Paid Invoices */}
            <div>
              <h3 className="font-semibold mb-2">Paid</h3>
              <div className="space-y-2">
                {byCustomer?.paid?.map((inv) => (
                  <div key={inv._id} className="border rounded p-2 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-medium">{inv.number}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(inv.createdAt).toLocaleString()} · Paid ₹{' '}
                        {Number(inv.amountPaid || inv.total).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn" onClick={()=> viewBill(inv, 'paid')}>View Bill</button>
                    </div>
                  </div>
                ))}
                {byCustomer?.paid?.length === 0 && (
                  <div className="text-xs text-gray-500">No paid invoices</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🔹 Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=> setShowPreview(false)} />
          <div className="relative z-10">
            {printInvoice && (
              <div ref={printRef} className="shadow-2xl">
                {(() => {
                  const isNewestPending = printContext === 'pending' && byCustomer?.pending?.[0]?._id === printInvoice?._id
                  const invoicePrevDue = Number(printInvoice?.previousDue ?? 0)
                  const fallbackDue = isNewestPending
                    ? Math.max(0, Number(dueData?.due || 0) - Number(printInvoice?.currentTotal ?? printInvoice?.amountDue ?? printInvoice?.total ?? 0))
                    : 0
                  const prevDueToPass = invoicePrevDue || fallbackDue
                  const prevDueDateToPass = (!!invoicePrevDue)
                    ? null
                    : (isNewestPending ? (dueData?.asOf || dueData?.date || dueData?.updatedAt || null) : null)
                  return (
                    <BillCard
                      invoice={printInvoice}
                      customer={{
                        name: selected?.name,
                        companyName: selected?.companyName,
                        phone: selected?.phone,
                        address: selected?.address
                      }}
                      owner={{
                        name: settings?.name,
                        phone: settings?.phone,
                        address: settings?.address,
                        gstin: settings?.gstin,
                        email: settings?.email,
                        upi: { vpa: settings?.vpa, currency: settings?.currency||'INR' }
                      }}
                      previousDue={prevDueToPass}
                      previousDueDateSnapshot={printInvoice.previousDueDateSnapshot}
                      includePrevInPayable={printContext === 'pending'}
                    />
                  )
                })()}
              </div>
            )}
            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                className="p-2 rounded-full hover:bg-slate-100 active:bg-slate-200"
                onClick={()=> setShowPreview(false)}
                aria-label="Close preview"
                title="Close"
              >
                <FiX size={20} />
              </button>
              <button
                className="p-2 rounded-full hover:bg-slate-100 active:bg-slate-200"
                onClick={shareBillImage}
                aria-label="Share image"
                title="Share Image"
              >
                <FiShare2 size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
