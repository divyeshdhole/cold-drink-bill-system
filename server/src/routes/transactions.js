import { Router } from 'express'
import Transaction from '../models/Transaction.js'
import Invoice from '../models/Invoice.js'

const router = Router()

// List recent transactions

// delete all transactions
router.delete('/delete-all', async (req, res) => {
  try {
    await Transaction.deleteMany()
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete transactions', details: e.message })
  }
})

// Today's quick stats: payments received today and pending added today
router.get('/stats/today', async (_req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    // 1️⃣ Total amount received today (from Transaction)
    const payments = await Transaction.aggregate([
      { $match: { type: 'payment', date: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } }
    ]);
    const receivedToday = Number(payments?.[0]?.total || 0);

    // 2️⃣ Total pending amount from invoices created today
    const pendingSales = await Invoice.aggregate([
      {
        $match: {
          status: 'pending',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalPending: { $sum: { $ifNull: ['$currentTotal', 0] } }
        }
      }
    ]);

    const pendingToday = Number(pendingSales?.[0]?.totalPending || 0);

    // ✅ Send both separately — don't subtract, they represent different flows
    res.json({ receivedToday, pendingToday });

  } catch (e) {
    console.error('Error in /stats/today:', e);
    res.status(500).json({
      error: 'Failed to compute today stats',
      details: e.message
    });
  }
});

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
