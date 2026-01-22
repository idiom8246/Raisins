import { createWorker } from 'tesseract.js';

export interface ParsedReceipt {
  shopName: string;
  txDate: string;
  txTime: string;
  items: { name: string; price: number; qty: number }[];
  totalAmount: number;
}

export async function processReceipt(imageFile: File | string): Promise<ParsedReceipt> {
  const worker = await createWorker('eng+chi_tra');
  
  const { data: { text } } = await worker.recognize(imageFile);
  await worker.terminate();

  console.log('OCR Raw Text:', text);
  return parseOCRText(text);
}

function parseOCRText(text: string): ParsedReceipt {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let shopName = lines[0] || '未知商店';
  let txDate = new Date().toISOString().split('T')[0];
  let txTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
  let totalAmount = 0;
  const items: { name: string; price: number; qty: number }[] = [];

  // Simple RegEx for Date (YYYY-MM-DD or DD/MM/YYYY)
  const dateMatch = text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{4})/);
  if (dateMatch) txDate = dateMatch[0].replace(/\//g, '-');

  // Simple RegEx for Time (HH:mm)
  const timeMatch = text.match(/([01]?[0-9]|2[0-3]):[0-5][0-9]/);
  if (timeMatch) txTime = timeMatch[0];

  // Logic to find items: Lines that look like "Name ... Price"
  // This is highly variable, so we use a simple heuristic
  lines.forEach(line => {
    const priceMatch = line.match(/(\d+\.\d{2})$/);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      const name = line.replace(priceMatch[0], '').trim();
      
      if (name.toLowerCase().includes('total')) {
        totalAmount = price;
      } else if (name.length > 2) {
        items.push({ name, price, qty: 1 });
      }
    }
  });

  return { shopName, txDate, txTime, items, totalAmount };
}
