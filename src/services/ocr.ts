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
  // Add preprocessing for better local OCR results
  const processedImage = await preprocessImage(imageFile);
  const worker = await createWorker('eng+chi_tra+kor');
  
  const { data: { text } } = await worker.recognize(processedImage);
  await worker.terminate();

  console.log('OCR Raw Text:', text);
  return parseOCRText(text);
}

async function preprocessImage(imageFile: File | string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof imageFile === 'string' ? imageFile : URL.createObjectURL(imageFile));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // 1. Draw image
      ctx.drawImage(img, 0, 0);

      // 2. Grayscale and Contrast enhancement
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Simple contrast factor
      const contrast = 1.2; 
      const intercept = 128 * (1 - contrast);

      for (let i = 0; i < data.length; i += 4) {
        // Grayscale using luminance formula
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Boost contrast
        const v = avg * contrast + intercept;
        
        data[i] = v;     // R
        data[i + 1] = v; // G
        data[i + 2] = v; // B
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };

    if (typeof imageFile === 'string') {
      img.src = imageFile;
    } else {
      img.src = URL.createObjectURL(imageFile);
    }
  });
}

function parseOCRText(text: string): ParsedReceipt {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const totalKeywords = ['總額', '總數', '合計', '合 計', '합계', '합 계', 'TOTAL', 'TOTAL AMOUNT', '實際應付金額', '結算金額', '받을금액', '결제금액'];
  
  const result: ParsedReceipt = {
    shopName: '未知商店',
    txDate: new Date().toISOString().split('T')[0],
    txTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    items: [],
    totalAmount: 0,
    currency: 'HKD' // Default
  };

  // 1. Metadata Extraction
  
  // Date Patterns: YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY
  const datePattern = /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{4})/;
  const dateMatch = text.match(datePattern);
  if (dateMatch) {
    let rawDate = dateMatch[0].replace(/\//g, '-');
    // If it's DD-MM-YYYY, convert to YYYY-MM-DD
    if (rawDate.match(/^\d{1,2}-/)) {
      const parts = rawDate.split('-');
      if (parts.length === 3) {
        rawDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    result.txDate = rawDate;
  }

  // Time Patterns: HH:mm:ss, HH:mm
  const timePattern = /([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?/;
  const timeMatch = text.match(timePattern);
  if (timeMatch) result.txTime = timeMatch[0].substring(0, 5);

  // Phone Patterns
  const telPattern = /(Tel|電話|TEL)[:\s]*([\d\-)( \s]{8,15})|(\d{2,3}-\d{3,4}-\d{4})/;
  const telMatch = text.match(telPattern);
  if (telMatch) result.tel = (telMatch[2] || telMatch[0]).trim();

  // Currency Detection
  if (text.includes('KRW') || text.includes('원') || text.includes('브랜드')) result.currency = 'KRW';
  else if (text.includes('JPY') || text.includes('円')) result.currency = 'JPY';
  else if (text.includes('TWD') || text.includes('NT$')) result.currency = 'TWD';
  else if (text.includes('HKD') || text.includes('$') || text.includes('759') || text.includes('惠康')) result.currency = 'HKD';

  // 2. Shop Name Heuristic (Usually first few lines)
  const likelyShopLines = lines.slice(0, 5);
  for (const line of likelyShopLines) {
    if (line.length > 2 && !line.match(/\d{4}/) && !line.includes(':') && !line.includes('收據')) {
      result.shopName = line;
      break;
    }
  }

  // 3. Item & Total Extraction
  lines.forEach((line, index) => {
    // Total Amount Keywords
    if (totalKeywords.some(kw => line.toUpperCase().includes(kw))) {
      const amountMatch = line.match(/([\d,]+\.?\d*)$/);
      if (amountMatch) {
        result.totalAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
      } else {
        // Try next line for amount
        const nextLine = lines[index+1];
        if (nextLine) {
          const nextMatch = nextLine.match(/([\d,]+\.?\d*)$/);
          if (nextMatch) result.totalAmount = parseFloat(nextMatch[1].replace(/,/g, ''));
        }
      }
    }

    // Discount Pattern
    const discountMatch = line.match(/(-[\d,]+\.?\d*)$/) || line.match(/(折扣|優惠|Disc).*?(-?[\d,]+\.?\d*)$/);
    if (discountMatch && result.items.length > 0) {
      const discVal = Math.abs(parseFloat(discountMatch[discountMatch.length - 1].replace(/,/g, '')));
      result.items[result.items.length - 1].discount = discVal;
      return;
    }

    // Line Item Detection Heuristics
    // Pattern A: [Name] ... [Price] [Qty] [Total]
    const patternA = /^(.*?)\s+([\d,]+\.?\d*)\s+(\d+)\s+([\d,]+\.?\d*)$/;
    const matchA = line.match(patternA);
    if (matchA) {
      result.items.push({
        name: matchA[1].trim(),
        price: parseFloat(matchA[2].replace(/,/g, '')),
        qty: parseInt(matchA[3]),
        type: '其他'
      });
      return;
    }

    // Pattern B: Multiplier line (e.g. "X 2$ 45.8" or "1 @ 13.90")
    const multiplierPattern = /([X@])\s*(\d+)?\s*\$?([\d,]+\.?\d*)\s*\$?([\d,]+\.?\d*)$/;
    const matchMult = line.match(multiplierPattern);
    if (matchMult && index > 0) {
      const name = lines[index-1];
      const qty = parseInt(matchMult[2] || '1');
      const price = parseFloat(matchMult[3].replace(/,/g, ''));
      result.items.push({
        name,
        price,
        qty,
        type: '其他'
      });
      return;
    }
  });

  // Post-process items: if no items found, try simpler regex for any line with price
  if (result.items.length === 0) {
    lines.forEach(line => {
      const simplePriceMatch = line.match(/^(.*?)\s+([\d,]+\.\d{2})$/) || line.match(/^(.*?)\s+([\d,]{4,10})$/);
      if (simplePriceMatch) {
        const name = simplePriceMatch[1].trim();
        if (name.length > 2 && !totalKeywords.some(kw => name.toUpperCase().includes(kw))) {
          result.items.push({
            name,
            price: parseFloat(simplePriceMatch[2].replace(/,/g, '')),
            qty: 1,
            type: '其他'
          });
        }
      }
    });
  }

  return result;
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
