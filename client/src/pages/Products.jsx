import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name:'', brand:'', sizeMl:'', sellingPrice:'', taxPercent:0, quantity:'' })
  const [creating, setCreating] = useState(false)
  const [addingId, setAddingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [savingId, setSavingId] = useState(null)

  // Load products
  async function loadProducts(){
    try{
      setLoading(true)
      const r = await fetch(`${import.meta.env.VITE_API_URL}/api/products`)
      if(!r.ok) throw new Error(await r.text())
      setProducts(await r.json())
    } catch(e){ console.warn('Load products failed:', e?.message) }
    finally{ setLoading(false) }
  }

  async function deleteProduct(id){
    try{
      const prod = products.find(p=> p._id === id)
      const name = prod?.name || 'this product'
      const ok = window.confirm(`Delete ${name}? This cannot be undone.`)
      if(!ok) return
      setDeletingId(id)
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/products/${id}`, { method: 'DELETE' })
      if(!resp.ok) throw new Error(await resp.text())
      await loadProducts()
      toast.success('Product deleted')
    } catch(e){
      toast.error(e?.message || 'Failed to delete product')
    } finally{
      setDeletingId(null)
    }
  }

  useEffect(()=>{ loadProducts() }, [])

  async function createProduct(){
    try{
      setCreating(true)
      const payload = { 
        name: form.name,
        brand: form.brand || undefined,
        sizeMl: form.sizeMl? Number(form.sizeMl): undefined,
        sellingPrice: Number(form.sellingPrice||0),
        taxPercent: Number(form.taxPercent||0),
        quantity: form.quantity!=='' ? Number(form.quantity||0) : undefined
      }
      if(!payload.name || !payload.sellingPrice){
        toast.error('Name and Selling Price are required')
        return
      }
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if(!resp.ok){
        const txt = await resp.text()
        throw new Error(txt || 'Failed to create product')
      }
      setForm({ name:'', brand:'', sizeMl:'', sellingPrice:'', taxPercent:0, quantity:'' })
      await loadProducts()
      toast.success('Product created')
    } catch(err){
      toast.error(err?.message || 'Failed to create product')
    } finally{
      setCreating(false)
    }
  }

  async function addStock(id, quantity){
    try{
      setAddingId(id)
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/products/${id}/add-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      })
      if(!resp.ok) throw new Error(await resp.text())
      await loadProducts()
      toast.success('Stock added')
    } catch(e){
      toast.error(e?.message || 'Failed to add stock')
    } finally{
      setAddingId(null)
    }
  }

  function startEdit(p){
    setEditRow({
      _id: p._id,
      name: p.name || '',
      brand: p.brand || '',
      sizeMl: p.sizeMl ?? '',
      sellingPrice: p.sellingPrice ?? '',
      taxPercent: p.taxPercent ?? 0,
      quantity: p.quantity ?? ''
    })
  }

  async function saveEdit(){
    if(!editRow) return
    try{
      setSavingId(editRow._id)
      const payload = {
        name: editRow.name,
        brand: editRow.brand || undefined,
        sizeMl: editRow.sizeMl!=='' ? Number(editRow.sizeMl) : undefined,
        sellingPrice: Number(editRow.sellingPrice||0),
        taxPercent: Number(editRow.taxPercent||0),
        quantity: editRow.quantity!=='' ? Number(editRow.quantity||0) : undefined
      }
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/products/${editRow._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if(!resp.ok) throw new Error(await resp.text())
      setEditRow(null)
      await loadProducts()
      toast.success('Product saved')
    } catch(e){
      toast.error(e?.message || 'Failed to save product')
    } finally{
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card md:col-span-1">
          <h2 className="font-semibold mb-3">Add Product</h2>
          <div className="space-y-2">
            <input className="input" placeholder="Name" value={form.name} onChange={e=> setForm({...form, name:e.target.value})} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className="input" placeholder="Brand" value={form.brand} onChange={e=> setForm({...form, brand:e.target.value})} />
              <input className="input" placeholder="Size (ml)" value={form.sizeMl} onChange={e=> setForm({...form, sizeMl:e.target.value})} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input className="input" placeholder="Price" value={form.sellingPrice} onChange={e=> setForm({...form, sellingPrice:e.target.value})} />
              <input className="input" placeholder="Tax %" value={form.taxPercent} onChange={e=> setForm({...form, taxPercent:e.target.value})} />
              <input className="input" placeholder="Qty" value={form.quantity} onChange={e=> setForm({...form, quantity:e.target.value})} />
            </div>
            <button className="btn-primary w-full" disabled={creating} onClick={createProduct}>
              {creating? 'Adding...' : 'Add Product'}
            </button>
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Products</h2>
            <button className="btn" onClick={loadProducts} disabled={loading}>{loading? 'Refreshing...' : 'Refresh'}</button>
          </div>
          {/* Desktop/table view */}
          <div className="overflow-x-auto hidden md:block">
            <table className="table-base">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Brand</th>
                  <th className="py-2 pr-3">Size(ml)</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Tax %</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p=> {
                  const isEditing = editRow?._id === p._id
                  return (
                    <tr key={p._id} className="border-t">
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input className="input" value={editRow.name} onChange={e=> setEditRow({...editRow, name:e.target.value})} />
                        ) : (
                          <div className="font-medium">{p.name}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <input className="input" value={editRow.brand} onChange={e=> setEditRow({...editRow, brand:e.target.value})} />
                        ) : (
                          <div className="text-sm text-slate-700">{p.brand}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 w-24">
                        {isEditing ? (
                          <input className="input" value={editRow.sizeMl} onChange={e=> setEditRow({...editRow, sizeMl:e.target.value})} />
                        ) : (
                          <div className="text-sm">{p.sizeMl}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 w-28">
                        {isEditing ? (
                          <input className="input" value={editRow.sellingPrice} onChange={e=> setEditRow({...editRow, sellingPrice:e.target.value})} />
                        ) : (
                          <div className="text-sm">₹ {Number(p.sellingPrice||0).toFixed(2)}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 w-24">
                        {isEditing ? (
                          <input className="input" value={editRow.taxPercent} onChange={e=> setEditRow({...editRow, taxPercent:e.target.value})} />
                        ) : (
                          <div className="text-sm">{Number(p.taxPercent||0)}%</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 w-24">
                        {isEditing ? (
                          <input className="input" value={editRow.quantity} onChange={e=> setEditRow({...editRow, quantity:e.target.value})} />
                        ) : (
                          <div className="text-sm">{p.quantity}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex justify-end gap-2">
                          {!isEditing && (
                            <>
                              <button className="btn" onClick={()=> startEdit(p)}>Edit</button>
                              <button className="btn" disabled={addingId===p._id} onClick={()=> addStock(p._id, 1)}>
                                {addingId===p._id? 'Adding...' : '+1 stock'}
                              </button>
                              <button className="btn" disabled={deletingId===p._id} onClick={()=> deleteProduct(p._id)}>
                                {deletingId===p._id? 'Deleting...' : 'Delete'}
                              </button>
                            </>
                          )}
                          {isEditing && (
                            <>
                              <button className="btn" onClick={()=> setEditRow(null)} disabled={savingId===p._id}>Cancel</button>
                              <button className="btn-primary" onClick={saveEdit} disabled={savingId===p._id}>
                                {savingId===p._id? 'Saving...' : 'Save'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {products.length===0 && !loading && (
              <div className="py-4 text-sm text-slate-500">No products yet.</div>
            )}
          </div>

          {/* Mobile/card view */}
          <div className="md:hidden space-y-3">
            {products.map(p=> {
              const isEditing = editRow?._id === p._id
              return (
                <div key={p._id} className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="mb-1">
                          <div className="text-xs text-slate-500 mb-1">Name</div>
                          <input className="input" value={editRow.name} onChange={e=> setEditRow({...editRow, name:e.target.value})} placeholder="Name" />
                        </div>
                      ) : (
                        <div className="font-medium truncate">{p.name}</div>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {isEditing ? (
                          <>
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Brand</div>
                              <input className="input" value={editRow.brand} onChange={e=> setEditRow({...editRow, brand:e.target.value})} placeholder="Brand" />
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Size (ml)</div>
                              <input className="input" value={editRow.sizeMl} onChange={e=> setEditRow({...editRow, sizeMl:e.target.value})} placeholder="Size (ml)" />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs text-slate-600 truncate"><span className="text-slate-500">Brand:</span> {p.brand || '-'}</div>
                            <div className="text-xs text-slate-600"><span className="text-slate-500">Size:</span> {p.sizeMl ? `${p.sizeMl} ml` : '-'}</div>
                          </>
                        )}
                      </div>
                      <div className="mt-2">
                        {isEditing ? (
                          <>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <div className="text-xs text-slate-500 mb-1">Price</div>
                                <input className="input" value={editRow.sellingPrice} onChange={e=> setEditRow({...editRow, sellingPrice:e.target.value})} placeholder="Price" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500 mb-1">Tax %</div>
                                <input className="input" value={editRow.taxPercent} onChange={e=> setEditRow({...editRow, taxPercent:e.target.value})} placeholder="Tax %" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500 mb-1">Qty</div>
                                <input className="input" value={editRow.quantity} onChange={e=> setEditRow({...editRow, quantity:e.target.value})} placeholder="Qty" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Price</span><span>₹ {Number(p.sellingPrice||0).toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Tax %</span><span>{Number(p.taxPercent||0)}%</span></div>
                            <div className="flex justify-between text-sm"><span className="text-slate-500">Qty</span><span>{p.quantity}</span></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {!isEditing && (
                      <>
                        <button className="btn flex-1" onClick={()=> startEdit(p)}>Edit</button>
                        <button className="btn flex-1" disabled={addingId===p._id} onClick={()=> addStock(p._id, 1)}>
                          {addingId===p._id? 'Adding...' : '+1 stock'}
                        </button>
                        <button className="btn flex-1" disabled={deletingId===p._id} onClick={()=> deleteProduct(p._id)}>
                          {deletingId===p._id? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    )}
                    {isEditing && (
                      <>
                        <button className="btn flex-1" onClick={()=> setEditRow(null)} disabled={savingId===p._id}>Cancel</button>
                        <button className="btn-primary flex-1" onClick={saveEdit} disabled={savingId===p._id}>
                          {savingId===p._id? 'Saving...' : 'Save'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {products.length===0 && !loading && (
              <div className="py-4 text-sm text-slate-500">No products yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
