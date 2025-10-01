import { Router } from 'express';
import { z } from 'zod';
import Product from '../models/Product.js';

const router = Router();

const productSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  sizeMl: z.coerce.number().optional(),
  sellingPrice: z.coerce.number().positive(),
  costPrice: z.coerce.number().nonnegative().optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  quantity: z.coerce.number().int().nonnegative().optional(),
  active: z.boolean().optional()
});

router.get('/', async (_req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch products', details: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = productSchema.parse(req.body);
    const created = await Product.create(data);
    res.status(201).json(created);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', issues: e.issues });
    }
    res.status(400).json({ error: e.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const updated = await Product.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/add-stock', async (req, res) => {
  try {
    const qty = Number(req.body.quantity || 0);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'quantity must be > 0' });
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { quantity: qty } },
      { new: true }
    );
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    await Product.findByIdAndDelete(id);
    return res.status(204).send();
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
