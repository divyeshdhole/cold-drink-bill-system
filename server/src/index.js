import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import productRoutes from './routes/products.js';
import invoiceRoutes from './routes/invoices.js';
import settingsRoutes from './routes/settings.js';
import Product from './models/Product.js';
import customersRoutes from './routes/customers.js';
import transactionsRoutes from './routes/transactions.js';
import passport from './auth/passport.js';
import authRoutes from './routes/auth.js';
import authJwt from './middleware/authJwt.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(passport.initialize());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Public auth routes
app.use('/api/auth', authRoutes);

// Public invoice assets (image, qr)
app.use('/api/invoices', (req, res, next) => {
  if (
    req.method === 'GET' && (
      /\/image$/.test(req.path) || /\/upi-qr\.png$/.test(req.path)
    )
  ) {
    return next();
  }
  return authJwt(req, res, next);
}, invoiceRoutes);

// Protected APIs
app.use('/api/products', authJwt, productRoutes);
app.use('/api/settings', authJwt, settingsRoutes);
app.use('/api/customers', authJwt, customersRoutes);
app.use('/api/transactions', authJwt, transactionsRoutes);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coldrink_bill';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    // Drop legacy index on removed field `sku` if it still exists
    (async () => {
      try {
        const indexes = await Product.collection.indexes();
        const hasSkuIndex = indexes?.some(idx => idx?.name === 'sku_1');
        if (hasSkuIndex) {
          await Product.collection.dropIndex('sku_1');
          console.log('Dropped legacy index sku_1');
        }
      } catch (e) {
        console.warn('Index check/drop failed (non-fatal):', e?.message);
      }
    })();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

