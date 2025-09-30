import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

export default function Pending() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [payInputs, setPayInputs] = useState({}) // phone -> amount string
  const [savingFor, setSavingFor] = useState(null)
  const [txns, setTxns] = useState([])
  const [loadingTxns, setLoadingTxns] = useState(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    fetch(`${import.meta.env.VITE_API_URL}/api/customers/pending`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text())
        return r.json()
      })
      .then((data) => {
        if (isMounted) setList(data || [])
      })
      .catch(() => {})
      .finally(() => isMounted && setLoading(false))
    return () => { isMounted = false }
  }, [])

  // Load recent transactions
  useEffect(() => {
    let isMounted = true
    setLoadingTxns(true)
    fetch(import.meta.env.VITE_API_URL+'/api/transactions?limit=50')
      .then(async (r)=>{ if(!r.ok) throw new Error(await r.text()); return r.json() })
      .then((data)=>{ if(isMounted) setTxns(data||[]) })
      .catch(()=>{})
      .finally(()=>{ if(isMounted) setLoadingTxns(false) })
    return ()=>{ isMounted = false }
  }, [])

  const filtered = list.filter((c) => {
    if (!q) return true
    const term = q.toLowerCase()
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.companyName || '').toLowerCase().includes(term) ||
      (c.phone || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="bg-white p-4 rounded shadow space-y-8">
      {/* Transactions section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold tracking-tight">Recent Transactions</h2>
          <button className="btn" onClick={async ()=>{
            try{ setLoadingTxns(true); const r = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions?limit=50`); if(!r.ok) throw new Error(await r.text()); setTxns(await r.json()) }
            catch(_){ toast.error('Failed to refresh transactions') }
            finally{ setLoadingTxns(false) }
          }}>{loadingTxns? 'Refreshing…' : 'Refresh'}</button>
        </div>
        {loadingTxns && <div className="text-sm text-gray-500">Loading…</div>}
        {!loadingTxns && txns.length===0 && (
          <div className="text-sm text-gray-500">No transactions</div>
        )}
        {!loadingTxns && txns.length>0 && (
          <div className="overflow-x-auto border rounded">
            <table className="table-base w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-xs text-slate-600">
                  <th className="py-2 px-3 text-left">Date</th>
                  <th className="py-2 px-3 text-left">Customer</th>
                  <th className="py-2 px-3 text-left">Type</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txns.map(t=> {
                  const type = String(t.type||'').toLowerCase()
                  const typeClass = type==='payment' ? 'bg-green-100 text-green-700 border-green-200' : type==='sale' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                  const amtClass = type==='payment' ? 'text-green-700' : type==='sale' ? 'text-slate-900' : 'text-slate-900'
                  return (
                    <tr key={t._id} className="border-t">
                      <td className="py-2 px-3 text-xs whitespace-nowrap">{t.date? new Date(t.date).toLocaleString() : ''}</td>
                      <td className="py-2 px-3 text-sm">
                        <div className="font-medium">{t.customer?.name || ''}{t.customer?.companyName? ` · ${t.customer.companyName}`:''}</div>
                        <div className="text-xs text-gray-500">{t.customer?.phone || ''}</div>
                      </td>
                      <td className="py-2 px-3 text-xs">
                        <span className={`inline-block px-2 py-0.5 rounded-full border ${typeClass}`}>{t.type}</span>
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${amtClass}`}>₹ {Number(t.amount||0).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending section */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold tracking-tight">Pending Customers</h2>
          <input
            className="input w-64 max-w-full"
            placeholder="Search name / phone / company"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {!loading && filtered.length === 0 && (
        <div className="text-sm text-gray-500">No pending balances</div>
      )}
      {!loading && filtered.length > 0 && (
        <div className="divide-y">
          {filtered.map((c) => (
            <div key={c._id} className="py-3 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
              <div className="md:col-span-2">
                <div className="font-medium text-sm">
                  {c.name} {c.companyName ? `· ${c.companyName}` : ''}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {c.phone && <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">{c.phone}</span>}
                  {c.address && <span className="truncate max-w-[240px]">{c.address}</span>}
                </div>
              </div>
              <div className="text-sm text-red-600 font-semibold">₹ {Number(c.amountToPaid || 0).toFixed(2)}</div>
              <div className="text-xs text-gray-500">
                {c.previosDueDate ? new Date(c.previosDueDate).toLocaleString() : ''}
              </div>
              <div className="flex gap-2 justify-start md:justify-end">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input w-28"
                  placeholder="Amount"
                  value={payInputs[c.phone] ?? ''}
                  onChange={(e)=> setPayInputs(prev=> ({...prev, [c.phone]: e.target.value}))}
                />
                <button
                  className="btn-primary"
                  disabled={savingFor === c.phone || Number(payInputs[c.phone]||0) <= 0}
                  onClick={async ()=>{
                    const amt = Number(payInputs[c.phone]||0)
                    if(!amt || amt<=0) return
                    let proceed = true
                    if(amt > Number(c.amountToPaid||0)){
                      proceed = window.confirm('Entered amount exceeds pending. Proceed to set balance to 0?')
                    } else {
                      proceed = window.confirm(`Settle ₹ ${amt.toFixed(2)} for ${c.name || c.phone}?`)
                    }
                    if(!proceed){ toast.info('Cancelled'); return }
                    try{
                      setSavingFor(c.phone)
                      const r = await fetch(`${import.meta.env.VITE_API_URL}/api/customers/${encodeURIComponent(c.phone)}/amount`, {
                        method:'PATCH',
                        headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ amount: amt })
                      })
                      if(!r.ok) throw new Error(await r.text())
                      const res = await r.json()
                      // Update list locally
                      setList(prev => prev.map(x=> x.phone===c.phone ? { ...x, amountToPaid: res.current, previosDueDate: new Date().toISOString() } : x))
                      setPayInputs(prev=> ({...prev, [c.phone]: ''}))
                      toast.success('Payment applied')
                      // Refresh transactions after payment
                      try{ const tr = await fetch(import.meta.env.VITE_API_URL + '/api/transactions?limit=50'); if(tr.ok) setTxns(await tr.json()) } catch(_){}
                    }catch(e){
                      toast.error(e?.message || 'Failed to apply payment')
                    }finally{
                      setSavingFor(null)
                    }
                  }}
                >
                  {savingFor === c.phone ? 'Saving...' : 'Settle'}
                </button>
                <a className="btn" href={`/customers`}>View Invoices</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
    </div>
  )
}
