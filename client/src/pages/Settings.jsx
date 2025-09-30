import { useState, useEffect } from 'react'

export default function Settings() {
  const [settings, setSettings] = useState(null)

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
    <div className="bg-white p-4 rounded shadow max-w-xl">
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
    </div>
  )
}
