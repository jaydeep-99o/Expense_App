import { Router } from 'express';
import { z } from 'zod';
import { ensureAuth } from '../auth';
import { ApprovalTask, Expense } from '../model';

const router = Router();

function isManagerOrAdmin(role: string) {
  return role === 'manager' || role === 'admin';
}

// GET /api/approvals/queue  (managers/admins only; employees see empty array)
router.get('/queue', ensureAuth, async (req: any, res) => {
  if (!isManagerOrAdmin(req.user.role)) return res.json([]);
  const list = await ApprovalTask.find().sort({ id: 1 });
  return res.json(list);
});

// POST /api/approvals/:id/decide  { decision: 'approved' | 'rejected', comment?: string }
router.post('/:id/decide', ensureAuth, async (req: any, res) => {
  if (!isManagerOrAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const id = Number(req.params.id);
  const schema = z.object({
    decision: z.enum(['approved', 'rejected']),
    comment: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const task = await ApprovalTask.findOne({ id });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const exp = await Expense.findOne({ id: task.expenseId });
  if (exp) {
    exp.status = parsed.data.decision === 'approved' ? 'approved' : 'rejected';
    exp.timeline = exp.timeline || [];
    exp.timeline.push({
      at: new Date().toISOString(),
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });
    await exp.save();
  }

  await ApprovalTask.deleteOne({ id });
  return res.json({ ok: true });
});

export default router;
