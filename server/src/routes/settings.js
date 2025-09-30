import { Router } from 'express'

const router = Router()

// GET /api/settings/upi
// Returns owner/shop details and UPI settings from server .env
router.get('/upi', (_req, res) => {
  const payload = {
    // Map from backend .env keys (BUSINESS_*) to a frontend-friendly shape
    name: process.env.BUSINESS_NAME || process.env.OWNER_NAME || '',
    phone: process.env.BUSINESS_PHONE || process.env.OWNER_PHONE || '',
    address: process.env.BUSINESS_ADDRESS || process.env.OWNER_ADDRESS || '',
    email: process.env.OWNER_EMAIL || '',
    gstin: process.env.BUSINESS_GSTIN || process.env.OWNER_GSTIN || '',
    vpa: process.env.BUSINESS_UPI_VPA || process.env.UPI_VPA || '',
    upiName: process.env.BUSINESS_UPI_NAME || '',
    currency: process.env.CURRENCY || process.env.UPI_CURRENCY || 'INR',
    taxPercent: Number(process.env.TAX_PERCENT || 0),
    publicUrl: process.env.SERVER_PUBLIC_URL || ''
  }
  res.json(payload)
})

export default router

