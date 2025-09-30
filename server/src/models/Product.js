import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brand: { type: String },
    sizeMl: { type: Number },
    sellingPrice: { type: Number, required: true },
    costPrice: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);
