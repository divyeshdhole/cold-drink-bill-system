import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    nameSnapshot: String,
    qty: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    taxPercent: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true }
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    customerName: String,
    customerPhone: String,
    customerAddress: String,
    customerCompany: String,
    items: [invoiceItemSchema],
    subTotal: Number,
    discount: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    rounding: { type: Number, default: 0 },
    // currentTotal: amount for this bill only (after discount and rounding)
    currentTotal: { type: Number, default: 0 },
    // previousDue: carry-forward due from previous unpaid invoices for this customer
    previousDue: { type: Number, default: 0 },
    // snapshot of customer's previous due start date at the time of invoice creation
    previousDueDateSnapshot: { type: Date },
    total: { type: Number, required: true },
    paymentMode: { type: String, enum: ['cash', 'upi', 'card'], default: 'upi' },
    paymentRef: String,
    status: { type: String, enum: ['pending', 'paid'], default: 'pending', index: true },
    amountPaid: { type: Number, default: 0 },
    paidAt: { type: Date },
    whatsappSent: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model('Invoice', invoiceSchema);
