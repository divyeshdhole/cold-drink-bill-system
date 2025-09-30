import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

passport.use(
  new LocalStrategy(
    { usernameField: 'phone', passwordField: 'password', passReqToCallback: true },
    async (_req, phoneInput, password, done) => {
      try {
        const ownerPhone = (process.env.BUSINESS_PHONE || '').replace(/\D/g, '');
        const providedPhone = String(phoneInput || '').replace(/\D/g, '');
        const ownerPassword = process.env.OWNER_PASSWORD || '';
        if (!ownerPhone || !providedPhone || ownerPhone !== providedPhone) {
          return done(null, false, { message: 'Phone not authorized' });
        }
        if (!ownerPassword || password !== ownerPassword) {
          return done(null, false, { message: 'Invalid password' });
        }
        // Minimal user payload
        return done(null, { phone: providedPhone });
      } catch (e) {
        return done(e);
      }
    }
  )
);

export default passport;
