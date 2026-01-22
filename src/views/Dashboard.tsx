import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { Item, Invoice, Trip } from '../types/schema';
import { ShoppingBag, AlertTriangle, Map, TrendingUp } from 'lucide-react';

export const DashboardView: React.FC = () => {
  const [stats, setStats] = useState({
    totalInventory: 0,
    expiringSoon: 0,
    currentTripExpenses: 0,
    tripName: '本地消費',
    homeCurrency: 'HKD'
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [items, invoices, homeCurrency] = await Promise.all([
      dbService.getAllItems(),
      dbService.getAllInvoices(),
      dbService.getSetting('homeCurrency', 'HKD')
    ]);

    const activeItems = items.filter(i => i.status !== '已用完');
    
    // Simple logic for "expiring soon": within 30 days
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);
    
    const expiring = activeItems.filter(i => {
      if (!i.expiryDate) return false;
      const exp = new Date(i.expiryDate);
      return exp > now && exp < thirtyDaysLater;
    });

    // Assume current month expenses for "Dashboard"
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthExpenses = invoices.reduce((sum, inv) => {
      const d = new Date(inv.txDate);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear && inv.currency === homeCurrency) {
        return sum + inv.totalAmount;
      }
      return sum;
    }, 0);

    setStats({
      totalInventory: activeItems.length,
      expiringSoon: expiring.length,
      currentTripExpenses: monthExpenses,
      tripName: '本月支出 (本位幣)',
      homeCurrency
    });
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-700">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">概覽</h1>
        <div className="bg-white px-3 py-1 rounded-full border border-slate-100 text-xs font-medium text-slate-500">
          {new Date().toLocaleDateString('zh-TW')}
        </div>
      </header>

      <div className="card bg-gradient-to-br from-primary-600 to-primary-700 text-white border-none shadow-lg shadow-primary-200/50 relative overflow-hidden">
        <div className="relative z-10">
          <p className="opacity-80 text-sm font-medium">{stats.tripName}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-sm opacity-80">{stats.homeCurrency}</span>
            <h2 className="text-4xl font-bold tracking-tight">
              {stats.currentTripExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h2>
          </div>
        </div>
        <TrendingUp className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card flex flex-col gap-2">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
            <ShoppingBag size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">現有庫存</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalInventory} <span className="text-xs font-normal text-slate-400">件</span></p>
          </div>
        </div>

        <div className="card flex flex-col gap-2">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">即將過期</p>
            <p className="text-2xl font-bold text-slate-800">{stats.expiringSoon} <span className="text-xs font-normal text-slate-400">件</span></p>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="font-bold text-slate-800">常用功能</h3>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction icon={<Map size={20} />} label="行程" color="bg-blue-50 text-blue-600" />
          <QuickAction icon={<TrendingUp size={20} />} label="匯率" color="bg-emerald-50 text-emerald-600" />
          <QuickAction icon={<ShoppingBag size={20} />} label="分類" color="bg-purple-50 text-purple-600" />
          <QuickAction icon={<AlertTriangle size={20} />} label="提醒" color="bg-amber-50 text-amber-600" />
        </div>
      </section>
    </div>
  );
};

const QuickAction = ({ icon, label, color }: { icon: React.ReactNode, label: string, color: string }) => (
  <button className="flex flex-col items-center gap-2">
    <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shadow-sm active:scale-90 transition-transform`}>
      {icon}
    </div>
    <span className="text-[10px] font-bold text-slate-500">{label}</span>
  </button>
);
