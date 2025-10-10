// src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../model';
import { ensureAuth, signToken } from '../auth'; // <-- central signer

const router = Router();

function toPublic(u: any) {
  const obj = u.toObject ? u.toObject() : u;
  const { passwordHash, __v, ...rest } = obj;
  return rest;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const { email, password } = parsed.data;

  // case-insensitive email match
  const u = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
  if (!u) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // sign with numeric public id
  const token = signToken(u.id);

  // return the stored flag (no more demo logic)
  const resetRequired = !!u.resetRequired;

  return res.json({ token, user: toPublic(u), resetRequired });
});

// POST /api/auth/forgot  (always 200)
router.post('/forgot', async (_req, res) => {
  // do not leak whether email exists
  return res.json({ ok: true, message: 'If the email exists, a temporary password has been sent.' });
});

// GET /api/auth/me  (useful for client to refresh session)
router.get('/me', ensureAuth, async (req: any, res) => {
  const me = await User.findOne({ id: req.user.id });
  if (!me) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: toPublic(me) });
});

// POST /api/auth/change-password
router.post('/change-password', ensureAuth, async (req: any, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const me = await User.findOne({ id: req.user.id });
  if (!me) return res.status(404).json({ error: 'User not found' });

  const ok = await bcrypt.compare(parsed.data.currentPassword, me.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

  me.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  // clear the first-login flag after successful change
  me.resetRequired = false;

  await me.save();
  return res.json({ ok: true });
});

router.post('/signup', async (req, res) => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    companyName: z.string().optional(),
    currency: z.string().optional(),
    country: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  try {
    // allow signup only if there are NO users (initial bootstrap)
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return res.status(403).json({ error: 'Signup is disabled after initial setup' });
    }

    const { name, email, password } = parsed.data;

    // ensure email not taken (case-insensitive)
    const exists = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
    if (exists) return res.status(409).json({ error: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email: email.toLowerCase(),
      role: 'admin', // first user is the admin
      managerId: null,
      passwordHash,
      // numeric public id is auto-assigned by your model pre('validate') hook
      resetRequired: false, // normal signup (owner) does not need forced reset
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error('signup error', e);
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

export default router;
