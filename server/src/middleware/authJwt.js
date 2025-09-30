import jwt from 'jsonwebtoken';

export default function authJwt(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const payload = jwt.verify(token, secret);
    // Verify owner phone constraint
    const ownerPhone = (process.env.BUSINESS_PHONE || '').replace(/\D/g, '');
    const userPhone = (payload?.phone || '').replace(/\D/g, '');
    if (!ownerPhone || ownerPhone !== userPhone) {
      return res.status(403).json({ error: 'Phone not authorized' });
    }
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token', details: e.message });
  }
}
