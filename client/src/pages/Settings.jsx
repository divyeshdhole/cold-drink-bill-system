import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'

export default function Settings(){
  const [settings, setSettings] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const [wiping, setWiping] = useState(false)

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/settings/upi`)
      const data = await res.json()
      setSettings(data)
    } catch (err) {
      console.error('Error fetching settings:', err)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  return (
    <div className="bg-white p-4 rounded shadow max-w-xl space-y-6">
      <h2 className="font-semibold mb-3">Business Settings (read-only for now)</h2>
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-gray-500">Business Name</div>
          <div className="font-medium">{settings?.businessName || '-'}</div>
        </div>
        <div>
          <div className="text-gray-500">UPI VPA</div>
          <div className="font-medium">{settings?.vpa || '-'}</div>
        </div>
        <div>
          <div className="text-gray-500">Payee Name</div>
          <div className="font-medium">{settings?.name || '-'}</div>
        </div>
        <div>
          <div className="text-gray-500">Currency</div>
          <div className="font-medium">{settings?.currency || 'INR'}</div>
        </div>
      </div>
      <div className="pt-4 border-t">
        <h3 className="font-semibold text-red-700 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-600 mb-2">Hard Reset will delete ALL invoices, customers, and transactions, and reset owner totals. This cannot be undone.</p>
        <label className="block text-sm text-gray-700 mb-1">Type <span className="font-mono">confirm</span> to enable</label>
        <input
          className="input w-full mb-2"
          placeholder="confirm"
          value={confirmText}
          onChange={(e)=> setConfirmText(e.target.value)}
        />
        <button
          className={`btn border-red-300 text-red-700 hover:bg-red-50 ${confirmText==='confirm' && !wiping ? '' : 'opacity-60 cursor-not-allowed'}`}
          disabled={confirmText!=='confirm' || wiping}
          onClick={async ()=>{
            const really = window.confirm('This will WIPE ALL DATA. Are you absolutely sure?')
            if(!really) return
            try{
              setWiping(true)
              const r = await fetch(import.meta.env.VITE_API_URL + '/api/invoices/hard-reset', { method: 'POST' })
              if(!r.ok) throw new Error(await r.text())
              setConfirmText('')
              toast.success('All data wiped successfully')
            }catch(e){
              console.error(e)
              toast.error(e?.message || 'Failed to hard reset')
            }finally{
              setWiping(false)
            }
          }}
        >{wiping? 'Wiping…' : 'Hard Reset (wipe all data)'}</button>
      </div>
    </div>
  )
}
