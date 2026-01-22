import React, { useState, useEffect } from 'react';
import { BottomNav } from './components/BottomNav';
import { RecordView } from './views/Record';
import { InventoryView } from './views/Inventory';
import { SettingsView } from './views/Settings';
import { PriceView } from './views/Price';
import { DashboardView } from './views/Dashboard';

import { dbService } from './services/db';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    dbService.requestPersistence();
  }, []);

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'record': return <RecordView />;
      case 'inventory': return <InventoryView />;
      case 'price': return <PriceView />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50">
      <main className="pb-16">
        {renderView()}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
