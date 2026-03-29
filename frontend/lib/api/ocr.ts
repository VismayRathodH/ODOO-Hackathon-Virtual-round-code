import { apiClient } from "./client";

export interface OcrResult {
  amount?: number;
  currency?: string;
  date?: string;
  vendor?: string;
  category?: string;
  confidence?: number;
  error?: string;
  raw?: string;
}

export const ocrApi = {
  scanReceipt: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return apiClient<OcrResult>("/ocr/receipt", {
      method: "POST",
      body: formData,
    });
  },
};
