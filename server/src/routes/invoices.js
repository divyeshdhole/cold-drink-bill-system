import { Router } from 'express';
import { z } from 'zod';
import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import { generateInvoicePDFBuffer } from '../services/pdf.js';
import { renderInvoicePNGBuffer } from '../services/invoiceImage.js';
import { sendWhatsAppDocument, sendWhatsAppImage } from '../services/whatsapp.js';
import QRCode from 'qrcode';
import Customer from '../models/Customer.js';
import getOwner from '../../helpers/ownerHelper.js';
import Transaction from '../models/Transaction.js';
const router = Router();

const itemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
  unitPrice: z.number().positive(),
  taxPercent: z.number().min(0).max(100).optional().default(0)
});

// Hard reset: wipe all business data (invoices, customers, transactions) and reset owner aggregates
// WARNING: This endpoint is destructive. Protect it with auth in production.
router.post('/hard-reset', async (_req, res) => {
  try {
    // Delete all invoices, customers, and transactions
    await Invoice.deleteMany({});
    await Customer.deleteMany({});
    await Transaction.deleteMany({});
    // Reset owner aggregates
    const owner = await getOwner();
    owner.totalBills = 0;
    owner.totalAmount = 0;
    owner.totalReceived = 0;
    owner.totalPending = 0;
    await owner.save();

    res.json({ ok: true, message: 'All data wiped and owner totals reset' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to perform hard reset', details: e.message });
  }
});

// Delete all transactions (dangerous; add auth in production)
router.post('/transactions/delete-all', async (_req, res) => {
  try {
    const result = await Transaction.deleteMany({});
    res.json({ ok: true, deletedCount: result.deletedCount || 0 });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete transactions', details: e.message });
  }
});

// Generate a UPI QR PNG for the invoice total
router.get('/:id/upi-qr.png', async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    const vpa = process.env.BUSINESS_UPI_VPA;
    const name = process.env.BUSINESS_UPI_NAME || process.env.BUSINESS_NAME || '';
    const currency = process.env.CURRENCY || 'INR';
    if (!vpa) return res.status(400).json({ error: 'UPI VPA not configured' });
    const amt = Number(inv.total || 0).toFixed(2);
    const qrText = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${amt}&cu=${encodeURIComponent(currency)}`;
    const png = await QRCode.toBuffer(qrText, { type: 'png', width: 300 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${inv.number}-upi-qr.png"`);
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate UPI QR', details: e.message });
  }
});

const invoiceSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  customerCompany: z.string().optional(),
  items: z.array(itemSchema).min(1),
  discount: z.number().min(0).optional().default(0),
  paymentMode: z.enum(['cash', 'upi', 'card']).optional().default('upi'),
  previousDue: z.number().min(0).optional().default(0),
  // optional snapshot date string from client (ISO)
  previousDueDateSnapshot: z.string().optional(),
  autoSendWhatsapp: z.boolean().optional().default(false)
});

function roundTo2(n){return Math.round(n * 100) / 100}

router.get('/', async (_req, res) => {
  const list = await Invoice.find().sort({ createdAt: -1 }).limit(100);
  res.json(list);
});

// Bulk delete invoices (paid only)
router.delete('/', async (req, res) => {
  try{
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []
    if(ids.length === 0) return res.status(400).json({ error: 'ids array is required' })
    // Find invoices and split by status
    const found = await Invoice.find({ _id: { $in: ids } }, { _id:1, status:1 })
    const paidIds = found.filter(i=> i.status === 'paid').map(i=> i._id)
    const nonPaid = found.filter(i=> i.status !== 'paid').map(i=> String(i._id))
    // Delete only paid
    const r = await Invoice.deleteMany({ _id: { $in: paidIds } })
    res.json({ deletedCount: r.deletedCount || 0, skipped: nonPaid })
  }catch(e){
    res.status(500).json({ error: 'Failed to delete invoices', details: e.message })
  }
})

// Generate and stream invoice Image (PNG)
router.get('/:id/image', async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    const business = {
      name: process.env.BUSINESS_NAME,
      address: process.env.BUSINESS_ADDRESS,
      phone: process.env.BUSINESS_PHONE,
      gstin: process.env.BUSINESS_GSTIN
    };
    const upi = { vpa: process.env.BUSINESS_UPI_VPA, name: process.env.BUSINESS_UPI_NAME, currency: process.env.CURRENCY || 'INR' };
    const png = await renderInvoicePNGBuffer({ business, invoice: inv.toObject(), upi });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${inv.number}.png"`);
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate Image', details: e.message });
  }
});

// Owner stats: totals and pending
router.get('/owner-stats', async (_req, res) => {
  try {
    const owner = await getOwner()
    console.log("the owner data is:", owner)
    res.json({
      totalBills: Number(owner.totalBills || 0),
      totalAmount: Number(owner.totalAmount || 0),
      totalReceived: Number(owner.totalReceived || 0),
      totalPending: Number(owner.totalPending || 0)
    })
  } catch (e) {
    res.status(500).json({ error: 'Failed to load owner stats', details: e.message })
  }
})

// Reset owner aggregates to zero (dangerous; add auth in production)
router.post('/owner-stats/reset', async (_req, res) => {
  try {
    const owner = await getOwner();
    owner.totalBills = 0;
    owner.totalAmount = 0;
    owner.totalReceived = 0;
    await owner.save();
    res.json({ ok: true, message: 'Owner totals reset', owner: {
      totalBills: owner.totalBills,
      totalAmount: owner.totalAmount,
      totalReceived: owner.totalReceived,
      totalPending: owner.totalPending
    }});
    
  } catch (e) {
    res.status(500).json({ error: 'Failed to reset owner totals', details: e.message });
  }
});



// Get previous due amount by customer phone
router.get('/due', async (req, res) => {
  try {
    
    const phone = (req.query.phone || '').toString().trim();
    let customer = await Customer.findOne({phone: phone})
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    // if (!phone) return res.status(400).json({ error: 'phone is required' });
    // const invoices = await Invoice.find({ customerPhone: phone, status: { $ne: 'paid' } });
    // const due = invoices.reduce((s, inv) => s + ((inv.total || 0) - (inv.amountPaid || 0)), 0);
    res.json({ phone, due: customer.amountToPaid, previousDueDate: customer.previosDueDate || null });
  } catch (e) {
    res.status(500).json({ error: 'Failed to compute due', details: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const inv = await Invoice.findById(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  res.json(inv);
});

// List invoices for a customer, grouped by status
router.get('/by-customer/search', async (req, res) => {
  try {
    const phone = (req.query.phone || '').toString().trim();
    const name = (req.query.name || '').toString().trim();
    const company = (req.query.company || '').toString().trim();
    
    
    if (!phone && !name && !company) return res.status(400).json({ error: 'Provide phone, name, or company to search' });
    // console.log(phone)
    const list = await Invoice.find({customerPhone: phone}).sort({ createdAt: -1 });
    
    const paid = list.filter(i => i.status === 'paid');
    const pending = list.filter(i => i.status !== 'paid');
    res.json({ paid, pending});
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch customer invoices', details: e.message });
  }
});

// Update invoice payment status
router.patch('/:id/status', async (req, res) => {
  try {
    const schema = z.object({
      status: z.enum(['pending', 'paid']),
      amountPaid: z.number().nonnegative().optional(),
      paymentRef: z.string().optional()
    });
    // Load invoice and customer to adjust customer's rolling balance after status change
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    const customer = await Customer.findOne({ phone: invoice.customerPhone });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const data = schema.parse(req.body);
    const patch = { status: data.status };
    if (data.status === 'paid') {
      patch.paidAt = new Date();
      if (typeof data.amountPaid === 'number') patch.amountPaid = data.amountPaid;
      if (data.paymentRef) patch.paymentRef = data.paymentRef;
    } else {
      patch.paidAt = undefined;
    }
    const owner = await getOwner();
    if (data.status === 'paid') {
      // Capture customer's rolling balance BEFORE zeroing it out
      const prevBalance = Number(customer.amountToPaid || 0);
      // Increase received by the actually settled balance
      owner.totalReceived += prevBalance;
      // Decrease pending by the same amount to keep aggregates 
      // pending cant be negative
      if(owner.totalPending - prevBalance < 0){
        owner.totalPending = 0;
      } else {
        owner.totalPending = roundTo2(owner.totalPending - prevBalance);
      } 
      await owner.save();

      // Record a transaction for this payment
      try {
        await Transaction.create({
          type: 'payment',
          amount: prevBalance,
          customer: customer._id,
          date: new Date()
        });
      } catch (_) {
        // Non-fatal: logging only; do not block payment marking
        console.warn('Failed to record payment transaction');
      }
    }
    const updated = await Invoice.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    // If invoice marked paid: mark all previous pending invoices for this customer as paid too
    // and zero out customer's rolling balance. This enforces the rule:
    // "if current bill is paid then previous bills automatically get paid".
    if (updated.status === 'paid') {
      // 1) Mark the current invoice amount as paid (already set above).
      // 2) Find all older pending invoices for this customer and mark them paid with their currentTotal.
      const olderPending = await Invoice.find({
        customerPhone: updated.customerPhone,
        status: { $ne: 'paid' },
        _id: { $ne: updated._id },
        createdAt: { $lte: updated.createdAt }
      }).sort({ createdAt: -1 });
      for (const inv of olderPending) {
        await Invoice.findByIdAndUpdate(inv._id, {
          status: 'paid',
          paidAt: new Date(),
          amountPaid: typeof inv.amountPaid === 'number' && inv.amountPaid > 0 ? inv.amountPaid : (inv.currentTotal || 0)
        });
      }
      // 3) Zero out customer's rolling balance since all dues are now considered settled
      customer.amountToPaid = 0;
      await customer.save();
    }
    res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', issues: e.issues });
    res.status(400).json({ error: e.message });
  }
});
// Generate and stream invoice PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    const business = {
      name: process.env.BUSINESS_NAME,
      address: process.env.BUSINESS_ADDRESS,
      phone: process.env.BUSINESS_PHONE,
      gstin: process.env.BUSINESS_GSTIN
    };
    const upi = { vpa: process.env.BUSINESS_UPI_VPA, name: process.env.BUSINESS_UPI_NAME, currency: process.env.CURRENCY || 'INR' };
    const pdf = await generateInvoicePDFBuffer({ business, invoice: inv.toObject(), upi });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${inv.number}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate PDF', details: e.message });
  }
});

// Send an invoice PDF to WhatsApp on demand
router.post('/:id/send-whatsapp', async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      return res.status(400).json({ error: 'WhatsApp not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID' });
    }

    const toPhone = (req.body?.toPhone || inv.customerPhone || '').toString().trim();
    if (!toPhone) return res.status(400).json({ error: 'Recipient phone not available' });

    const publicBase = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
    const mode = (req.body?.mode || 'pdf').toString();
    const caption = `${process.env.BUSINESS_NAME || 'Invoice'} ${inv.number}`;

    if (mode === 'image') {
      const imageUrl = `${publicBase}/api/invoices/${inv._id}/image`;
      await sendWhatsAppImage({ toPhone, imageUrl, caption });
    } else {
      const pdfUrl = `${publicBase}/api/invoices/${inv._id}/pdf`;
      await sendWhatsAppDocument({ toPhone, documentUrl: pdfUrl, caption });
    }
    await Invoice.findByIdAndUpdate(inv._id, { whatsappSent: true });
    res.json({ ok: true, sentTo: toPhone, invoiceId: inv._id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send WhatsApp message', details: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = invoiceSchema.parse(req.body);
    // compute totals
    //trim all the data
    data.customerName = data.customerName?.trim()
    data.customerPhone = data.customerPhone?.trim()
    data.customerAddress = data.customerAddress?.trim()
    data.paymentMode = data.paymentMode?.trim()
    console.log(JSON.stringify(data) + "----------------------------------------------------")
    const populatedItems = [];
    let subTotal = 0;
    let taxTotal = 0;

    for (const it of data.items) {
      const prod = await Product.findById(it.productId);
      if (!prod) return res.status(400).json({ error: `Product ${it.productId} not found` });
      if (prod.quantity < it.qty) return res.status(400).json({ error: `Insufficient stock for ${prod.name}` });

      const line = roundTo2(it.qty * it.unitPrice);
      const lineTax = roundTo2((line * (it.taxPercent ?? prod.taxPercent ?? 0)) / 100);
      subTotal += line;
      taxTotal += lineTax;

      populatedItems.push({
        productId: prod._id,
        nameSnapshot: prod.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        taxPercent: it.taxPercent ?? prod.taxPercent ?? 0,
        lineTotal: roundTo2(line + lineTax)
      });
    }

    subTotal = roundTo2(subTotal);
    taxTotal = roundTo2(taxTotal);
    const discount = roundTo2(data.discount || 0);
    let currentTotal = roundTo2(subTotal + taxTotal - discount);
    const rounding = roundTo2(Math.round(currentTotal) - currentTotal);
    currentTotal = roundTo2(currentTotal + rounding);

    // Derive previous due from customer's rolling balance (authoritative)
    const customerDoc = data.customerPhone ? await Customer.findOne({ phone: data.customerPhone }) : null;
    const prevBalance = Number(customerDoc?.amountToPaid || 0);
    const previousDue = prevBalance;
    const total = roundTo2(currentTotal + previousDue);

    // Update customer's rolling balance by adding only the current bill amount
    if (customerDoc) {
      const nextBalance = roundTo2(prevBalance + currentTotal);
      // If no prior due, clear the due-start date; if prior due exists, keep as-is
      customerDoc.amountToPaid = nextBalance;
      customerDoc.previosDueDate = new Date();
      await customerDoc.save();
    }

    // Owner aggregates update for NEW bill amount only
    const owner = await getOwner();
    owner.totalBills += 1;
    owner.totalAmount += currentTotal;
    owner.totalPending += currentTotal;
    await owner.save();

    // Decide previousDueDateSnapshot to store on invoice
    let previousDueDateSnapshot = null;
    if (previousDue > 0) {
      if (data.previousDueDateSnapshot) {
        const d = new Date(data.previousDueDateSnapshot);
        if (!isNaN(d.getTime())) previousDueDateSnapshot = d;
      }
      if (!previousDueDateSnapshot && customerDoc?.previosDueDate) {
        previousDueDateSnapshot = customerDoc.previosDueDate;
      }
    }

    // Create invoice document
    const number = 'INV-' + Date.now();
    const created = await Invoice.create({
      number,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      customerCompany: data.customerCompany,
      items: populatedItems,
      subTotal,
      discount,
      taxTotal,
      rounding,
      total,
      amountPaid: 0,
      status: 'pending',
      previousDue,
      previousDueDateSnapshot,
      currentTotal,
      paymentMode: data.paymentMode
    });

    // decrement stock
    for (const it of data.items) {
      await Product.findByIdAndUpdate(it.productId, { $inc: { quantity: -it.qty } });
    }

    // Optionally auto-send WhatsApp with PDF
    (async () => {
      try {
        if (data.autoSendWhatsapp && created.customerPhone && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
          const publicBase = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
          const pdfUrl = `${publicBase}/api/invoices/${created._id}/pdf`;
          const caption = `${process.env.BUSINESS_NAME || 'Invoice'} ${created.number}`;
          await sendWhatsAppDocument({ toPhone: created.customerPhone, documentUrl: pdfUrl, caption });
          await Invoice.findByIdAndUpdate(created._id, { whatsappSent: true });
        }
      } catch (e) {
        console.warn('WhatsApp auto-send failed:', e?.message);
      }
    })();

    res.status(201).json(created);
  } catch (e) {
    console.log(e);
    res.status(400).json({ error: e.message });
  }
});

export default router;
