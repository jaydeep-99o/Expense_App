// src/routes/flows.ts
import { Router } from 'express';
import { z } from 'zod';
import { ensureAuth } from '../auth';
import { FlowConfig } from '../model';

const router = Router();

function isManagerOrAdmin(role: string) {
  return role === 'manager' || role === 'admin';
}

// GET /api/flows  -> returns the singleton flow config (creates default if missing)
router.get('/', ensureAuth, async (req: any, res) => {
  if (!isManagerOrAdmin(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  let cfg = await FlowConfig.findOne({ key: 'default' });
  if (!cfg) {
    cfg = await FlowConfig.create({
      key: 'default',
      isManagerFirst: true,
      sequenceEnabled: false,
      approvers: [],
      percentThreshold: undefined,
      specificApproverId: undefined,
    });
  }
  return res.json(cfg);
});

// PUT /api/flows  -> upsert and return
router.put('/', ensureAuth, async (req: any, res) => {
  if (!isManagerOrAdmin(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  const schema = z.object({
    isManagerFirst: z.boolean(),
    sequenceEnabled: z.boolean(),
    approvers: z.array(z.object({ userId: z.number(), required: z.boolean() })),
    percentThreshold: z.number().min(1).max(100).optional(),
    specificApproverId: z.number().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const cfg = await FlowConfig.findOneAndUpdate(
    { key: 'default' },
    { key: 'default', ...parsed.data },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return res.json(cfg);
});

export default router;
