import { Router } from 'express';
import jwt from 'jsonwebtoken';
import passport from '../auth/passport.js';

const router = Router();

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Unauthorized' });
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const token = jwt.sign({ id: user.id, email: user.email, phone: user.phone }, secret, { expiresIn: '30d' });
    res.json({ token, user });
  })(req, res, next);
});

router.get('/me', (req, res) => {
  return res.json({ ok: true });
});

export default router;
