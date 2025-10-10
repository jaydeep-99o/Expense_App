import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApprovalsAPI, ExpensesAPI } from '../lib/api'
import type { ApprovalTask, ExpenseDetail } from '../types'
import {
  CheckCircle, XCircle, Eye, ArrowLeft, LogOut, Loader2, Calendar, DollarSign,
  Tag, User, FileText, Clock, MessageSquare, X
} from 'lucide-react'

export default function ApprovalsQueue() {
  const nav = useNavigate()
  const [rows, setRows] = useState<ApprovalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<ExpenseDetail | null>(null)
  const [selectedTask, setSelectedTask] = useState<ApprovalTask | null>(null)
  const [comment, setComment] = useState('')
  const [actingId, setActingId] = useState<number | null>(null)

  // Read company currency once (from stored login payload)
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem('expman_user') || 'null') } catch { return null }
  })()
  const companyCurrency: string = stored?.company?.currency ?? 'USD'

  const fmtMoney = (amount: number, ccy: string) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy }).format(amount) }
    catch { return `${amount} ${ccy}` }
  }

  async function load() {
    setErr(''); setLoading(true)
    try {
      const list = await ApprovalsAPI.queue()        // ← real API call
      setRows(list)
    } catch (e: any) {
      setErr(e?.message || 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // ESC to close modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function closeModal() {
    setOpen(null)
    setSelectedTask(null)
    setComment('')
  }

  async function viewExpense(task: ApprovalTask) {
    try {
      const detail = await ExpensesAPI.get(task.expenseId) // ← real API call
      setOpen(detail)
      setSelectedTask(task)
      setComment('')
    } catch (e: any) {
      setErr(e?.message || 'Failed to load expense')
    }
  }

  async function act(task: ApprovalTask, decision: 'approved' | 'rejected') {
    try {
      setActingId(task.id)
      await ApprovalsAPI.decide(task.id, decision, comment.trim() || undefined) // ← real API call
      setRows(prev => prev.filter(r => r.id !== task.id)) // remove from queue
      closeModal()
    } catch (e: any) {
      setErr(e?.message || 'Action failed')
    } finally {
      setActingId(null)
    }
  }

  function back() {
    if (window.history.length > 1) nav(-1)
    else nav('/', { replace: true })
  }

  function logout() {
    try {
      localStorage.removeItem('expman_token')
      localStorage.removeItem('expman_user')
    } catch {}
    nav('/login', { replace: true })
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        </div>

        <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          {/* Top Navigation Bar */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/40 p-4 mb-6 flex items-center justify-between">
            <button
              onClick={back}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Approvals Queue</h1>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>

          {/* Error */}
          {err && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3 mb-6 animate-slideDown">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 flex-1">{err}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/40 p-12 text-center">
              <div className="flex items-center justify-center gap-3 text-indigo-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Loading approvals…</span>
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading && rows.length === 0 && !err && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/40 p-12 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">All Caught Up!</h3>
              <p className="text-sm text-gray-600">No pending approvals at the moment.</p>
            </div>
          )}

          {/* Approval Cards */}
          <div className="grid gap-4">
            {rows.map(t => (
              <div
                key={t.id}
                className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/40 p-6 hover:shadow-xl transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {t.ownerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{t.ownerName}</div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Tag className="w-3 h-3" />
                          <span>{t.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700 mt-3">
                      <DollarSign className="w-4 h-4 text-indigo-600" />
                      <span className="font-semibold">
                        {fmtMoney(t.amountCompanyCcy, t.companyCurrency || companyCurrency)}
                      </span>
                      <span className="text-xs text-gray-500">
                        (submitted in {t.submittedCurrency})
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => viewExpense(t)}
                      className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => act(t, 'approved')}
                      disabled={actingId === t.id}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60"
                    >
                      {actingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => act(t, 'rejected')}
                      disabled={actingId === t.id}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60"
                    >
                      {actingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {open && selectedTask && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-slideUp"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Expense Details</h2>
                    <p className="text-sm text-blue-100">ID #{open.id}</p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Expense Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <DetailField icon={<User className="w-4 h-4" />} label="Employee ID" value={open.employeeId} />
                <DetailField icon={<Calendar className="w-4 h-4" />} label="Date" value={open.spendDate.slice(0, 10)} />
                <DetailField icon={<Tag className="w-4 h-4" />} label="Category" value={open.category} />
                <DetailField
                  icon={<DollarSign className="w-4 h-4" />}
                  label="Amount"
                  value={`${fmtMoney(open.amount, open.currency)} (${fmtMoney(open.amountCompanyCcy, companyCurrency)})`}
                />
                <DetailField icon={<FileText className="w-4 h-4" />} label="Description" value={open.description} wide />
                {open.remarks && <DetailField icon={<MessageSquare className="w-4 h-4" />} label="Remarks" value={open.remarks} wide />}
              </div>

              {/* Timeline */}
              <div className="mb-6">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Timeline</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-auto bg-gray-50 rounded-xl p-4">
                  {open.timeline?.map((ev, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-xs text-gray-500 font-medium">
                        {new Date(ev.at).toLocaleString()}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                        {ev.decision}
                      </span>
                      {ev.comment && <span className="text-gray-700">{ev.comment}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Comment Input */}
              <div className="mb-4">
                <label htmlFor="comment" className="block text-sm font-semibold text-gray-700 mb-2">
                  Add Comment (Optional)
                </label>
                <textarea
                  id="comment"
                  rows={3}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 outline-none bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400"
                  placeholder="Add your comment here..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => selectedTask && act(selectedTask, 'approved')}
                  disabled={actingId !== null}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60"
                >
                  {actingId !== null ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => selectedTask && act(selectedTask, 'rejected')}
                  disabled={actingId !== null}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60"
                >
                  {actingId !== null ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                  <span>Reject</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }

        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -20px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(20px, 20px) scale(1.05); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }

        @media (max-width: 640px) { h1 { font-size: 1.125rem; } }
      `}</style>
    </>
  )
}

function DetailField({ icon, label, value, wide }: { icon: React.ReactNode; label: string; value: any; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        <span className="text-indigo-600">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-gray-900">{String(value)}</div>
    </div>
  )
}
