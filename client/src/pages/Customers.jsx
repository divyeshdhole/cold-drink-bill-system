import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
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

  useEffect(() => {
    let isMounted = true
    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/customers?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (isMounted) setCustomers(data)
      } catch (err) {
        console.error('Error fetching customers:', err)
      }
    }
    fetchCustomers()
    return () => {
      isMounted = false
    }
  }, [q])

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
        if (isMounted) setByCustomer(data)
        console.log(JSON.stringify(data) + "date invoice")
      })
      .catch((e) => console.warn('Load invoices-by-customer failed:', e?.message))
    return () => {
      isMounted = false
    }
  }, [selected?.phone, selected?.name, selected?.companyName])

  // Load owner/settings for bill and QR (from backend only)
  useEffect(() => {
    let isMounted = true
    fetch(`${import.meta.env.VITE_API_URL}/api/settings/upi`)
      .then(async (r)=>{ if(!r.ok) throw new Error(await r.text()); return r.json() })
        
      .then((data)=>{ if(isMounted) { setSettings(data); console.log(data) } })
      .catch(()=>{})
    return ()=>{ isMounted=false }
  }, [])

  // Load previous due for selected customer
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

  async function viewBill(inv, context='pending'){
    try{
      // Always refresh latest due before preview so values are up-to-date
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
      // refresh invoices for selected
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <div className="md:col-span-2 bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-3">Invoices</h2>
        {!selected && (
          <div className="text-sm text-gray-500">
            Select a customer to view invoices
          </div>
        )}
        {selected && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Pending</h3>
              <div className="space-y-2">
                {byCustomer?.pending?.map((inv, idx) => (
                  <div
                    key={inv._id}
                    className="border rounded p-2 text-sm flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{inv.number}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(inv.createdAt).toLocaleString()} · ₹{' '}
                        {Number(inv.total).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn" onClick={()=> viewBill(inv, 'pending')}>View Bill</button>
                      {idx === 0 && (
                        <button
                          className="btn-primary"
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
            <div>
              <h3 className="font-semibold mb-2">Paid</h3>
              <div className="space-y-2">
                {byCustomer?.paid?.map((inv) => (
                  <div
                    key={inv._id}
                    className="border rounded p-2 text-sm flex items-center justify-between"
                  >
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
      {/* Preview Modal */}
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
                  owner={{ name: settings?.name, phone: settings?.phone, address: settings?.address, gstin: settings?.gstin, email: settings?.email, upi: { vpa: settings?.vpa, currency: settings?.currency||'INR' } }}
                  previousDue={prevDueToPass}
                  previousDueDateSnapshot={printInvoice.previousDueDateSnapshot}
                  includePrevInPayable={printContext === 'pending'}
                    />
                  )
                })()}
              </div>
            )}
            <div className="mt-3 flex justify-center">
              <button className="btn" onClick={()=> setShowPreview(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
