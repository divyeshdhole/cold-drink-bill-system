import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'




// Attach Authorization header globally
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    try {
      const token = localStorage.getItem('auth_token')
      const headers = new Headers(init.headers || {})
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      const resp = await originalFetch(input, { ...init, headers })
      if (resp.status === 401) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        if (!String(window.location.pathname).startsWith('/login')) {
          window.location.replace('/login')
        }
      }
      return resp
    } catch (e) {
      throw e
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
      <BrowserRouter>
        <App/>
        <ToastContainer position="top-right" autoClose={3000} newestOnTop draggable pauseOnHover />
      </BrowserRouter>
  </React.StrictMode>
)
