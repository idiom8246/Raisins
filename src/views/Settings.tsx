import React, { useState, useEffect } from 'react';
import { Trip } from '../types/schema';
import { dbService } from '../services/db';
import { Plus, Trash2, Download, Upload, RefreshCw, Key, Landmark } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [newTripName, setNewTripName] = useState('');
  const [homeCurrency, setHomeCurrency] = useState('HKD');
  const [geminiKey, setGeminiKey] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const allTrips = await dbService.getAllTrips();
    const currency = await dbService.getSetting('homeCurrency', 'HKD');
    const key = await dbService.getSetting('geminiApiKey', '');
    setTrips(allTrips);
    setHomeCurrency(currency);
    setGeminiKey(key);
  };

  const handleAddTrip = async () => {
    if (!newTripName) return;
    const newTrip: Trip = {
      id: crypto.randomUUID(),
      name: newTripName,
      startDate: new Date().toISOString().split('T')[0]
    };
    await dbService.saveTrip(newTrip);
    setNewTripName('');
    loadSettings();
  };

  const handleDeleteTrip = async (id: string) => {
    if (window.confirm('確定要刪除此行程嗎？相關收據將變為本地消費。')) {
      // Logic would be to remove tripId from invoices, but for now we just delete trip
      // We need a proper delete in dbService
      loadSettings();
    }
  };

  const saveGeneralSettings = async () => {
    await dbService.setSetting('homeCurrency', homeCurrency);
    await dbService.setSetting('geminiApiKey', geminiKey);
    alert('設定已儲存');
  };

  const exportData = async () => {
    const data = {
      trips: await dbService.getAllTrips(),
      invoices: await dbService.getAllInvoices(),
      items: await dbService.getAllItems(),
      settings: { homeCurrency, geminiKey }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        // Sequential save to IDB
        for (const trip of data.trips || []) await dbService.saveTrip(trip);
        for (const invoice of data.invoices || []) await dbService.saveInvoice(invoice);
        for (const item of data.items || []) await dbService.saveItem(item);
        alert('匯入成功！');
        loadSettings();
      } catch (err) {
        alert('匯入失敗，格式不正確');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-bold text-slate-800">設定</h1>

      <section className="space-y-4">
        <h3 className="font-bold text-slate-500 text-xs uppercase tracking-wider flex items-center gap-2">
          <Landmark size={14} /> 一般設定
        </h3>
        <div className="card space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">本位幣別 (Home Currency)</label>
            <input 
              type="text" 
              value={homeCurrency} 
              onChange={e => setHomeCurrency(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block flex items-center gap-1">
              <Key size={14} /> Gemini API Key (備用翻譯)
            </label>
            <input 
              type="password" 
              value={geminiKey} 
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="輸入 API Key 以提升翻譯品質"
            />
          </div>
          <button onClick={saveGeneralSettings} className="btn-primary w-full">儲存設定</button>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-bold text-slate-500 text-xs uppercase tracking-wider flex items-center gap-2">
          <RefreshCw size={14} /> 行程管理
        </h3>
        <div className="card space-y-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="行程名稱 (例如: 日本東京)" 
              value={newTripName}
              onChange={e => setNewTripName(e.target.value)}
            />
            <button onClick={handleAddTrip} className="btn-primary flex-shrink-0">
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-2">
            {trips.map(trip => (
              <div key={trip.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                <span className="font-medium">{trip.name}</span>
                <button onClick={() => handleDeleteTrip(trip.id)} className="text-slate-400 hover:text-red-500">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-bold text-slate-500 text-xs uppercase tracking-wider flex items-center gap-2">
          <Download size={14} /> 數據備份與移植
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={exportData} className="card flex flex-col items-center gap-2 hover:border-primary-300">
            <Download size={24} className="text-primary-600" />
            <span className="font-bold">匯出 JSON</span>
          </button>
          <label className="card flex flex-col items-center gap-2 hover:border-primary-300 cursor-pointer">
            <Upload size={24} className="text-emerald-600" />
            <span className="font-bold">匯入 JSON</span>
            <input type="file" className="hidden" accept=".json" onChange={handleImport} />
          </label>
        </div>
      </section>
    </div>
  );
};
