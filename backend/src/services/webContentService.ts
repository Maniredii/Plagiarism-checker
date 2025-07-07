import axios from 'axios';
import * as cheerio from 'cheerio';
import { google } from 'googleapis';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { saveWebSource, getWebSourceByUrl } from './database';
import { preprocessText, splitIntoSentences } from './textExtraction';

const customsearch = google.customsearch('v1');

interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
  content?: string;
}

interface WebMatch {
  url: string;
  title: string;
  matchedText: string;
  sourceText: string;
  similarity: number;
  startPosition: number;
  endPosition: number;
}

/**
 * Search for content using Google Custom Search API
 */
export async function searchWebContent(query: string, maxResults: number = 10): Promise<WebSearchResult[]> {
  try {
    // If no API key is configured, return empty results
    if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
      console.log('⚠️ Google Search API not configured, skipping web search');
      return [];
    }

    const response = await customsearch.cse.list({
      auth: process.env.GOOGLE_SEARCH_API_KEY,
      cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
      q: query,
      num: Math.min(maxResults, 10), // Google API limit
      fields: 'items(title,link,snippet)'
    });

    if (!response.data.items) {
      return [];
    }

    return response.data.items.map(item => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || ''
    }));
  } catch (error) {
    console.error('Error searching web content:', error);
    return [];
  }
}

/**
 * Scrape content from a web page
 */
export async function scrapeWebPage(url: string): Promise<string> {
  try {
    // Check if we already have this content cached
    const cachedSource = await getWebSourceByUrl(url);
    if (cachedSource && cachedSource.content) {
      return cachedSource.content;
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script, style, nav, header, footer, aside').remove();
    
    // Extract main content
    let content = '';
    
    // Try to find main content areas
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '#content',
      '.container'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }
    
    // Fallback to body if no specific content area found
    if (!content) {
      content = $('body').text();
    }
    
    // Clean up the content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    // Cache the scraped content
    if (content.length > 100) { // Only cache if we got substantial content
      const contentHash = crypto.createHash('md5').update(content).digest('hex');
      const webSource = {
        id: uuidv4(),
        url,
        title: $('title').text() || url,
        content,
        contentHash,
        sourceType: 'web'
      };
      
      await saveWebSource(webSource);
    }
    
    return content;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return '';
  }
}

/**
 * Search for potential plagiarism sources on the web
 */
export async function findWebMatches(text: string, maxSources: number = 5): Promise<WebMatch[]> {
  const matches: WebMatch[] = [];
  
  try {
    // Extract key phrases from the text for searching
    const sentences = splitIntoSentences(text);
    const searchQueries = sentences
      .filter(sentence => sentence.length > 50 && sentence.length < 200)
      .slice(0, 3) // Limit to 3 queries to avoid API limits
      .map(sentence => `"${sentence.substring(0, 100)}"`); // Use exact phrase search
    
    for (const query of searchQueries) {
      const searchResults = await searchWebContent(query, maxSources);
      
      for (const result of searchResults) {
        try {
          const webContent = await scrapeWebPage(result.link);
          
          if (webContent.length > 100) {
            // Find matches between the input text and web content
            const webMatches = findTextMatches(text, webContent, result.title, result.link);
            matches.push(...webMatches);
          }
        } catch (error) {
          console.error(`Error processing ${result.link}:`, error);
        }
      }
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error finding web matches:', error);
  }
  
  return matches;
}

/**
 * Find text matches between input text and web content
 */
function findTextMatches(inputText: string, webContent: string, title: string, url: string): WebMatch[] {
  const matches: WebMatch[] = [];
  const processedInput = preprocessText(inputText);
  const processedWeb = preprocessText(webContent);
  
  // Find exact phrase matches (minimum 20 characters)
  const minMatchLength = 20;
  
  for (let i = 0; i < processedInput.length - minMatchLength; i++) {
    for (let len = minMatchLength; len <= Math.min(200, processedInput.length - i); len++) {
      const phrase = processedInput.substring(i, i + len);
      const webIndex = processedWeb.indexOf(phrase);
      
      if (webIndex !== -1) {
        // Calculate similarity score based on match length
        const similarity = Math.min(1.0, len / 100);
        
        matches.push({
          url,
          title,
          matchedText: phrase,
          sourceText: phrase,
          similarity,
          startPosition: i,
          endPosition: i + len
        });
        
        // Skip ahead to avoid overlapping matches
        i += len - 1;
        break;
      }
    }
  }
  
  // Remove duplicate and overlapping matches
  return removeDuplicateWebMatches(matches);
}

/**
 * Remove duplicate and overlapping web matches
 */
function removeDuplicateWebMatches(matches: WebMatch[]): WebMatch[] {
  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity);
  
  const filtered: WebMatch[] = [];
  
  for (const match of matches) {
    const hasOverlap = filtered.some(existing => 
      (match.startPosition < existing.endPosition && match.endPosition > existing.startPosition)
    );
    
    if (!hasOverlap) {
      filtered.push(match);
    }
  }
  
  return filtered.slice(0, 10); // Limit to top 10 matches
}

/**
 * Check if a URL is accessible and safe to scrape
 */
export async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Extract key phrases from text for web searching
 */
export function extractKeyPhrases(text: string, maxPhrases: number = 5): string[] {
  const sentences = splitIntoSentences(text);
  const phrases: string[] = [];
  
  for (const sentence of sentences) {
    if (sentence.length > 30 && sentence.length < 150) {
      // Remove common words and extract meaningful phrases
      const cleanSentence = sentence
        .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/gi, '')
        .trim();
      
      if (cleanSentence.length > 20) {
        phrases.push(cleanSentence);
      }
    }
  }
  
  return phrases.slice(0, maxPhrases);
}
