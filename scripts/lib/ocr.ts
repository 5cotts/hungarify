/**
 * Tesseract OCR for rendered PDF page images (PNG buffers).
 */
import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

export async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('hun+eng');
  }
  return workerPromise;
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise;
  await w.terminate();
  workerPromise = null;
}

export async function ocrPngBuffer(buf: Buffer): Promise<{ text: string; confidence: number }> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(buf);
  const text = typeof data.text === 'string' ? data.text : '';
  const confidence = typeof data.confidence === 'number' ? data.confidence : 0;
  return { text, confidence };
}
