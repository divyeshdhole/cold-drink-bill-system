import { Router } from 'express'
import Transaction from '../models/Transaction.js'

const router = Router()

// List recent transactions
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)))
    const list = await Transaction.find()
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .populate('customer', 'name companyName phone')
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch transactions', details: e.message })
  }
})

export default router
