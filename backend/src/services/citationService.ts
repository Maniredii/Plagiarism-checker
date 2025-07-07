import { preprocessText } from './textExtraction';

export interface Citation {
  id: string;
  text: string;
  type: 'quote' | 'reference' | 'bibliography' | 'parenthetical';
  startPosition: number;
  endPosition: number;
  sourceInfo?: {
    author?: string;
    title?: string;
    year?: string;
    publication?: string;
    doi?: string;
    url?: string;
  };
}

export interface CitationAnalysis {
  citations: Citation[];
  totalCitations: number;
  quotedText: Citation[];
  references: Citation[];
  bibliography: Citation[];
  citationCoverage: number; // Percentage of text that is properly cited
}

/**
 * Detect and analyze citations in text
 */
export function analyzeCitations(text: string): CitationAnalysis {
  const citations: Citation[] = [];
  
  // Find different types of citations
  citations.push(...findQuotedText(text));
  citations.push(...findParentheticalCitations(text));
  citations.push(...findReferences(text));
  citations.push(...findBibliography(text));
  
  // Remove overlapping citations (keep the most specific one)
  const uniqueCitations = removeDuplicateCitations(citations);
  
  // Calculate citation coverage
  const totalCitedLength = uniqueCitations.reduce((sum, citation) => 
    sum + (citation.endPosition - citation.startPosition), 0
  );
  const citationCoverage = (totalCitedLength / text.length) * 100;
  
  return {
    citations: uniqueCitations,
    totalCitations: uniqueCitations.length,
    quotedText: uniqueCitations.filter(c => c.type === 'quote'),
    references: uniqueCitations.filter(c => c.type === 'reference'),
    bibliography: uniqueCitations.filter(c => c.type === 'bibliography'),
    citationCoverage: Math.round(citationCoverage * 100) / 100
  };
}

/**
 * Find quoted text (text within quotation marks)
 */
function findQuotedText(text: string): Citation[] {
  const citations: Citation[] = [];
  
  // Match text within double quotes
  const doubleQuoteRegex = /"([^"]{10,}?)"/g;
  let match;
  
  while ((match = doubleQuoteRegex.exec(text)) !== null) {
    citations.push({
      id: `quote-${citations.length}`,
      text: match[1],
      type: 'quote',
      startPosition: match.index,
      endPosition: match.index + match[0].length
    });
  }
  
  // Match text within single quotes (for longer passages)
  const singleQuoteRegex = /'([^']{20,}?)'/g;
  while ((match = singleQuoteRegex.exec(text)) !== null) {
    citations.push({
      id: `quote-${citations.length}`,
      text: match[1],
      type: 'quote',
      startPosition: match.index,
      endPosition: match.index + match[0].length
    });
  }
  
  return citations;
}

/**
 * Find parenthetical citations (Author, Year) or (Author Year)
 */
function findParentheticalCitations(text: string): Citation[] {
  const citations: Citation[] = [];
  
  // Match various citation formats
  const citationPatterns = [
    // (Author, Year)
    /\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(\d{4})\)/g,
    // (Author Year)
    /\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d{4})\)/g,
    // (Author et al., Year)
    /\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+et\s+al\.),\s*(\d{4})\)/g,
    // [Author, Year]
    /\[([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(\d{4})\]/g,
    // [1], [2], etc. (numbered citations)
    /\[(\d+)\]/g
  ];
  
  citationPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const sourceInfo: any = {};
      
      if (match[1] && match[2]) {
        sourceInfo.author = match[1];
        sourceInfo.year = match[2];
      }
      
      citations.push({
        id: `ref-${citations.length}`,
        text: match[0],
        type: 'parenthetical',
        startPosition: match.index,
        endPosition: match.index + match[0].length,
        sourceInfo
      });
    }
  });
  
  return citations;
}

/**
 * Find reference list entries
 */
function findReferences(text: string): Citation[] {
  const citations: Citation[] = [];
  
  // Look for reference section
  const refSectionRegex = /(?:references|bibliography|works\s+cited|sources)\s*:?\s*\n([\s\S]*?)(?:\n\n|\n[A-Z]|\n\d+\.|\n[IVX]+\.|\Z)/i;
  const refMatch = refSectionRegex.exec(text);
  
  if (refMatch) {
    const refSection = refMatch[1];
    const refStartPos = refMatch.index;
    
    // Split references by line breaks or numbered entries
    const refEntries = refSection.split(/\n(?=\d+\.|\[|\w+,)/).filter(entry => entry.trim().length > 20);
    
    let currentPos = refStartPos;
    refEntries.forEach((entry, index) => {
      const trimmedEntry = entry.trim();
      if (trimmedEntry.length > 20) {
        const sourceInfo = parseReferenceEntry(trimmedEntry);
        
        citations.push({
          id: `ref-${index}`,
          text: trimmedEntry,
          type: 'reference',
          startPosition: currentPos,
          endPosition: currentPos + trimmedEntry.length,
          sourceInfo
        });
        
        currentPos += entry.length + 1; // +1 for newline
      }
    });
  }
  
  return citations;
}

/**
 * Find bibliography section
 */
function findBibliography(text: string): Citation[] {
  const citations: Citation[] = [];
  
  // Look for bibliography section (similar to references but more formal)
  const bibSectionRegex = /bibliography\s*:?\s*\n([\s\S]*?)(?:\n\n|\n[A-Z]|\Z)/i;
  const bibMatch = bibSectionRegex.exec(text);
  
  if (bibMatch) {
    const bibSection = bibMatch[1];
    const bibStartPos = bibMatch.index;
    
    // Split bibliography entries
    const bibEntries = bibSection.split(/\n(?=\w+,)/).filter(entry => entry.trim().length > 20);
    
    let currentPos = bibStartPos;
    bibEntries.forEach((entry, index) => {
      const trimmedEntry = entry.trim();
      if (trimmedEntry.length > 20) {
        const sourceInfo = parseReferenceEntry(trimmedEntry);
        
        citations.push({
          id: `bib-${index}`,
          text: trimmedEntry,
          type: 'bibliography',
          startPosition: currentPos,
          endPosition: currentPos + trimmedEntry.length,
          sourceInfo
        });
        
        currentPos += entry.length + 1;
      }
    });
  }
  
  return citations;
}

/**
 * Parse a reference entry to extract source information
 */
function parseReferenceEntry(entry: string): any {
  const sourceInfo: any = {};
  
  // Try to extract author (usually at the beginning)
  const authorMatch = entry.match(/^([A-Z][a-z]+(?:,\s*[A-Z]\.?)*(?:\s+[A-Z][a-z]+)*)/);
  if (authorMatch) {
    sourceInfo.author = authorMatch[1];
  }
  
  // Try to extract year (4 digits in parentheses or standalone)
  const yearMatch = entry.match(/\((\d{4})\)|(\d{4})/);
  if (yearMatch) {
    sourceInfo.year = yearMatch[1] || yearMatch[2];
  }
  
  // Try to extract title (usually in quotes or italics)
  const titleMatch = entry.match(/"([^"]+)"|'([^']+)'|_([^_]+)_/);
  if (titleMatch) {
    sourceInfo.title = titleMatch[1] || titleMatch[2] || titleMatch[3];
  }
  
  // Try to extract DOI
  const doiMatch = entry.match(/doi:\s*([^\s,]+)/i);
  if (doiMatch) {
    sourceInfo.doi = doiMatch[1];
  }
  
  // Try to extract URL
  const urlMatch = entry.match(/https?:\/\/[^\s,)]+/);
  if (urlMatch) {
    sourceInfo.url = urlMatch[0];
  }
  
  return sourceInfo;
}

/**
 * Remove duplicate and overlapping citations
 */
function removeDuplicateCitations(citations: Citation[]): Citation[] {
  // Sort by position
  citations.sort((a, b) => a.startPosition - b.startPosition);
  
  const filtered: Citation[] = [];
  
  for (const citation of citations) {
    const hasOverlap = filtered.some(existing => 
      (citation.startPosition < existing.endPosition && citation.endPosition > existing.startPosition)
    );
    
    if (!hasOverlap) {
      filtered.push(citation);
    }
  }
  
  return filtered;
}

/**
 * Check if a text segment is properly cited
 */
export function isTextCited(text: string, startPos: number, endPos: number, citations: Citation[]): boolean {
  return citations.some(citation => 
    citation.startPosition <= startPos && citation.endPosition >= endPos
  );
}

/**
 * Filter out cited content from similarity analysis
 */
export function excludeCitedContent(text: string, citations: Citation[]): string {
  let filteredText = text;
  
  // Sort citations by position (reverse order to maintain positions)
  const sortedCitations = citations.sort((a, b) => b.startPosition - a.startPosition);
  
  // Remove cited content
  for (const citation of sortedCitations) {
    filteredText = filteredText.substring(0, citation.startPosition) + 
                  ' '.repeat(citation.endPosition - citation.startPosition) + 
                  filteredText.substring(citation.endPosition);
  }
  
  return filteredText;
}

/**
 * Get citation statistics
 */
export function getCitationStatistics(analysis: CitationAnalysis): any {
  return {
    totalCitations: analysis.totalCitations,
    quotedTextCount: analysis.quotedText.length,
    parentheticalCitations: analysis.citations.filter(c => c.type === 'parenthetical').length,
    referenceCount: analysis.references.length,
    bibliographyCount: analysis.bibliography.length,
    citationCoverage: analysis.citationCoverage,
    averageCitationLength: analysis.citations.length > 0 ? 
      Math.round(analysis.citations.reduce((sum, c) => sum + (c.endPosition - c.startPosition), 0) / analysis.citations.length) : 0
  };
}
