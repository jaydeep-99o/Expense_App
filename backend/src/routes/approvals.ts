import { Router } from 'express';
import { z } from 'zod';
import { ensureAuth } from '../auth';
import { ApprovalTask, Expense, User } from '../model';
import { getFlowConfig } from './flows';

const router = Router();

function isManagerOrAdmin(role: string) {
  return role === 'manager' || role === 'admin';
}

// GET /api/approvals/queue  (managers/admins only; employees see empty array)
router.get('/queue', ensureAuth, async (req: any, res) => {
  if (!isManagerOrAdmin(req.user.role)) return res.json([]);
  
  try {
    // Get tasks that the current user can approve
    const list = await ApprovalTask.find().sort({ id: 1 });
    
    // Filter based on flow config (future enhancement)
    // For now, return all pending approvals
    return res.json(list);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
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
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error });
  }

  try {
    const task = await ApprovalTask.findOne({ id });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const exp = await Expense.findOne({ id: task.expenseId });
    if (!exp) return res.status(404).json({ error: 'Expense not found' });

    // Update expense status
    exp.status = parsed.data.decision === 'approved' ? 'approved' : 'rejected';
    exp.timeline = exp.timeline || [];
    exp.timeline.push({
      at: new Date().toISOString(),
      byUserId: req.user.id,
      decision: parsed.data.decision,
      comment: parsed.data.comment || '',
    });
    await exp.save();

    // Remove the approval task
    await ApprovalTask.deleteOne({ id });
    
    console.log(`Approval ${id} ${parsed.data.decision} by user ${req.user.id}`);
    return res.json({ ok: true });
  } catch (error: any) {
    console.error('Error deciding approval:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Helper function to create approval task (call this when expense is submitted)
export async function createApprovalTask(expense: any) {
  try {
    console.log('Creating approval task for expense', expense.id);
    
    // Get the employee who submitted the expense
    const employee = await User.findOne({ id: expense.employeeId });
    if (!employee) {
      console.error('Employee not found for expense', expense.id);
      return;
    }

    // Get flow configuration
    const flowConfig = await getFlowConfig();
    
    // Determine who needs to approve based on flow config
    let shouldCreateTask = false;

    if (flowConfig.isManagerFirst) {
      // Check if employee has a manager
      const managerId = employee.managerId;
      if (!managerId) {
        console.error('No manager assigned for employee', employee.id);
        return;
      }

      const manager = await User.findOne({ id: managerId });
      if (!manager) {
        console.error('Manager not found', managerId);
        return;
      }

      shouldCreateTask = true;
    }

    // Check threshold-based approval
    if (flowConfig.percentThreshold && flowConfig.specificApproverId) {
      // If expense is above threshold, specific approver needed
      // Implement your threshold logic here
      shouldCreateTask = true;
    }

    if (!shouldCreateTask) {
      console.log('No approval needed for expense', expense.id);
      return;
    }

    // Get next task ID
    const lastTask = await ApprovalTask.findOne().sort({ id: -1 });
    const nextId = lastTask ? lastTask.id + 1 : 1;

    // Create approval task
    const task = new ApprovalTask({
      id: nextId,
      expenseId: expense.id,
      amountCompanyCcy: expense.amountCompanyCcy,
      companyCurrency: expense.companyCurrency,
      submittedCurrency: expense.currency,
      ownerName: employee.name || employee.email,
      category: expense.category,
    });

    await task.save();
    console.log('✅ Created approval task', nextId, 'for expense', expense.id);
  } catch (error: any) {
    console.error('❌ Error creating approval task:', error.message);
    throw error; // Re-throw so expense creation can handle it
  }
}

export default router;