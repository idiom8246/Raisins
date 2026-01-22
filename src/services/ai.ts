export interface TranslationResult {
  chinese: string;
  source: 'mymemory' | 'gemini' | 'manual';
}

export async function translateToChinese(text: string, geminiKey?: string): Promise<TranslationResult> {
  // 1. Try MyMemory API (Free)
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`);
    const data = await res.json();
    if (data.responseData?.translatedText) {
      return { chinese: data.responseData.translatedText, source: 'mymemory' };
    }
  } catch (err) {
    console.error('MyMemory failed:', err);
  }

  // 2. Try Gemini API if key is provided
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Translate this product name to Traditional Chinese: "${text}". Return only the translation.` }] }]
        })
      });
      const data = await res.json();
      const translation = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (translation) {
        return { chinese: translation.trim(), source: 'gemini' };
      }
    } catch (err) {
      console.error('Gemini failed:', err);
    }
  }

  return { chinese: '', source: 'manual' };
}
