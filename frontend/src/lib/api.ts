// src/lib/api.ts
import type {
  LoginResponse, SignupPayload, BasicOk,
  User, ApprovalFlow, Expense, ApprovalTask, ExpenseDetail
} from '../types'
import { getUser, getToken} from './auth'

// ======= ENV =======
const BASE = import.meta.env.VITE_API_URL || ''            
const PREFIX = import.meta.env.VITE_API_PREFIX || '/api'   
const useMocks = String(import.meta.env.VITE_USE_MOCKS || 'false').toLowerCase() === 'true'

// ======= helpers =======
// function getToken(): string | null {
//   try {
//     // adjust if you store token differently
//     return localStorage.getItem('token')
//       || sessionStorage.getItem('token')
//       // in case your getUser() stores token with user (rare)
//       || (getUser() as any)?.token
//       || null
//   } catch {
//     return null
//   }
// }

function authHeaders(path: string): Record<string, string> {
  const isPublic =
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/signup') ||
    path.startsWith('/auth/forgot');
  if (isPublic) return {};
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}


async function realFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData
  const res = await fetch(BASE + PREFIX + path, {
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(path),
      ...(init?.headers || {}),
    },
    ...init,
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(txt || `${res.status} ${res.statusText}`)
  }
  const txt = await res.text().catch(() => '')
  return (txt ? JSON.parse(txt) : ({} as unknown)) as T
}

// ======= MOCKS (localStorage DB) =======
type MockDB = {
  users: Array<User & { password: string; managerId?: number | null }>
  company: { id: number; name: string; currency: string, country: string }
  resetRequired: Record<number, boolean>
  expenses: (Expense & { timeline?: any[]; employeeId: number })[]
  flow: ApprovalFlow
  nextId: number
}

function loadDB(): MockDB {
  const raw = localStorage.getItem('mock_db_v1')
  if (raw) return JSON.parse(raw)
  const db: MockDB = {
    users: [
      { id: 1, email: 'admin@hack.co', role: 'admin', name: 'Admin', password: 'password', companyId: 1 },
      { id: 2, email: 'manager@hack.co', role: 'manager', name: 'Manager', password: 'password', companyId: 1 },
      { id: 3, email: 'emp@hack.co', role: 'employee', name: 'Employee', password: 'password', companyId: 1, managerId: 2 },
    ] as any,
    company: { id: 1, name: 'Hack Co', currency: 'INR', country: 'IN' },
    resetRequired: {},
    expenses: [],
    flow: {
      id: 1,
      name: 'Default',
      description: 'Manager first, then sequence approvers',
      isManagerFirst: true,
      sequenceEnabled: true,
      approvers: [],
      percentThreshold: undefined,
      specificApproverId: undefined,
    } as any,
    nextId: 1000,
  }
  localStorage.setItem('mock_db_v1', JSON.stringify(db))
  return db
}
function saveDB(db: MockDB) { localStorage.setItem('mock_db_v1', JSON.stringify(db)) }

async function mockFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase()
  const body = init?.body && !(init.body instanceof FormData) ? JSON.parse(String(init.body)) : {}
  const db = loadDB()

  // ---------- AUTH ----------
  if (path === '/auth/signup' && method === 'POST') {
    db.company = { id: 1, name: body.companyName, currency: body.currency, country: body.country }
    const exists = db.users.find(u => u.email.toLowerCase() === String(body.email).toLowerCase())
    if (exists) throw new Error('Email already in use')
    db.users = db.users.filter(u => u.role !== 'admin')
    db.users.unshift({ id: 1, email: body.email, name: body.name, role: 'admin', companyId: 1, password: body.password } as any)
    saveDB(db)
    return { ok: true } as any
  }

  if (path === '/auth/login' && method === 'POST') {
    const u = db.users.find(x => x.email.toLowerCase() === String(body.email).toLowerCase() && x.password === body.password)
    if (!u) throw new Error('Invalid credentials')
    return {
      token: 'mock-token',
      resetRequired: !!db.resetRequired[u.id],
      user: { id: u.id, email: u.email, role: u.role, name: u.name, managerId: (u as any).managerId ?? null, companyId: 1 },
      company: db.company,
    } as any
  }

  // NOTE: real backend route is /auth/forgot (no "-password")
  if (path === '/auth/forgot' && method === 'POST') {
    const u = db.users.find(x => x.email.toLowerCase() === String(body.email).toLowerCase())
    if (u) { (u as any).password = Math.random().toString(36).slice(2, 10) + 'A!'; db.resetRequired[u.id] = true; saveDB(db) }
    return {} as any
  }

  if (path === '/auth/change-password' && method === 'POST') {
    const me = getUser() as any
    const u = me ? db.users.find(x => x.id === me.id) : undefined
    if (!u || (u as any).password !== body.currentPassword) throw new Error('Current password is incorrect')
    ;(u as any).password = body.newPassword
    delete db.resetRequired[u.id]
    saveDB(db)
    return {} as any
  }

  // ---------- USERS ----------
  if (path === '/users' && method === 'GET') {
    return db.users.map(({ password, ...u }) => u) as any
  }
  if (path === '/users' && method === 'POST') {
    const id = db.nextId++
    const nu: any = {
      id, email: body.email, name: body.name || body.email.split('@')[0],
      role: body.role, managerId: body.managerId ?? null, companyId: 1, password: 'TempPass1!'
    }
    db.users.push(nu)
    db.resetRequired[id] = true
    saveDB(db)
    return { id, emailSent: true } as any
  }
  if (path?.startsWith('/users/') && method === 'PATCH') {
    const id = Number(path.split('/')[2])
    const u = db.users.find(x => x.id === id)
    if (!u) throw new Error('User not found')
    Object.assign(u, body)
    saveDB(db)
    const { password, ...pub } = u as any
    return pub as any
  }
  if (path?.endsWith('/send-password') && method === 'POST') {
    const id = Number(path.split('/')[2])
    const u = db.users.find(x => x.id === id)
    if (!u) throw new Error('User not found')
    ;(u as any).password = Math.random().toString(36).slice(2, 10) + 'A!'
    db.resetRequired[id] = true
    saveDB(db)
    return {} as any
  }

  // ---------- FLOWS ----------
  if (path === '/flows/default' && method === 'GET') {
    return db.flow as any
  }
  if (path === '/flows/default' && method === 'PUT') {
    db.flow = { ...db.flow, ...body }
    saveDB(db)
    return db.flow as any
  }

  // ---------- EXPENSES ----------
  if (path === '/expenses' && method === 'POST') {
    const me = getUser() as any
    const id = db.nextId++
    const amountCompany = convert(body.amount, body.currency, db.company.currency)

    const exp: any = {
      id,
      employeeId: me?.id || 3,
      description: body.description,
      category: body.category || 'Other',
      spendDate: body.spendDate,
      paidBy: body.paidBy,
      remarks: body.remarks,
      amount: Number(body.amount),
      currency: body.currency,
      amountCompanyCcy: amountCompany,
      companyCurrency: db.company.currency,
      status: 'waiting',
    }
    exp.timeline = [
      { at: new Date().toISOString(), byUserId: exp.employeeId, decision: 'submitted', comment: body.remarks || '' }
    ]

    db.expenses.unshift(exp)
    saveDB(db)
    return exp as any
  }

  // list "mine" — matches your frontend call when using mocks
  if (path === '/expenses/mine' && method === 'GET') {
    const me = getUser() as any
    return db.expenses.filter(e => e.employeeId === (me?.id ?? 0)) as any
  }

  // Match real backend style too if you switch to GET /expenses
  if (path === '/expenses' && method === 'GET') {
    const me = getUser() as any
    // if you want only mine, filter; else return all
    return db.expenses.filter(e => e.employeeId === (me?.id ?? 0)) as any
  }

  if (path.startsWith('/expenses/') && method === 'GET') {
    const id = Number(path.split('/')[2])
    const exp = db.expenses.find(e => e.id === id)
    if (!exp) throw new Error('Not found')
    if (!(exp as any).timeline) (exp as any).timeline = [{ at: exp.spendDate, byUserId: exp.employeeId, decision: 'submitted' }]
    return exp as any
  }

  // ---------- APPROVALS ----------
  if (path === '/approvals/queue' && method === 'GET') {
    const me = getUser() as any
    const tasks: ApprovalTask[] = db.expenses
      .filter(e => e.status === 'waiting')
      .filter(e => db.users.find(u => u.id === e.employeeId)?.managerId === me?.id)
      .map((e: any) => ({
        id: 10000 + e.id,
        expenseId: e.id,
        amountCompanyCcy: e.amountCompanyCcy,
        companyCurrency: db.company.currency,
        submittedCurrency: e.currency,
        ownerName: db.users.find(u => u.id === e.employeeId)?.name || 'Employee',
        category: e.category,
      } as any))
    return tasks as any
  }

  // Accept both /approvals/:id and /approvals/:id/decide for mocks
  if (path.startsWith('/approvals/') && method === 'POST') {
    const parts = path.split('/')
    const id = Number(parts[2]) // approval id
    const expId = id - 10000
    const exp: any = db.expenses.find(e => e.id === expId)
    if (!exp) throw new Error('Not found')
    const decision = body.decision
    exp.status = decision === 'approved' ? 'approved' : 'rejected'
    const me = getUser() as any
    exp.timeline = exp.timeline || []
    exp.timeline.push({
      at: new Date().toISOString(),
      byUserId: me?.id || 0,
      decision,
      comment: body.comment || ''
    })
    saveDB(db)
    return { ok: true } as any
  }

  // ---------- OCR (mock only) ----------
  if (path === '/ocr' && method === 'POST') {
    return {
      amount: Number((Math.random() * 500 + 50).toFixed(2)),
      currency: 'INR',
      description: 'Restaurant',
      date: new Date().toISOString().slice(0, 10),
    } as any
  }

  throw new Error(`Mock route not implemented: ${path}`)
}

// naive conversion (mock)
function convert(amount: number, from: string, to: string) {
  if (from === to) return Number(amount || 0)
  const table: Record<string, number> = { USD: 85, EUR: 90, INR: 1 }
  const inInr = Number(amount || 0) * (table[from] ?? 1)
  const out = to === 'INR' ? inInr : inInr / (table[to] ?? 1)
  return Math.round(out * 100) / 100
}

const fx = <T,>(p: string, i?: RequestInit) => (useMocks ? mockFetch<T>(p, i) : realFetch<T>(p, i))

// ======= Public API =======
export const AuthAPI = {
  login: (email: string, password: string) =>
    fx<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  // If your real backend doesn't implement signup, remove this or hide it behind useMocks
  signup: (payload: SignupPayload) =>
    fx<BasicOk>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
  // real backend route is /auth/forgot
  forgot: (email: string) =>
    fx<void>('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    fx<void>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
}

export const UsersAPI = {
  list: () => fx<User[]>('/users', { method: 'GET' }),
  create: (payload: { name?: string; email: string; role: 'manager' | 'employee'; managerId?: number | null }) =>
    fx<{ id: number; emailSent: boolean }>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, patch: Partial<Pick<User, 'name' | 'role' | 'managerId'>>) =>
    fx<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  sendPassword: (id: number) => fx<void>(`/users/${id}/send-password`, { method: 'POST' }),
}

export const FlowAPI = {
  get: () => fx<ApprovalFlow>('/flows/default', { method: 'GET' }),
  put: (flow: ApprovalFlow) => fx<ApprovalFlow>('/flows/default', { method: 'PUT', body: JSON.stringify(flow) }),
}

export const ExpensesAPI = {
  // For real backend, list is GET /expenses (auth filters employees vs managers)
  mine: () => fx<Expense[]>('/expenses', { method: 'GET' }),
  get:  (id: number) => fx<ExpenseDetail>(`/expenses/${id}`, { method: 'GET' }),
  create: (payload: Omit<Expense, 'id' | 'amountCompanyCcy' | 'status' | 'companyCurrency'> & { paidBy?: string; remarks?: string }) =>
    fx<Expense>('/expenses', { method: 'POST', body: JSON.stringify(payload) }),
}

export const ApprovalsAPI = {
  queue: () => fx<ApprovalTask[]>('/approvals/queue', { method: 'GET' }),
  // real backend route is /approvals/:id/decide
  decide: (id: number, decision: 'approved' | 'rejected', comment?: string) =>
    fx<void>(`/approvals/${id}/decide`, { method: 'POST', body: JSON.stringify({ decision, comment }) }),
}

export const OCRAPI = {
  // works with mocks; for real backend, add an /api/ocr route with multer and forward here
  extract: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fx<{ amount?: number; currency?: string; date?: string; description?: string }>('/ocr', {
      method: 'POST',
      body: fd,
    })
  },
}
