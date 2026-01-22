import React, { useState } from 'react';
import { Camera, Barcode, Upload, Edit3, FileText, Loader2 } from 'lucide-react';
import { processReceipt, processReceiptWithGemini } from '../services/ocr';
import { ManualInvoiceForm } from '../components/ManualInvoiceForm';
import { dbService } from '../services/db';
import { clsx } from 'clsx';

type RecordMode = 'menu' | 'ocr' | 'barcode' | 'manual_invoice' | 'manual_item' | 'review';
type OCRMethod = 'tesseract' | 'gemini';

export const RecordView: React.FC = () => {
  const [mode, setMode] = useState<RecordMode>('menu');
  const [isLoading, setIsLoading] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const [ocrMethod, setOcrMethod] = useState<OCRMethod>('tesseract');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      let parsed;
      if (ocrMethod === 'gemini') {
        const geminiKey = await dbService.getSetting('geminiApiKey', '');
        const geminiModel = await dbService.getSetting('geminiModel', 'gemini-1.5-flash');
        if (!geminiKey) {
          alert('請先在設定頁面輸入 Gemini API Key 以使用 AI 辨識功能');
          setIsLoading(false);
          return;
        }
        parsed = await processReceiptWithGemini(file, geminiKey, geminiModel);
      } else {
        parsed = await processReceipt(file);
      }
      
      setInitialData({
        shopName: parsed.shopName,
        txDate: parsed.txDate,
        txTime: parsed.txTime,
        totalAmount: parsed.totalAmount,
        currency: parsed.currency || 'HKD',
        items: parsed.items.map(item => ({
          id: crypto.randomUUID(),
          nameOriginal: item.name,
          nameChinese: item.nameChinese || '',
          price: item.price,
          qty: item.qty,
          type: '食品'
        }))
      });
      setMode('review');
    } catch (err) {
      console.error('OCR Error:', err);
      alert('辨識失敗，請嘗試手動輸入或檢查 API Key');
    } finally {
      setIsLoading(false);
    }
  };

  const onSave = () => {
    setMode('menu');
    alert('已成功儲存！');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <Loader2 size={48} className="text-primary-600 animate-spin mb-4" />
        <h2 className="text-xl font-bold">正在辨識收據...</h2>
        <p className="text-slate-500 mt-2">這可能需要幾秒鐘時間，請稍候</p>
      </div>
    );
  }

  if (mode === 'review' || mode === 'manual_invoice') {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMode('menu')} className="text-primary-600 font-medium">← 返回</button>
          <h2 className="font-bold text-lg">{mode === 'review' ? '核對收據' : '手動輸入收據'}</h2>
          <div className="w-10"></div>
        </div>
        <ManualInvoiceForm 
          initialData={initialData} 
          onSave={onSave} 
          onCancel={() => setMode('menu')} 
        />
      </div>
    );
  }

  if (mode === 'menu') {
    return (
      <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <h1 className="text-2xl font-bold mb-6 text-slate-800">新增記錄</h1>
        
        <div className="mb-6 p-1 bg-slate-100 rounded-xl flex gap-1">
          <button 
            onClick={() => setOcrMethod('tesseract')}
            className={clsx(
              "flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all",
              ocrMethod === 'tesseract' ? "bg-white shadow-sm text-primary-600" : "text-slate-500"
            )}
          >
            標準辨識 (本地)
          </button>
          <button 
            onClick={() => setOcrMethod('gemini')}
            className={clsx(
              "flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all",
              ocrMethod === 'gemini' ? "bg-white shadow-sm text-primary-600" : "text-slate-500"
            )}
          >
            AI 辨識 (Gemini)
          </button>
        </div>

        <div className="grid gap-4">
          <label className="card flex items-center gap-4 hover:border-primary-300 transition-colors text-left cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 group-active:scale-90 transition-transform">
              <Camera size={24} />
            </div>
            <div>
              <p className="font-bold text-lg">掃描/上傳收據</p>
              <p className="text-sm text-slate-500">自動辨識品名與價格</p>
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>

          <button 
            onClick={() => setMode('barcode')}
            className="card flex items-center gap-4 hover:border-primary-300 transition-colors text-left group"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-active:scale-90 transition-transform">
              <Barcode size={24} />
            </div>
            <div>
              <p className="font-bold text-lg">掃描條碼</p>
              <p className="text-sm text-slate-500">快速辨識商品資訊</p>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setMode('manual_invoice')}
              className="card flex flex-col items-center gap-2 hover:border-primary-300 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-1">
                <FileText size={20} />
              </div>
              <p className="font-bold">手動輸入</p>
            </button>

            <button 
              onClick={() => setMode('manual_item')}
              className="card flex flex-col items-center gap-2 hover:border-primary-300 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mb-1">
                <Edit3 size={20} />
              </div>
              <p className="font-bold">單件補錄</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <button onClick={() => setMode('menu')} className="mb-4 text-primary-600 font-medium">← 返回選單</button>
      <div className="card text-center py-20">
        <p className="text-slate-400">{mode} 功能開發中...</p>
      </div>
    </div>
  );
};
