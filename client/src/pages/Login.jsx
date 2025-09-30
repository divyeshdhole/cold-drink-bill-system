import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

export default function Login() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      setLoading(true)
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || 'Access denied')
      }
      const data = await res.json()
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('auth_user', JSON.stringify(data.user || {}))
      toast.success('Access granted')
      navigate('/')
    } catch (e) {
      setError(e?.message || 'Access denied')
      toast.error('Access denied')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto bg-white p-4 rounded shadow">
      <h1 className="text-lg font-semibold mb-3">Login</h1>
      {/* Showing toast instead of inline error */}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Owner Phone</label>
          <input className="input" value={phone} onChange={e=> setPhone(e.target.value)} placeholder="" inputMode="tel" autoComplete="tel" autoFocus required />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Password</label>
          <input className="input" type="password" value={password} onChange={e=> setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? 'Getting access...' : 'Get Access'}
        </button>
      </form>
    </div>
  )
}
