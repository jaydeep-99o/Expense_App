import { useState } from 'react'
import { Upload, Scan, CheckCircle, XCircle, ArrowLeft, FileText, Calendar, DollarSign, Tag, Loader2, Download, RotateCcw, Zap } from 'lucide-react'

type OCRResult = {
  amount?: number
  currency?: string
  date?: string
  description?: string
  vendor?: string
  category?: string
  confidence?: number
}

export default function OCRReceiptScanner() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<OCRResult | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null
    setFile(selectedFile)
    setResult(null)
    setErr('')
    setMsg('')
    
    if (selectedFile) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    } else {
      setPreviewUrl(null)
    }
  }

  async function scanReceipt() {
    if (!file) {
      setErr('Please select a receipt image first')
      return
    }

    setScanning(true)
    setErr('')
    setMsg('Processing receipt...')
    setResult(null)

    try {
      // Using OCR.space API (Free tier: 25,000 requests/month)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('apikey', 'K87899142388957') // Free API key for demo
      formData.append('language', 'eng')
      formData.append('isOverlayRequired', 'false')
      formData.append('detectOrientation', 'true')
      formData.append('scale', 'true')
      formData.append('OCREngine', '2')

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.IsErroredOnProcessing) {
        throw new Error(data.ErrorMessage?.[0] || 'OCR processing failed')
      }

      const extractedText = data.ParsedResults?.[0]?.ParsedText || ''
      
      if (!extractedText) {
        throw new Error('No text found in the image')
      }

      // Parse the extracted text for receipt information
      const parsed = parseReceiptText(extractedText)
      
      setResult(parsed)
      setMsg('Receipt scanned successfully! Review the extracted data below.')
      
    } catch (e: any) {
      setErr(e.message || 'Failed to scan receipt. Please try again.')
      console.error('OCR Error:', e)
    } finally {
      setScanning(false)
    }
  }

  function parseReceiptText(text: string): OCRResult {
    const result: OCRResult = {
      confidence: 75
    }

    // Extract amount (looks for currency symbols and numbers)
    const amountMatch = text.match(/(?:USD|EUR|INR|GBP|\$|€|£|₹)\s*(\d+(?:[.,]\d{2})?)/i) ||
                       text.match(/(?:total|amount|sum)[:\s]*(?:USD|EUR|INR|GBP|\$|€|£|₹)?\s*(\d+(?:[.,]\d{2})?)/i)
    if (amountMatch) {
      result.amount = parseFloat(amountMatch[1].replace(',', '.'))
    }

    // Extract currency
    const currencyMatch = text.match(/\b(USD|EUR|INR|GBP|CAD|AUD)\b/i)
    if (currencyMatch) {
      result.currency = currencyMatch[1].toUpperCase()
    } else if (text.includes('$')) {
      result.currency = 'USD'
    } else if (text.includes('€')) {
      result.currency = 'EUR'
    } else if (text.includes('₹')) {
      result.currency = 'INR'
    } else if (text.includes('£')) {
      result.currency = 'GBP'
    }

    // Extract date (various formats)
    const dateMatch = text.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i)
    if (dateMatch) {
      const dateStr = dateMatch[0]
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        result.date = date.toISOString().slice(0, 10)
      }
    }

    // Extract vendor/merchant name (usually first line or after "from")
    const lines = text.split('\n').filter(line => line.trim().length > 0)
    if (lines.length > 0) {
      result.vendor = lines[0].trim().slice(0, 50)
    }

    // Try to detect category based on keywords
    const textLower = text.toLowerCase()
    if (textLower.includes('restaurant') || textLower.includes('cafe') || textLower.includes('food')) {
      result.category = 'Food'
    } else if (textLower.includes('hotel') || textLower.includes('accommodation')) {
      result.category = 'Hotel'
    } else if (textLower.includes('fuel') || textLower.includes('gas') || textLower.includes('petrol')) {
      result.category = 'Fuel'
    } else if (textLower.includes('taxi') || textLower.includes('uber') || textLower.includes('flight')) {
      result.category = 'Travel'
    } else {
      result.category = 'Other'
    }

    // Generate description from vendor
    if (result.vendor) {
      result.description = `Purchase from ${result.vendor}`
    }

    return result
  }

  function reset() {
    setFile(null)
    setPreviewUrl(null)
    setResult(null)
    setErr('')
    setMsg('')
  }

  function useExtractedData() {
    if (!result) return
    alert('In a real app, this would navigate to expense form with pre-filled data:\n' + JSON.stringify(result, null, 2))
  }

  function back() {
    alert('Navigate back')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={back}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/40 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-2xl flex items-center justify-center">
              <Scan className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">OCR Receipt Scanner</h1>
              <p className="text-sm text-gray-600 mt-0.5">Extract expense data from receipt images automatically</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
              <Zap className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold text-purple-700">Powered by OCR.space</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        {msg && !err && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 flex items-start gap-3 mb-6 animate-slideDown">
            <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 flex-1 font-medium">{msg}</p>
          </div>
        )}

        {err && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3 mb-6 animate-slideDown">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 flex-1 font-medium">{err}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/40 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              <span>Upload Receipt</span>
            </h2>

            {!file ? (
              <label htmlFor="file" className="cursor-pointer block">
                <div className="border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-2xl p-12 text-center transition-all duration-200 bg-gray-50 hover:bg-indigo-50">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Drop receipt image here</h3>
                  <p className="text-sm text-gray-600 mb-4">or click to browse files</p>
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg">
                    <Upload className="w-5 h-5" />
                    <span>Choose File</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">Supports: JPG, PNG, PDF (Max 5MB)</p>
                </div>
                <input
                  id="file"
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div>
                <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                  {previewUrl && (
                    <img 
                      src={previewUrl} 
                      alt="Receipt preview" 
                      className="w-full h-auto max-h-96 object-contain rounded-xl mb-4 border border-gray-200"
                    />
                  )}
                  <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-200">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      onClick={reset}
                      className="ml-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <RotateCcw className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={scanReceipt}
                  disabled={scanning}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none disabled:cursor-not-allowed transition-all duration-200"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Scanning Receipt...</span>
                    </>
                  ) : (
                    <>
                      <Scan className="w-6 h-6" />
                      <span>Scan Receipt</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/40 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Extracted Data</span>
            </h2>

            {!result ? (
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Scan className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No Data Yet</h3>
                  <p className="text-sm text-gray-600">Upload and scan a receipt to see extracted data</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Confidence Score */}
                {result.confidence && (
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-emerald-800">Confidence Score</span>
                      <span className="text-lg font-bold text-emerald-600">{result.confidence}%</span>
                    </div>
                    <div className="w-full bg-emerald-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${result.confidence}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Extracted Fields */}
                <div className="space-y-3">
                  {result.vendor && (
                    <DataField
                      icon={<FileText className="w-4 h-4" />}
                      label="Vendor/Merchant"
                      value={result.vendor}
                    />
                  )}
                  
                  {result.amount && (
                    <DataField
                      icon={<DollarSign className="w-4 h-4" />}
                      label="Amount"
                      value={`${result.amount} ${result.currency || ''}`}
                      highlight
                    />
                  )}
                  
                  {result.date && (
                    <DataField
                      icon={<Calendar className="w-4 h-4" />}
                      label="Date"
                      value={new Date(result.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    />
                  )}
                  
                  {result.category && (
                    <DataField
                      icon={<Tag className="w-4 h-4" />}
                      label="Category"
                      value={result.category}
                    />
                  )}
                  
                  {result.description && (
                    <DataField
                      icon={<FileText className="w-4 h-4" />}
                      label="Description"
                      value={result.description}
                    />
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={useExtractedData}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 mt-6"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Create Expense with This Data</span>
                </button>

                <button
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Scan Another Receipt</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 backdrop-blur-xl rounded-2xl border border-blue-200 p-6 mt-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-blue-900 mb-2">How it works</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Upload a clear photo of your receipt</li>
                <li>• Our OCR engine extracts text and identifies key information</li>
                <li>• Review and confirm the extracted data</li>
                <li>• Create your expense with pre-filled information</li>
              </ul>
              <p className="text-xs text-blue-600 mt-3">
                Powered by <strong>OCR.space API</strong> - Free tier provides 25,000 requests/month
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }

        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(20px, -20px) scale(1.1);
          }
          50% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          75% {
            transform: translate(20px, 20px) scale(1.05);
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}

function DataField({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border-2 transition-all duration-200 ${
      highlight 
        ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200' 
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        <span className={highlight ? 'text-indigo-600' : 'text-gray-600'}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-sm font-semibold ${highlight ? 'text-indigo-900 text-lg' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  )
}