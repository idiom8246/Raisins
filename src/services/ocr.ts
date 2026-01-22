import { createWorker } from 'tesseract.js';

export interface ParsedReceipt {
  shopName: string;
  shopAddress?: string;
  country?: string;
  tel?: string;
  txDate: string;
  txTime: string;
  items: { 
    name: string; 
    nameChinese?: string; 
    price: number; 
    qty: number; 
    type?: string;
    discount?: number;
  }[];
  totalAmount: number;
  currency?: string;
}

export async function processReceipt(imageFile: File | string): Promise<ParsedReceipt> {
  const worker = await createWorker('eng+chi_tra');
  
  const { data: { text } } = await worker.recognize(imageFile);
  await worker.terminate();

  console.log('OCR Raw Text:', text);
  return parseOCRText(text);
}

export async function processReceiptWithGemini(imageFile: File, apiKey: string, model: string = 'gemini-1.5-flash'): Promise<ParsedReceipt> {
  const base64Image = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(',')[1]);
    };
    reader.readAsDataURL(imageFile);
  });

  const prompt = `你是一個專業的收據識別助手。請分析這張圖片，並提取以下詳細資訊，以 JSON 格式返回：

  1. 商店資訊：
     - shopName: 商店名稱
     - shopAddress: 商店地址 (如有)
     - country: 國家/地區 (如 Japan, Taiwan, Hong Kong)
     - tel: 電話號碼 (如有)
  
  2. 交易資訊：
     - txDate: 交易日期 (格式 YYYY-MM-DD)
     - txTime: 交易時間 (格式 HH:mm)
     - currency: 貨幣代碼 (如 JPY, TWD, HKD, USD)
     - totalAmount: 總金額 (純數字)
  
  3. 商品清單 (items 陣列)，每項包含：
     - name: 原始品名 (保留原文)
     - nameChinese: 中文翻譯品名 (繁體中文)
     - price: 單價 (純數字)
     - qty: 數量 (純數字，預設 1)
     - discount: 此項目的折扣金額 (如有，正數表示扣減金額，無則為 0)
     - type: 商品類別 (從以下選擇：食品, 藥品, 生活用品, 化妝品, 衣物, 電子產品, 其他)

  請注意：
  - 如果無法識別某些欄位，請省略或設為 null。
  - 確保 JSON 格式正確且無 Markdown 標記。
  - 若有折扣，請確保 totalAmount 是折扣後的最終金額。`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: imageFile.type, data: base64Image } }
        ]
      }]
    })
  });

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) throw new Error('AI 辨識無效');

  // Extract JSON from potential markdown code block
  const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 返回格式錯誤');
  
  return JSON.parse(jsonMatch[0]);
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
