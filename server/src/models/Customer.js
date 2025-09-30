import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    companyName: { type: String },
    phone: { type: String, index: true },
    address: { type: String },
    amountToPaid: {type: String},
    amountPaid: {type: String},
    previosDueDate: {type: Date},
  },
  
  
  { timestamps: true }
);

export default mongoose.model('Customer', customerSchema);
