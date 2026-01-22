import React, { useState, useEffect } from 'react';
import { Item, Invoice } from '../types/schema';
import { dbService } from '../services/db';
import { TrendingDown, TrendingUp, History, Info } from 'lucide-react';

export const PriceView: React.FC = () => {
  const [groupedItems, setGroupedItems] = useState<Record<string, Item[]>>({});
  const [loading, setLoading] = useState(true);
  const [homeCurrency, setHomeCurrency] = useState('HKD');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [items, currency] = await Promise.all([
      dbService.getAllItems(),
      dbService.getSetting('homeCurrency', 'HKD')
    ]);
    
    setHomeCurrency(currency);

    // Group items by Original Name or Barcode
    const groups: Record<string, Item[]> = {};
    items.forEach(item => {
      const key = item.barcode || item.nameOriginal.toLowerCase().trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    setGroupedItems(groups);
    setLoading(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-400">分析中...</div>;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">價格對比</h1>

      <div className="card bg-blue-50 border-blue-100 flex gap-3">
        <Info className="text-blue-500 shrink-0" size={20} />
        <p className="text-xs text-blue-700 leading-relaxed">
          系統會根據品名或條碼自動對比價格。由於匯率浮動，目前對比顯示原始購買幣別。
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedItems).map(([key, items]) => {
          if (items.length < 2) return null; // Only show if we have history

          // Find min/max price
          const prices = items.map(i => i.price);
          const minPrice = Math.min(...prices);
          const latestItem = items[items.length - 1];

          return (
            <div key={key} className="card space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800">{latestItem.nameChinese || latestItem.nameOriginal}</h3>
                  <p className="text-[10px] text-slate-400">{latestItem.nameOriginal}</p>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold">
                  共有 {items.length} 次記錄
                </div>
              </div>

              <div className="space-y-2">
                {items.sort((a,b) => b.price - a.price).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 text-xs">歷史記錄 {idx + 1}</span>
                    <span className={clsx(
                      "font-bold",
                      item.price === minPrice ? "text-emerald-600" : "text-slate-700"
                    )}>
                      {item.currency} {item.price}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {Object.values(groupedItems).every(arr => arr.length < 2) && (
          <div className="card text-center py-20 text-slate-400">
            尚未有重複購買的商品記錄，無法進行對比。
          </div>
        )}
      </div>
    </div>
  );
};

function clsx(...args: any[]) {
  return args.filter(Boolean).join(' ');
}
