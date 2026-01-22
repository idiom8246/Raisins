import { createWorker } from 'tesseract.js';

export interface ParsedReceipt {
  shopName: string;
  txDate: string;
  txTime: string;
  items: { name: string; nameChinese?: string; price: number; qty: number }[];
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

  const prompt = `分析這張收據圖片。請提取以下資訊並以 JSON 格式返回：
  - 商店名稱 (shopName)
  - 交易日期 (txDate, 格式 YYYY-MM-DD)
  - 交易時間 (txTime, 格式 HH:mm)
  - 幣別 (currency, 如 HKD, JPY, TWD)
  - 總金額 (totalAmount, 數字)
  - 項目清單 (items): 每個項目包含名稱 (name, 原始語言)、中文翻譯 (nameChinese)、單價 (price) 和數量 (qty)。
  
  請只返回 JSON 代碼塊。`;

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
