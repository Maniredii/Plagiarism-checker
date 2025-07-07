import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract text content from various file types
 */
export async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  try {
    switch (mimeType) {
      case 'text/plain':
        return await extractTextFromTxt(filePath);
      
      case 'application/pdf':
        return await extractTextFromPdf(filePath);
      
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractTextFromDocx(filePath);
      
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error(`Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from TXT files
 */
async function extractTextFromTxt(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('utf-8');
}

/**
 * Extract text from PDF files
 */
async function extractTextFromPdf(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Extract text from DOC/DOCX files
 */
async function extractTextFromDocx(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Clean and normalize extracted text
 */
export function preprocessText(text: string): string {
  return text
    // Remove extra whitespace and normalize line breaks
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    // Remove special characters but keep basic punctuation
    .replace(/[^\w\s.,!?;:()\-'"]/g, '')
    // Convert to lowercase for comparison
    .toLowerCase()
    // Trim whitespace
    .trim();
}

/**
 * Split text into sentences for better analysis
 */
export function splitIntoSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 10); // Filter out very short sentences
}

/**
 * Split text into words
 */
export function splitIntoWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map(word => word.replace(/[^\w]/g, '').toLowerCase())
    .filter(word => word.length > 2); // Filter out very short words
}

/**
 * Get text statistics
 */
export function getTextStatistics(text: string) {
  const words = splitIntoWords(text);
  const sentences = splitIntoSentences(text);
  
  return {
    characterCount: text.length,
    wordCount: words.length,
    sentenceCount: sentences.length,
    averageWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
    uniqueWords: new Set(words).size
  };
}
