import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class OcrService {
  async extractFromReceipt(base64Image: string, mimeType: string) {
    const apiKey =
      process.env.GOOGLE_AI_API_KEY ??
      process.env.GOOGLE_AI_STUDIO_API_KEY ??
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        error: 'Missing Google AI Studio API key',
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model:
        process.env.GOOGLE_AI_MODEL ??
        process.env.GOOGLE_AI_STUDIO_MODEL ??
        'gemini-1.5-flash',
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
      {
        text: 'Extract from this receipt: amount (number only, no currency symbol), currency (ISO 3-letter code), date (YYYY-MM-DD), vendor name, category (one of: Travel Food Accommodation Equipment Other). Return ONLY valid JSON, no explanation, no markdown: {"amount":0,"currency":"USD","date":"2024-01-01","vendor":"name","category":"Travel"}',
      },
    ]);

    const text = result.response.text();

    try {
      return JSON.parse(this.stripMarkdownCodeFence(text));
    } catch {
      return { error: 'Could not parse receipt', raw: text };
    }
  }

  private stripMarkdownCodeFence(content: string): string {
    const trimmed = content.trim();

    if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
      return trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/, '')
        .trim();
    }

    return trimmed;
  }
}