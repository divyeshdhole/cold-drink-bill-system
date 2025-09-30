import mongoose from "mongoose";
import { date } from "zod";

const TransactionSchema = new mongoose.Schema({
    type: String,
    amount: Number,
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer"
    },
    date : {
        type: Date,
        default: Date.now
    }
})

export default mongoose.model('Transaction', TransactionSchema);
