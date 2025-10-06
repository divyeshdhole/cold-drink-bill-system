import { Router } from 'express'
import { z } from 'zod'
import Customer from '../models/Customer.js'
import Invoice from '../models/Invoice.js'
import getOwner from '../../helpers/ownerHelper.js'
import Transaction from '../models/Transaction.js'
const router = Router()

const customerSchema = z.object({
  name: z.string().min(1),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional()
})

// List/search customers
router.get('/', async (req, res)=>{
  try {
    const q = (req.query.q || '').toString().trim()
    let filter = {}
    if(q){
      const regex = new RegExp(q, 'i')
      filter = { $or: [ { name: regex }, { companyName: regex }, { phone: regex } ] }
    }
    const list = await Customer.find(filter).sort({ updatedAt: -1 }).limit(20)
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch customers', details: e.message })
  }
})

// Create customer
router.post('/', async (req, res)=>{
  try {
    
    const data = customerSchema.parse(req.body)
    //while creating customer trim all body data spaces
    data.name = data.name.trim()
    data.companyName = data.companyName?.trim()
    data.phone = data.phone?.trim()
    data.address = data.address?.trim()
    
    // upsert by phone if provided
    let created
    if(data.phone){
      created = await Customer.findOneAndUpdate({ phone: data.phone }, data, { new: true, upsert: true })
    } else {
      created = await Customer.create(data)
    }
    res.status(201).json(created)
  } catch (e) {
    if(e instanceof z.ZodError){
      return res.status(400).json({ error: 'Validation error', issues: e.issues })
    res.status(400).json({ error: e.message })
  }
}
})

// List customers with pending balances (amountToPaid > 0)
router.get('/pending', async (_req, res)=>{
  try{
    const list = await Customer.find({ amountToPaid: { $gt: 0 } })
      .sort({ updatedAt: -1 })
      .select({ name:1, companyName:1, phone:1, address:1, amountToPaid:1, previosDueDate:1, updatedAt:1 })
      .limit(200)
    res.json(list)
  }catch(e){
    res.status(500).json({ error: 'Failed to fetch pending customers', details: e.message })
  }
})

// Delete a customer and cleanup related data
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id
    const customer = await Customer.findById(id)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    // Block deletion if customer still has pending balance
    const pendingNow = Number(customer.amountToPaid || 0)
    if (pendingNow > 0) {
      return res.status(400).json({ error: 'Cannot delete customer with pending amount', pending: pendingNow })
    }

    // Adjust owner totals by removing this customer's pending from totalPending
    const owner = await getOwner()
    // Nothing to subtract because deletion is blocked when pending > 0
    await owner.save()

    // Delete related invoices and transactions
    const phone = customer.phone || ''
    const invResult = await Invoice.deleteMany({ customerPhone: phone })
    const txnResult = await Transaction.deleteMany({ customer: customer._id })

    // Delete the customer
    await Customer.deleteOne({ _id: customer._id })

    res.json({
      ok: true,
      deleted: {
        customer: 1,
        invoices: invResult.deletedCount || 0,
        transactions: txnResult.deletedCount || 0
      }
    })
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete customer', details: e.message })
  }
})

// Decrease a customer's pending balance (amountToPaid) by a partial payment
router.patch('/:phone/amount', async (req, res) => {
  try {
    const schema = z.object({ amount: z.number().positive() })
    const data = schema.parse(req.body)
    const phone = req.params.phone
    const customer = await Customer.findOne({ phone })
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    const prev = Number(customer.amountToPaid || 0)
    const next = Math.max(0, +(prev - Number(data.amount)).toFixed(2))
    customer.amountToPaid = next
    customer.previosDueDate = new Date()
    await customer.save()
    const owner = await getOwner()
    owner.totalReceived += data.amount
    //pending cant be negative
    if(owner.totalPending - data.amount < 0){
      owner.totalPending = 0
    } else {
      owner.totalPending -= data.amount
    }
    await owner.save()
    // If balance reaches zero, mark all pending invoices for this customer as paid
    if (next === 0) {
      const pending = await Invoice.find({ customerPhone: phone, status: { $ne: 'paid' } })
      for (const inv of pending) {
        const amtPaid = typeof inv.amountPaid === 'number' && inv.amountPaid > 0 ? inv.amountPaid : (inv.currentTotal || 0)
        await Invoice.findByIdAndUpdate(inv._id, {
          status: 'paid',
          paidAt: new Date(),
          amountPaid: amtPaid
        })
      }
    }
    await Transaction.create({
      type: 'payment',
      amount: data.amount,
      customer: customer._id,
      date: new Date()
    })
    res.json({ phone, previous: prev, amount: Number(data.amount), current: next })
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', issues: e.issues })
    res.status(400).json({ error: e.message })
  }
})

export default router
