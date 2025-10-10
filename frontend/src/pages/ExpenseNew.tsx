import { useState } from 'react'
import {
  Calendar, Tag, FileText, DollarSign, CreditCard, MessageSquare,
  Upload, Scan, Save, X, ArrowLeft, CheckCircle, XCircle, File, Loader2
} from 'lucide-react'
import Tesseract from 'tesseract.js'
import { ExpensesAPI } from '../lib/api'

export default function ExpenseNew() {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Food')
  const [spendDate, setSpendDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paidBy, setPaidBy] = useState('')
  const [remarks, setRemarks] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [currency, setCurrency] = useState('INR')
  const [file, setFile] = useState<globalThis.File | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [ocring, setOcring] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setMsg('')

    if (description.trim() === '' || amount === '' || Number(amount) <= 0) {
      setErr('Description and a positive amount are required')
      return
    }

    setSaving(true)
    try {
      await ExpensesAPI.create({
        employeeId: 1, // TODO: Replace with actual employee id from context/auth
        spendDate: new Date(spendDate).toISOString(),
        category,
        description: description.trim(),
        amount: Number(amount),
        currency,
        paidBy,
        remarks: remarks.trim() || undefined,
      })
      
      setMsg('Expense saved successfully!')
      setTimeout(() => {
        window.history.back()
      }, 1500)
    } catch (error: any) {
      setErr(error?.message || 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  async function runOCR() {
    if (!file) {
      setMsg('Please attach a receipt image first')
      return
    }
    
    setOcring(true)
    setOcrProgress(0)
    setMsg('Reading receipt...')
    setErr('')

    try {
      const result = await Tesseract.recognize(
        previewUrl || file,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100))
            }
          }
        }
      )

      const text = result.data.text
      console.log('OCR Text:', text)

      const extractedData = extractReceiptInfo(text)
      
      if (extractedData.amount) {
        setAmount(extractedData.amount)
        setMsg('Receipt processed successfully! Please review the details.')
      } else {
        setMsg('Receipt scanned, but could not find amount. Please fill manually.')
      }

      if (extractedData.date) {
        setSpendDate(extractedData.date)
      }
      
      if (extractedData.description) {
        setDescription(extractedData.description)
      }

      if (extractedData.currency) {
        setCurrency(extractedData.currency)
      }

    } catch (error) {
      console.error('OCR Error:', error)
      setErr('Could not read the receipt. Please fill manually.')
    } finally {
      setOcring(false)
      setOcrProgress(0)
    }
  }

  function extractReceiptInfo(text: string) {
    const data: {
      amount?: number
      date?: string
      description?: string
      currency?: string
    } = {}

    const amountPatterns = [
      /(?:total|amount|sum|grand total|subtotal)[:\s]*(?:rs\.?|₹|inr|\$|€|£|¥)?\s*([\d,]+\.?\d*)/i,
      /(?:rs\.?|₹|inr)\s*([\d,]+\.?\d*)/i,
      /\$\s*([\d,]+\.?\d*)/i,
      /€\s*([\d,]+\.?\d*)/i,
      /£\s*([\d,]+\.?\d*)/i,
      /¥\s*([\d,]+\.?\d*)/i,
      /total[:\s]*([\d,]+\.?\d*)/i
    ]

    for (const pattern of amountPatterns) {
      const match = text.match(pattern)
      if (match) {
        const amt = parseFloat(match[1].replace(/,/g, ''))
        if (amt > 0) {
          data.amount = amt
          break
        }
      }
    }

    if (text.match(/₹|INR|Rs\.?/i)) {
      data.currency = 'INR'
    } else if (text.match(/\$|USD/i)) {
      data.currency = 'USD'
    } else if (text.match(/€|EUR/i)) {
      data.currency = 'EUR'
    } else if (text.match(/£|GBP/i)) {
      data.currency = 'GBP'
    } else if (text.match(/¥|JPY|YEN/i)) {
      data.currency = 'JPY'
    }

    const datePatterns = [
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
      /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
      /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/i,
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i
    ]

    for (const pattern of datePatterns) {
      const match = text.match(pattern)
      if (match) {
        try {
          let dateStr = ''
          if (match[0].includes('/') || match[0].includes('-') || match[0].includes('.')) {
            const parts = match[0].split(/[\/\-.]/)
            if (parts[0].length === 4) {
              dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
            } else {
              const year = parts[2]
              const month = parts[1].padStart(2, '0')
              const day = parts[0].padStart(2, '0')
              dateStr = `${year}-${month}-${day}`
            }
          } else {
            const monthMap: { [key: string]: string } = {
              jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
              jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
            }
            const monthName = match[1]?.toLowerCase().slice(0, 3) || match[2]?.toLowerCase().slice(0, 3)
            const day = match[2] || match[1]
            const year = match[3]
            if (monthName && monthMap[monthName]) {
              dateStr = `${year}-${monthMap[monthName]}-${day.padStart(2, '0')}`
            }
          }
          
          if (dateStr && !isNaN(Date.parse(dateStr))) {
            data.date = dateStr
            break
          }
        } catch (e) {
          continue
        }
      }
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3)
    const merchantPatterns = [
      /^([A-Z][A-Za-z\s&'-]{3,30})(?:\s|$)/,
      /merchant[:\s]*([^\n]+)/i,
      /store[:\s]*([^\n]+)/i
    ]

    for (const pattern of merchantPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        data.description = match[1].trim()
        break
      }
    }

    if (!data.description && lines.length > 0) {
      for (const line of lines) {
        if (line.length > 5 && !line.match(/^\d+$/) && !line.match(/^[\/\-_.]+$/)) {
          data.description = line.substring(0, 50)
          break
        }
      }
    }

    return data
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null
    setErr('')
    setMsg('')
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setErr('File too large (max 5MB)')
        e.currentTarget.value = ''
        setFile(null)
        setPreviewUrl(null)
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => setPreviewUrl(reader.result as string)
      reader.readAsDataURL(selectedFile)
      setFile(selectedFile)
    } else {
      setFile(null)
      setPreviewUrl(null)
    }
  }

  function removeFile() {
    setFile(null)
    setPreviewUrl(null)
  }

  function cancel() {
    window.history.back()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <button
          onClick={cancel}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Expenses</span>
        </button>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/40 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">New Expense</h1>
              <p className="text-sm text-gray-600 mt-0.5">Fill in the details below to create a new expense</p>
            </div>
          </div>
        </div>

        {msg && (
          <div
            role="status"
            aria-live="polite"
            className={`${
              msg.includes('success') || msg.includes('processed')
                ? 'bg-emerald-50 border-emerald-500'
                : 'bg-blue-50 border-blue-500'
            } border-l-4 rounded-lg p-4 flex items-start gap-3 mb-6 animate-slideDown`}
          >
            <CheckCircle
              className={`w-5 h-5 ${
                msg.includes('success') || msg.includes('processed') ? 'text-emerald-500' : 'text-blue-500'
              } flex-shrink-0 mt-0.5`}
            />
            <p className={`text-sm ${msg.includes('success') || msg.includes('processed') ? 'text-emerald-800' : 'text-blue-800'} flex-1 font-medium`}>
              {msg}
            </p>
          </div>
        )}

        {err && (
          <div role="alert" className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3 mb-6 animate-slideDown">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 flex-1 font-medium">{err}</p>
          </div>
        )}

        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/40 p-6 sm:p-8 space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="date" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Spend Date</span>
              </label>
              <input
                id="date"
                type="date"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 outline-none bg-gray-50 focus:bg-white text-gray-900"
                value={spendDate}
                onChange={e => setSpendDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="category" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                <span>Category</span>
              </label>
              <select
                id="category"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 outline-none bg-gray-50 focus:bg-white text-gray-900"
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
              >
                {['Food', 'Travel', 'Hotel', 'Fuel', 'Supplies', 'Software', 'Other'].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Description</span>
            </label>
            <input
              id="description"
              type="text"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 outline-none bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400"
              placeholder="e.g., Business lunch with client"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <label htmlFor="amount" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 text-indigo-600" />
                <span>Amount</span>
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 outline-none bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label htmlFor="currency" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 text-indigo-600" />
                <span>Currency</span>
              </label>
              <select
                id="currency"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 outline-none bg-gray-50 focus:bg-white text-gray-900"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                required
              >
                {['INR', 'USD', 'EUR', 'GBP', 'JPY'].map(curr => (
                  <option key={curr} value={curr}>{curr}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="paidBy" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>Paid By</span>
              </label>
              <input
                id="paidBy"
                type="text"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 outline-none bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400"
                placeholder="Card / Cash / UPI"
                value={paidBy}
                onChange={e => setPaidBy(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="remarks" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span>Remarks (Optional)</span>
            </label>
            <textarea
              id="remarks"
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 outline-none bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 resize-none"
              placeholder="Add any additional notes..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  <span>Receipt Image</span>
                </div>

                {!file ? (
                  <div>
                    <label htmlFor="file" className="cursor-pointer">
                      <div className="flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 rounded-xl transition-all duration-200">
                        <File className="w-5 h-5 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Choose receipt image</span>
                      </div>
                    </label>
                    <input
                      id="file"
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <p className="text-xs text-gray-500 mt-2">Supported: JPG, PNG, PDF (Max 5MB)</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <File className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button type="button" onClick={removeFile} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    {previewUrl && file.type.startsWith('image/') && (
                      <img src={previewUrl} alt="Receipt preview" className="w-full h-48 object-cover rounded-lg" />
                    )}
                  </div>
                )}
              </div>

              {file && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={runOCR}
                    disabled={ocring}
                    className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {ocring ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Reading...</span>
                      </>
                    ) : (
                      <>
                        <Scan className="w-5 h-5" />
                        <span>Extract with OCR</span>
                      </>
                    )}
                  </button>
                  {ocring && ocrProgress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none disabled:cursor-not-allowed transition-all duration-200"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Expense</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
            >
              <X className="w-5 h-5" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }

        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -20px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(20px, 20px) scale(1.05); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  )
}