import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, MapPin, Tag, ChevronRight, Trash2 } from 'lucide-react';
import { Item, Trip, Invoice, ItemStatus } from '../types/schema';
import { dbService } from '../services/db';
import { clsx } from 'clsx';

export const InventoryView: React.FC = () => {
  const [items, setItems] = useState<(Item & { invoice?: Invoice; trip?: Trip })[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrip, setSelectedTrip] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ItemStatus | ''>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [allItems, allInvoices, allTrips] = await Promise.all([
      dbService.getAllItems(),
      dbService.getAllInvoices(),
      dbService.getAllTrips()
    ]);

    const enrichedItems = allItems.map(item => {
      const invoice = allInvoices.find(i => i.id === item.invoiceId);
      const trip = allTrips.find(t => t.id === invoice?.tripId);
      return { ...item, invoice, trip };
    });

    setItems(enrichedItems);
    setTrips(allTrips);
    setLoading(false);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.nameOriginal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nameChinese.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTrip = !selectedTrip || item.invoice?.tripId === selectedTrip;
    const matchesType = !selectedType || item.type === selectedType;
    const matchesStatus = !selectedStatus || item.status === selectedStatus;
    
    return matchesSearch && matchesTrip && matchesType && matchesStatus;
  });

  const toggleStatus = async (item: Item) => {
    let nextStatus: ItemStatus = '未開封';
    let openDate = item.openDate;

    if (item.status === '未開封') {
      nextStatus = '已開封';
      openDate = new Date().toISOString().split('T')[0];
    } else if (item.status === '已開封') {
      nextStatus = '已用完';
    } else {
      nextStatus = '未開封';
      openDate = undefined;
    }

    const updatedItem = { ...item, status: nextStatus, openDate };
    await dbService.saveItem(updatedItem);
    loadData(); // Refresh
  };

  const deleteItem = async (id: string) => {
    if (window.confirm('確定要刪除此項目嗎？')) {
      await dbService.deleteItem(id);
      loadData();
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">庫存管理</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="搜尋品名..." 
          className="pl-10"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
        <select 
          className="text-xs py-1 px-2 h-8 w-auto min-w-[80px]"
          value={selectedTrip}
          onChange={e => setSelectedTrip(e.target.value)}
        >
          <option value="">所有行程</option>
          <option value="local">本地消費</option>
          {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select 
          className="text-xs py-1 px-2 h-8 w-auto min-w-[80px]"
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
        >
          <option value="">所有類別</option>
          {['食品', '藥品', '生活用品', '化妝品', '衣物', '電子產品', '其他'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select 
          className="text-xs py-1 px-2 h-8 w-auto min-w-[80px]"
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value as ItemStatus)}
        >
          <option value="">所有狀態</option>
          <option value="未開封">未開封</option>
          <option value="已開封">已開封</option>
          <option value="已用完">已用完</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">載入中...</div>
      ) : (
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-20 card text-slate-400">找不到相關項目</div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="card flex gap-3 items-start group">
                <div 
                  onClick={() => toggleStatus(item)}
                  className={clsx(
                    "w-12 h-12 rounded-xl flex-shrink-0 flex flex-col items-center justify-center text-[10px] font-bold border-2 cursor-pointer transition-all",
                    item.status === '未開封' && "bg-blue-50 border-blue-200 text-blue-600",
                    item.status === '已開封' && "bg-orange-50 border-orange-200 text-orange-600",
                    item.status === '已用完' && "bg-slate-100 border-slate-200 text-slate-400"
                  )}
                >
                  {item.status}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 truncate">{item.nameChinese || item.nameOriginal}</h3>
                  <p className="text-xs text-slate-400 truncate mb-1">{item.nameOriginal}</p>
                  
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Tag size={10} /> {item.type}
                    </span>
                    {item.trip && (
                      <span className="flex items-center gap-1 text-[10px] text-primary-600 font-medium">
                        <MapPin size={10} /> {item.trip.name}
                      </span>
                    )}
                    {item.expiryDate && (
                      <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                        <Calendar size={10} /> 效期: {item.expiryDate}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex flex-col items-end justify-between">
                  <p className="font-bold text-slate-700">{item.currency} {item.price}</p>
                  <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
