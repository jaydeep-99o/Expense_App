// src/routes/users.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ensureAuth } from '../auth';
import { User } from '../model';
import { generateTempPassword } from '../lib/passwords';
import { sendInviteEmail } from '../lib/mailer';

const router = Router();

function isManagerOrAdmin(role: string) {
  return role === 'manager' || role === 'admin';
}

function toPublic(u: any) {
  const obj = u.toObject ? u.toObject() : u;
  const { passwordHash, __v, ...rest } = obj;
  return rest;
}

async function nextUserId() {
  const last = await User.findOne().sort({ id: -1 }).select('id');
  return (last?.id || 0) + 1;
}

// GET /api/users  (manager/admin)
router.get('/', ensureAuth, async (req: any, res) => {
  if (!isManagerOrAdmin(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const list = await User.find().sort({ id: 1 });
  res.json(list.map(toPublic));
});

// POST /api/users  (create employee/manager + send invite)
router.post('/', ensureAuth, async (req: any, res) => {
  if (!isManagerOrAdmin(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.enum(['employee', 'manager']),
    managerId: z.number().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const { name, email, role, managerId = null } = parsed.data;

  // unique email (case-insensitive)
  const exists = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
  if (exists) return res.status(409).json({ error: 'Email already exists' });

  // generate & hash temp password
  const tempPassword = generateTempPassword(12);
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  // numeric id (keep your helper) + mark resetRequired
  const id = await nextUserId();
  const user = await User.create({
    id,
    name,
    email: email.toLowerCase(),
    role,
    managerId,
    passwordHash,
    resetRequired: true,
  });

  // send invite email with login + temp password
  try {
    await sendInviteEmail(email.toLowerCase(), email.toLowerCase(), tempPassword);
  } catch (err) {
    // Keep the user; allow admin to "resend invite"
    return res.status(201).json({
      user: toPublic(user),
      warn: 'User created, but failed to send invite email. Please use "Resend invite".',
    });
  }

  // Do NOT return temp password in API response (security)
  res.status(201).json({ user: toPublic(user), info: 'Invite email sent.' });
});

// PATCH /api/users/:id/role
router.patch('/:id/role', ensureAuth, async (req: any, res) => {
  if (!isManagerOrAdmin(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  const id = Number(req.params.id);
  const schema = z.object({ role: z.enum(['employee', 'manager']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const u = await User.findOneAndUpdate({ id }, { role: parsed.data.role }, { new: true });
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ user: toPublic(u) });
});

// PATCH /api/users/:id/manager
router.patch('/:id/manager', ensureAuth, async (req: any, res) => {
  if (!isManagerOrAdmin(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  const id = Number(req.params.id);
  const schema = z.object({ managerId: z.number().nullable() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const u = await User.findOneAndUpdate({ id }, { managerId: parsed.data.managerId }, { new: true });
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ user: toPublic(u) });
});

// POST /api/users/:id/resend-invite
router.post('/:id/resend-invite', ensureAuth, async (req: any, res) => {
  if (!isManagerOrAdmin(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  const id = Number(req.params.id);
  const user = await User.findOne({ id });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const tempPassword = generateTempPassword(12);
  user.passwordHash = await bcrypt.hash(tempPassword, 10);
  user.resetRequired = true;
  await user.save();

  await sendInviteEmail(user.email, user.email, tempPassword);
  res.json({ ok: true, info: 'Invite re-sent.' });
});

export default router;
