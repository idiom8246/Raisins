import { openDB, IDBPDatabase } from 'idb';
import { Trip, Invoice, Item, Settings } from '../types/schema';

const DB_NAME = 'inventory_tracker_db';
const DB_VERSION = 1;

export class DatabaseService {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('trips', { keyPath: 'id' });
        
        const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id' });
        invoiceStore.createIndex('by-trip', 'tripId');
        
        const itemStore = db.createObjectStore('items', { keyPath: 'id' });
        itemStore.createIndex('by-invoice', 'invoiceId');
        itemStore.createIndex('by-status', 'status');
        itemStore.createIndex('by-type', 'type');
        
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }

  // Trips
  async getAllTrips(): Promise<Trip[]> {
    return (await this.db).getAll('trips');
  }
  async saveTrip(trip: Trip) {
    return (await this.db).put('trips', trip);
  }

  // Invoices
  async getAllInvoices(): Promise<Invoice[]> {
    return (await this.db).getAll('invoices');
  }
  async getInvoicesByTrip(tripId: string): Promise<Invoice[]> {
    return (await this.db).getAllFromIndex('invoices', 'by-trip', tripId);
  }
  async saveInvoice(invoice: Invoice) {
    return (await this.db).put('invoices', invoice);
  }

  // Items
  async getAllItems(): Promise<Item[]> {
    return (await this.db).getAll('items');
  }
  async getItemsByInvoice(invoiceId: string): Promise<Item[]> {
    return (await this.db).getAllFromIndex('items', 'by-invoice', invoiceId);
  }
  async saveItem(item: Item) {
    return (await this.db).put('items', item);
  }
  async deleteItem(id: string) {
    return (await this.db).delete('items', id);
  }

  // Settings
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const res = await (await this.db).get('settings', key);
    return res ? res.value : defaultValue;
  }
  async setSetting(key: string, value: any) {
    return (await this.db).put('settings', { key, value });
  }
}

export const dbService = new DatabaseService();
