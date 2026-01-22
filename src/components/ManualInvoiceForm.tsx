import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Globe } from 'lucide-react';
import { Trip, Invoice, Item } from '../types/schema';
import { dbService } from '../services/db';
import { translateToChinese } from '../services/ai';

interface ManualInvoiceFormProps {
  initialData?: Partial<Invoice & { items: Partial<Item>[] }>;
  onSave: () => void;
  onCancel: () => void;
}

export const ManualInvoiceForm: React.FC<ManualInvoiceFormProps> = ({ initialData, onSave, onCancel }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [invoice, setInvoice] = useState({
    tripId: initialData?.tripId || '',
    shopName: initialData?.shopName || '',
    shopAddress: initialData?.shopAddress || '',
    tel: initialData?.tel || '',
    country: initialData?.country || '',
    currency: initialData?.currency || 'HKD',
    txDate: initialData?.txDate || new Date().toISOString().split('T')[0],
    txTime: initialData?.txTime || new Date().toTimeString().split(' ')[0].substring(0, 5),
    totalAmount: initialData?.totalAmount || 0,
  });

  const [items, setItems] = useState<Partial<Item>[]>(
    initialData?.items || [{ id: crypto.randomUUID(), nameOriginal: '', nameChinese: '', type: '食品', qty: 1, price: 0, discount: 0, currency: 'HKD' }]
  );

  const [isTranslating, setIsTranslating] = useState<string | null>(null);

  useEffect(() => {
    dbService.getAllTrips().then(setTrips);
  }, []);

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), nameOriginal: '', nameChinese: '', type: '食品', qty: 1, price: 0, discount: 0, currency: invoice.currency }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof Item, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleTranslate = async (id: string, text: string) => {
    if (!text) return;
    setIsTranslating(id);
    const geminiKey = await dbService.getSetting('geminiApiKey', '');
    const geminiModel = await dbService.getSetting('geminiModel', 'gemini-1.5-flash');
    const result = await translateToChinese(text, geminiKey, geminiModel);
    if (result.chinese) {
      updateItem(id, 'nameChinese', result.chinese);
    }
    setIsTranslating(null);
  };

  const handleSave = async () => {
    const invoiceId = crypto.randomUUID();
    const newInvoice: Invoice = {
      ...invoice,
      id: invoiceId,
      totalAmount: items.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)) - (Number(item.discount) || 0), 0)
    };

    await dbService.saveInvoice(newInvoice);
    
    for (const item of items) {
      await dbService.saveItem({
        ...(item as Item),
        id: item.id || crypto.randomUUID(),
        invoiceId,
        currency: item.currency || invoice.currency,
        status: '未開封',
        discount: Number(item.discount) || 0
      });
    }

    onSave();
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <section className="space-y-4">
        <h3 className="font-bold text-lg text-slate-800 border-b pb-2">收據資訊</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-500 mb-1 block">行程 (選填)</label>
            <select 
              value={invoice.tripId} 
              onChange={e => setInvoice({...invoice, tripId: e.target.value})}
            >
              <option value="">不指定行程 (本地消費)</option>
              {trips.map(trip => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-500 mb-1 block">商店名稱</label>
            <input 
              type="text" 
              value={invoice.shopName} 
              onChange={e => setInvoice({...invoice, shopName: e.target.value})}
              placeholder="例如：驚安之殿堂"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-500 mb-1 block">商店地址</label>
            <input 
              type="text" 
              value={invoice.shopAddress} 
              onChange={e => setInvoice({...invoice, shopAddress: e.target.value})}
              placeholder="例如：東京都新宿區..."
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-500 mb-1 block">電話</label>
            <input 
              type="text" 
              value={invoice.tel} 
              onChange={e => setInvoice({...invoice, tel: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">日期</label>
            <input 
              type="date" 
              value={invoice.txDate} 
              onChange={e => setInvoice({...invoice, txDate: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">時間</label>
            <input 
              type="time" 
              value={invoice.txTime} 
              onChange={e => setInvoice({...invoice, txTime: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">幣別</label>
            <input 
              type="text" 
              value={invoice.currency} 
              onChange={e => setInvoice({...invoice, currency: e.target.value.toUpperCase()})}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">國家</label>
            <input 
              type="text" 
              value={invoice.country} 
              onChange={e => setInvoice({...invoice, country: e.target.value})}
              placeholder="例如：日本"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-bold text-lg text-slate-800">商品清單</h3>
          <button onClick={addItem} className="text-primary-600 flex items-center gap-1 text-sm font-bold">
            <Plus size={16} /> 新增項目
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="card bg-slate-50/50 space-y-3 relative">
              <button 
                onClick={() => removeItem(item.id!)}
                className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
              >
                <Trash2 size={18} />
              </button>
              
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">原始品名</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1"
                      value={item.nameOriginal} 
                      onChange={e => updateItem(item.id!, 'nameOriginal', e.target.value)}
                    />
                    <button 
                      onClick={() => handleTranslate(item.id!, item.nameOriginal!)}
                      disabled={isTranslating === item.id}
                      className="bg-white border border-slate-200 p-2 rounded-xl text-primary-600 active:bg-primary-50"
                    >
                      <Globe size={20} className={isTranslating === item.id ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
                <div className="col-span-12">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">中文名稱</label>
                  <input 
                    type="text" 
                    value={item.nameChinese} 
                    onChange={e => updateItem(item.id!, 'nameChinese', e.target.value)}
                    placeholder="翻譯或手動輸入"
                  />
                </div>
                <div className="col-span-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">類別</label>
                  <select 
                    value={item.type} 
                    onChange={e => updateItem(item.id!, 'type', e.target.value)}
                  >
                    <option value="食品">食品</option>
                    <option value="藥品">藥品</option>
                    <option value="生活用品">生活用品</option>
                    <option value="化妝品">化妝品</option>
                    <option value="衣物">衣物</option>
                    <option value="電子產品">電子產品</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">數量</label>
                  <input 
                    type="number" 
                    value={item.qty} 
                    onChange={e => updateItem(item.id!, 'qty', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">單價</label>
                  <input 
                    type="number" 
                    value={item.price} 
                    onChange={e => updateItem(item.id!, 'price', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">折扣</label>
                  <input 
                    type="number" 
                    value={item.discount} 
                    onChange={e => updateItem(item.id!, 'discount', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="fixed bottom-20 left-4 right-4 flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1">取消</button>
        <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <Save size={20} /> 儲存記錄
        </button>
      </div>
    </div>
  );
};
