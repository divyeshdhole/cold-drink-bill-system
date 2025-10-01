import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode.react'
import { toast } from 'react-toastify'

function money(n){ return (Number(n||0)).toFixed(2) }

export default function Billing(){
  // Local state (replacing React Query)
  const [settings, setSettings] = useState(null)
  const [products, setProducts] = useState([])
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [cart, setCart] = useState([])
  const [customer, setCustomer] = useState({ name:'', phone:'', address:'', company:'' })
  const [discount, setDiscount] = useState(0)
  const [paymentMode, setPaymentMode] = useState('upi')
  const [autoSendWhatsapp, setAutoSendWhatsapp] = useState(false)
  // Fetch settings (from backend only; backed by server .env)
  useEffect(()=>{
    let isMounted = true
    setLoadingSettings(true)
    fetch(import.meta.env.VITE_API_URL + '/api/settings/upi')
      .then(async (r)=>{
        if(!r.ok) throw new Error(await r.text())
        return r.json()
      })
      .then((data)=>{ if(isMounted) setSettings(data) })
      .catch((e)=>{ console.warn('Load settings failed:', e?.message) })
      .finally(()=>{ if(isMounted) setLoadingSettings(false) })
    return ()=>{ isMounted = false }
  }, [])

  // Fetch products
  useEffect(()=>{
    let isMounted = true
    setLoadingProducts(true)
    fetch(import.meta.env.VITE_API_URL + '/api/products')
      .then(async (r)=>{ if(!r.ok) throw new Error(await r.text()); return r.json() })
      .then((data)=>{ if(isMounted) setProducts(data) })
      .catch((e)=>{ console.warn('Load products failed:', e?.message) })
      .finally(()=>{ if(isMounted) setLoadingProducts(false) })
    return ()=>{ isMounted = false }
  }, [])

  // Owner stats (total bills, amount, received, pending)
  const [stats, setStats] = useState(null)
  useEffect(()=>{
    let isMounted = true
    ;(async ()=>{
      try{
        const r = await fetch(import.meta.env.VITE_API_URL + '/api/invoices/owner-stats')
        if(!r.ok) throw new Error(await r.text())
        const data = await r.json()
        if(isMounted) setStats(data)
      }catch(_){}
    })()
    return ()=>{ isMounted=false }
  }, [])

  // Fetch previous due by phone
  const [dueData, setDueData] = useState(null)
  useEffect(()=>{
    let isMounted = true
    if(customer.phone && customer.phone.length>=5){
      // get due data by customer model
      const url = import.meta.env.VITE_API_URL + `/api/invoices/due?phone=${encodeURIComponent(customer.phone)}`
      fetch(url)
        .then(async (r)=>{ if(!r.ok) throw new Error(await r.text()); return r.json() })
        .then((data)=>{ if(isMounted) setDueData(data) })
        .catch((e)=>{ console.warn('Load due failed:', e?.message) })
    } else {
      setDueData(null)
    }
    return ()=>{ isMounted = false }
  }, [customer.phone])

  // Customer directory search
  const [custQuery, setCustQuery] = useState('')
  const [custResults, setCustResults] = useState([])
  useEffect(()=>{
    let isMounted = true
    if(custQuery.length >= 2){
      const url = import.meta.env.VITE_API_URL + `/api/customers?q=${encodeURIComponent(custQuery)}`
      fetch(url)
        .then(async (r)=>{ if(!r.ok) throw new Error(await r.text()); return r.json() })
        .then((data)=>{ if(isMounted) setCustResults(data) })
        .catch((e)=>{ console.warn('Search customers failed:', e?.message) })
    } else {
      setCustResults([])
    }
    return ()=>{ isMounted = false }
  }, [custQuery])

  const addToCart = (prod)=>{
    const available = Number(prod.quantity || 0)
    const existing = cart.find(c=>c._id === prod._id)
    if(existing){
      if(existing.qty + 1 > available){
        toast.warn(`Only ${available} available`)
        return
      }
      setCart(cart.map(c=> c._id===prod._id ? { ...c, qty: c.qty+1 } : c))
    } else {
      if(available <= 0){
        toast.info(`${prod.name} is out of stock`)
        return
      }
      setCart([...cart, { ...prod, qty:1, unitPrice: prod.sellingPrice, taxPercent: prod.taxPercent||0 }])
    }
  }

  const totals = useMemo(()=>{
    const sub = cart.reduce((s,it)=> s + it.qty*it.unitPrice, 0)
    const tax = cart.reduce((s,it)=> s + ((it.qty*it.unitPrice)*(it.taxPercent||0))/100, 0)
    const d = Number(discount||0)
    let total = sub + tax - d
    const rounded = Math.round(total)
    const rounding = +(rounded - total).toFixed(2)
    total = +(total + rounding).toFixed(2)
    return { subTotal:+sub.toFixed(2), taxTotal:+tax.toFixed(2), discount:+d.toFixed(2), rounding, total }
  }, [cart, discount])

  const previousDue = Number(dueData?.due || 0)
  const grandTotal = +(Number(totals.total || 0) + previousDue).toFixed(2)

  const upiUrl = useMemo(()=>{
    const vpa = settings?.vpa || ''
    const name = encodeURIComponent(settings?.name || '')
    const amount = grandTotal || 0
    if(!vpa || !amount) return ''
    return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${name}&am=${amount}&cu=${settings?.currency||'INR'}`
  }, [settings, grandTotal])

  const findProduct = (id)=> products?.find(p=> p._id === id)
  const hasExceeding = useMemo(()=> cart.some(it=> (it.qty || 0) > Number(findProduct(it._id)?.quantity || 0)), [cart, products])

  const [creating, setCreating] = useState(false)
  async function createInvoice(){
    try{
      // Phone is mandatory for billing
      if(!customer.phone){
        toast.error('Customer phone is required')
        return
      }
      // Confirm summary before creating invoice
      const itemsCount = cart.reduce((s, it)=> s + it.qty, 0)
      const lines = cart.map(it=> `${it.name} x${it.qty} @ ₹${money(it.unitPrice)}`).slice(0,4)
      const more = cart.length>4 ? ` +${cart.length-4} more` : ''
      const summary = [
        `Items: ${itemsCount} (${lines.join(', ')}${more})`,
        `Sub: ₹${money(totals.subTotal)}, Tax: ₹${money(totals.taxTotal)}, Discount: ₹${money(discount)}`,
        `Prev Due: ₹${money(previousDue)}, Grand: ₹${money(grandTotal)}`,
        `Pay: ${paymentMode.toUpperCase()}${customer.name? `, Customer: ${customer.name}`:''}${customer.phone? `, ${customer.phone}`:''}`
      ].join('\n')
      const ok = window.confirm(`Create invoice?\n\n${summary}`)
      if(!ok){ toast.info('Cancelled'); return }
      try{
        if (customer.name || customer.company || customer.phone || customer.address) {
          await fetch(import.meta.env.VITE_API_URL + '/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: customer.name || customer.company || 'Customer', companyName: customer.company || undefined, phone: customer.phone || undefined, address: customer.address || undefined })
          })
        }
      } catch(e){ console.warn('Save customer failed', e?.message) }
      if (autoSendWhatsapp && !customer.phone) {
        toast.error('Customer phone is required to auto-send on WhatsApp')
        return
      }
      setCreating(true)
      const payload = {
        customerName: customer.name || undefined,
        customerPhone: customer.phone || undefined,
        customerAddress: customer.address || undefined,
        customerCompany: customer.company || undefined,
        paymentMode,
        discount: Number(discount||0),
        autoSendWhatsapp,
        previousDue: previousDue,
        items: cart.map(it=> ({ productId: it._id, qty: it.qty, unitPrice: Number(it.unitPrice), taxPercent: Number(it.taxPercent||0) }))
      }
      const resp = await fetch(import.meta.env.VITE_API_URL + '/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if(!resp.ok){
        const txt = await resp.text()
        throw new Error(txt || 'Failed to create invoice')
      }
      const inv = await resp.json()
      toast.success(`Invoice created: ${inv.number} Total: ${money(inv.total)}`)
      
      setCart([])
      setDiscount(0)
      setCustomer({name:'', phone:'', address:'', company:''})
      setAutoSendWhatsapp(false)
      // Refresh products list after sale
      try{
        const r = await fetch(import.meta.env.VITE_API_URL + '/api/products')
        if(r.ok){ setProducts(await r.json()) }
      } catch(_){}
      // Refresh owner stats after sale
      try{
        const rs = await fetch(import.meta.env.VITE_API_URL + '/api/invoices/owner-stats')
        if(rs.ok){ setStats(await rs.json()) }
      } catch(_){}
    } catch(err){
      const msg = err?.message || 'Failed to create invoice'
      toast.error(msg)
    } finally{
      setCreating(false)
    }
  }

  return (
    <div className="pb-24 md:pb-0">{/* extra bottom padding for mobile sticky bar */}
      {stats && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="border rounded p-3 bg-white">
            <div className="text-xs text-gray-500">Total Bills</div>
            <div className="text-lg font-semibold">{Number(stats.totalBills||0)}</div>
          </div>
          <div className="border rounded p-3 bg-white">
            <div className="text-xs text-gray-500">Total Amount</div>
            <div className="text-lg font-semibold">₹ {money(stats.totalAmount)}</div>
          </div>
          <div className="border rounded p-3 bg-white">
            <div className="text-xs text-gray-500">Total Received</div>
            <div className="text-lg font-semibold text-green-700">₹ {money(stats.totalReceived)}</div>
          </div>
          <div className="border rounded p-3 bg-white">
            <div className="text-xs text-gray-500">Total Pending</div>
            <div className="text-lg font-semibold text-red-600">₹ {money(stats.totalPending)}</div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 card">
        <h2 className="font-semibold mb-3">Select Products</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products?.map(p=> {
            const isOut = (p.quantity || 0) <= 0
            return (
            <button key={p._id} disabled={isOut} className={`border rounded-lg p-3 text-left bg-white transition hover:shadow-md ${isOut? 'opacity-50 cursor-not-allowed' : ''}`} onClick={()=>addToCart(p)}>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-gray-500">{p.brand} {p.sizeMl? `${p.sizeMl}ml`: ''}</div>
              <div className="text-sm mt-1">₹ {money(p.sellingPrice)}</div>
              <div className={`text-xs mt-1 ${p.quantity>0?'text-green-600':'text-red-600'}`}>Stock: {p.quantity}</div>
            </button>
          )})}
        </div>
      </div>

      <div className="md:col-span-1 card">
        <h2 className="font-semibold mb-3">Cart</h2>
        <div className="space-y-2">
          {cart.length===0 && <div className="text-sm text-gray-500">No items yet</div>}
          {cart.map((it)=> {
            const available = Number(findProduct(it._id)?.quantity || 0)
            const exceeds = it.qty > available
            return (
              <div key={it._id} className="flex items-center gap-2 text-sm">
                <div className="flex-1">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-gray-500">₹ {money(it.unitPrice)} · Available: {available}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="btn-ghost" onClick={()=> setCart(cart.map(c=> c._id===it._id && c.qty>1 ? {...c, qty:c.qty-1}: c))}>-</button>
                  <input className={`w-12 border rounded px-2 py-1 text-center ${exceeds? 'border-red-500':''}`} value={it.qty} onChange={e=>{
                    let v = Math.max(1, Number(e.target.value||1))
                    if(v > available) v = available || 1
                    setCart(cart.map(c=> c._id===it._id ? {...c, qty:v}: c))
                  }} />
                  <button className="btn-ghost" onClick={()=> setCart(cart.map(c=> {
                    if(c._id!==it._id) return c
                    const next = c.qty + 1
                    if(next > available) return c
                    return { ...c, qty: next }
                  }))}>+</button>
                </div>
                <div className="w-16 text-right">₹ {money(it.qty*it.unitPrice)}</div>
                {exceeds && <div className="text-xs text-red-600">Exceeds stock</div>}
              </div>
            )
          })}
        </div>
        <div className="border-t mt-3 pt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span>Sub Total</span><span>₹ {money(totals.subTotal)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>₹ {money(totals.taxTotal)}</span></div>
          <div className="flex justify-between items-center gap-2">
            <span>Discount</span>
            <input className="input" placeholder="0" value={discount} onChange={e=> setDiscount(e.target.value)} />
          </div>
          <div className="flex justify-between"><span>Rounding</span><span>₹ {money(totals.rounding)}</span></div>
          <div className="flex justify-between"><span>Previous Due</span><span>₹ {money(previousDue)}</span></div>
          <div className="flex justify-between font-semibold text-lg"><span>Grand Total</span><span>₹ {money(grandTotal)}</span></div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <select className="input" value={paymentMode} onChange={e=> setPaymentMode(e.target.value)}>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
            <input className="input" placeholder="Customer Name" value={customer.name} onChange={e=> setCustomer({...customer, name:e.target.value})} />
            <input className="input" placeholder="Phone" value={customer.phone} onChange={e=> setCustomer({...customer, phone:e.target.value})} />
          </div>
          <input className="input" placeholder="Customer Shop/Company" value={customer.company} onChange={e=> setCustomer({...customer, company:e.target.value})} />
          <div className="relative">
            <input className="input" placeholder="Search customers (min 2 chars)" value={custQuery} onChange={e=> setCustQuery(e.target.value)} />
            {custResults?.length>0 && (
              <div className="absolute z-10 bg-white border rounded w-full max-h-48 overflow-auto">
                {custResults.map(c=> (
                  <button key={c._id} className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=>{
                    setCustomer({ name: c.name||'', phone: c.phone||'', address: c.address||'', company: c.companyName||'' })
                    setCustQuery('')
                  }}>
                    <div className="text-sm font-medium">{c.name} {c.companyName? `· ${c.companyName}`:''}</div>
                    <div className="text-xs text-gray-500">{c.phone} {c.address? `· ${c.address}`:''}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea className="input" rows={2} placeholder="Customer Address" value={customer.address} onChange={e=> setCustomer({...customer, address:e.target.value})} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoSendWhatsapp} onChange={e=> setAutoSendWhatsapp(e.target.checked)} />
            <span>Auto-send invoice PDF to WhatsApp</span>
          </label>
          {/* Customer is now always saved/updated after creating invoice */}

          {paymentMode==='upi' && upiUrl && (
            <div className="border rounded p-3 text-center">
              <div className="text-sm text-gray-600 mb-2">Scan to pay {settings?.name} ({settings?.vpa})</div>
              <div className="flex justify-center">
                <QRCode value={upiUrl} size={160}/>
              </div>
              <a className="text-blue-600 text-xs underline break-all" href={upiUrl}>Open UPI App</a>
            </div>
          )}

          <button className="btn-primary w-full" disabled={cart.length===0 || creating || hasExceeding} onClick={createInvoice}>
            {creating? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
    {/* Mobile sticky action bar */}
    <div className="mobile-sticky md:hidden">
      <div className="text-sm">
        <div className="text-gray-500">Grand Total</div>
        <div className="font-semibold text-lg">₹ {money(grandTotal)}</div>
      </div>
      <button
        className="btn-primary flex-1"
        disabled={cart.length===0 || creating || hasExceeding}
        onClick={createInvoice}
      >
        {creating? 'Creating...' : 'Create Invoice'}
      </button>
    </div>
    </div>
  )
}
