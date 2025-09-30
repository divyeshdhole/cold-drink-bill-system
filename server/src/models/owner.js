import mongoose from "mongoose";

const OwnerSchema = new mongoose.Schema({
  totalBills: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  totalReceived: { type: Number, default: 0 },
  totalPending: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("Owner", OwnerSchema);