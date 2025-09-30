import React from 'react'
import { FiTag, FiBox, FiUser, FiFileText, FiSettings, FiLogOut, FiClock } from 'react-icons/fi'
import ReactDOM from 'react-dom/client'
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import './index.css'
import Products from './pages/Products.jsx'
import Billing from './pages/Billing.jsx'
import Invoices from './pages/Invoices.jsx'
import Settings from './pages/Settings.jsx'
import Customers from './pages/Customers.jsx'
import Pending from './pages/Pending.jsx'
import Login from './pages/Login.jsx'

function RequireAuth({ children }){
  const token = typeof window!== 'undefined' ? localStorage.getItem('auth_token') : null
  if(!token){
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App(){
  const location = useLocation()
  const navigate = useNavigate()
  const token = typeof window!== 'undefined' ? localStorage.getItem('auth_token') : null
  const hideBottomNav = location.pathname === '/login' || !token
  const handleLogout = ()=>{
    try{
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      toast.success('Logged out')
    }finally{
      navigate('/login', { replace: true })
    }
  }
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur border-b border-slate-200 bg-white/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-2">
          <h1 className="font-bold text-lg tracking-tight flex-1">Cold Drink Billing</h1>
          {token ? (
            <>
            {/* Mobile-only Logout button in header */}
            <button className="md:hidden p-2 rounded hover:bg-slate-100 active:bg-slate-200" onClick={handleLogout} aria-label="Logout">
              <FiLogOut size={20} />
            </button>
            <div className="hidden md:flex items-center gap-1 flex-nowrap overflow-x-auto">
              <NavLink to="/" className={({isActive})=>`nav-link ${isActive?'nav-link-active':''}`}>Billing</NavLink>
              <NavLink to="/products" className={({isActive})=>`nav-link ${isActive?'nav-link-active':''}`}>Products</NavLink>
              <NavLink to="/customers" className={({isActive})=>`nav-link ${isActive?'nav-link-active':''}`}>Customers</NavLink>
              <NavLink to="/pending" className={({isActive})=>`nav-link ${isActive?'nav-link-active':''}`}>Pending</NavLink>
              <NavLink to="/invoices" className={({isActive})=>`nav-link ${isActive?'nav-link-active':''}`}>Invoices</NavLink>
              <NavLink to="/settings" className={({isActive})=>`nav-link ${isActive?'nav-link-active':''}`}>Settings</NavLink>
              <button className="nav-link" onClick={handleLogout} title="Logout">Logout</button>
            </div>
            </>
          ) : (
            <div className="hidden" />
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">{/* extra bottom padding on mobile for bottom nav */}
        <Routes>
          <Route path="/login" element={<Login/>} />
          <Route path="/" element={<RequireAuth><Billing/></RequireAuth>} />
          <Route path="/products" element={<RequireAuth><Products/></RequireAuth>} />
          <Route path="/customers" element={<RequireAuth><Customers/></RequireAuth>} />
          <Route path="/pending" element={<RequireAuth><Pending/></RequireAuth>} />
          <Route path="/invoices" element={<RequireAuth><Invoices/></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Settings/></RequireAuth>} />
        </Routes>
      </main>

      {/* Bottom navigation for mobile */}
      {!hideBottomNav && (
      <nav className="bottom-nav md:hidden">
        <NavLink to="/" className={({isActive})=>`bottom-nav-item ${isActive?'bottom-nav-item-active':''}`}>
          <FiTag size={20} />
          <span className="text-xs">Billing</span>
        </NavLink>
        <NavLink to="/products" className={({isActive})=>`bottom-nav-item ${isActive?'bottom-nav-item-active':''}`}>
          <FiBox size={20} />
          <span className="text-xs">Products</span>
        </NavLink>
        <NavLink to="/customers" className={({isActive})=>`bottom-nav-item ${isActive?'bottom-nav-item-active':''}`}>
          <FiUser size={20} />
          <span className="text-xs">Customers</span>
        </NavLink>
        <NavLink to="/pending" className={({isActive})=>`bottom-nav-item ${isActive?'bottom-nav-item-active':''}`}>
          <FiClock size={20} />
          <span className="text-xs">Pending</span>
        </NavLink>
        <NavLink to="/invoices" className={({isActive})=>`bottom-nav-item ${isActive?'bottom-nav-item-active':''}`}>
          <FiFileText size={20} />
          <span className="text-xs">Invoices</span>
        </NavLink>
        {/* Logout moved to header on mobile */}
      </nav>
      )}
    </div>
  )
}

