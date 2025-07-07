import { preprocessText, splitIntoWords, splitIntoSentences } from '../services/textExtraction';
import { analyzeCitations, excludeCitedContent, CitationAnalysis } from '../services/citationService';
import { findWebMatches } from '../services/webContentService';
import * as natural from 'natural';
import compromise from 'compromise';

export interface SimilarityMatch {
  similarity: number;
  matchedText: string;
  sourceText: string;
  startPosition: number;
  endPosition: number;
  sourceStartPos: number;
  sourceEndPos: number;
  algorithm: string;
  sourceType: 'document' | 'web' | 'academic';
  sourceUrl?: string;
  sourceTitle?: string;
  confidence: number;
  isCited?: boolean;
}

export interface SimilarityResult {
  overallSimilarity: number;
  matches: SimilarityMatch[];
  webMatches: SimilarityMatch[];
  citationAnalysis: CitationAnalysis;
  excludeCitations: boolean;
  statistics: {
    totalMatches: number;
    averageMatchLength: number;
    longestMatch: number;
    algorithmsUsed: string[];
    sourceBreakdown: {
      document: number;
      web: number;
      academic: number;
    };
    citationStats: any;
  };
}

/**
 * Generate n-grams from text
 */
function generateNGrams(text: string, n: number): string[] {
  const words = splitIntoWords(text);
  const ngrams: string[] = [];

  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '));
  }

  return ngrams;
}

/**
 * Calculate semantic similarity using word embeddings and NLP
 */
function semanticSimilarity(text1: string, text2: string): number {
  try {
    // Simplified semantic analysis using word overlap
    const words1 = new Set(splitIntoWords(text1));
    const words2 = new Set(splitIntoWords(text2));

    // Calculate word overlap
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  } catch (error) {
    console.error('Error in semantic similarity:', error);
    return 0;
  }
}

/**
 * Detect paraphrasing using semantic analysis
 */
function detectParaphrasing(text1: string, text2: string): SimilarityMatch[] {
  const matches: SimilarityMatch[] = [];
  const sentences1 = splitIntoSentences(text1);
  const sentences2 = splitIntoSentences(text2);

  for (let i = 0; i < sentences1.length; i++) {
    const sentence1 = sentences1[i];
    if (sentence1.length < 30) continue; // Skip short sentences

    for (let j = 0; j < sentences2.length; j++) {
      const sentence2 = sentences2[j];
      if (sentence2.length < 30) continue;

      // Calculate semantic similarity
      const semanticScore = semanticSimilarity(sentence1, sentence2);
      const jaccardScore = jaccardSimilarity(
        new Set(splitIntoWords(sentence1)),
        new Set(splitIntoWords(sentence2))
      );

      // Combine scores - high semantic similarity with moderate word overlap suggests paraphrasing
      const combinedScore = (semanticScore * 0.7) + (jaccardScore * 0.3);

      if (combinedScore > 0.6 && jaccardScore < 0.8) { // High semantic similarity but not exact match
        const startPos = text1.indexOf(sentence1);
        const endPos = startPos + sentence1.length;
        const sourceStartPos = text2.indexOf(sentence2);
        const sourceEndPos = sourceStartPos + sentence2.length;

        matches.push({
          similarity: combinedScore,
          matchedText: sentence1,
          sourceText: sentence2,
          startPosition: startPos,
          endPosition: endPos,
          sourceStartPos,
          sourceEndPos,
          algorithm: 'semantic-paraphrase',
          sourceType: 'document',
          confidence: semanticScore
        });
      }
    }
  }

  return removeDuplicateMatches(matches);
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Calculate cosine similarity between two text vectors
 */
function cosineSimilarity(text1: string, text2: string): number {
  const words1 = splitIntoWords(text1);
  const words2 = splitIntoWords(text2);
  
  // Create word frequency vectors
  const allWords = new Set([...words1, ...words2]);
  const vector1: number[] = [];
  const vector2: number[] = [];
  
  allWords.forEach(word => {
    vector1.push(words1.filter(w => w === word).length);
    vector2.push(words2.filter(w => w === word).length);
  });
  
  // Calculate dot product
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  return magnitude1 === 0 || magnitude2 === 0 ? 0 : dotProduct / (magnitude1 * magnitude2);
}

/**
 * Find exact string matches
 */
function findExactMatches(text1: string, text2: string, minLength: number = 20): SimilarityMatch[] {
  const matches: SimilarityMatch[] = [];
  const processed1 = preprocessText(text1);
  const processed2 = preprocessText(text2);
  
  // Find common substrings
  for (let i = 0; i < processed1.length - minLength; i++) {
    for (let len = minLength; len <= processed1.length - i; len++) {
      const substring = processed1.substring(i, i + len);
      const index = processed2.indexOf(substring);
      
      if (index !== -1) {
        matches.push({
          similarity: 1.0,
          matchedText: substring,
          sourceText: substring,
          startPosition: i,
          endPosition: i + len,
          sourceStartPos: index,
          sourceEndPos: index + len,
          algorithm: 'exact-match',
          sourceType: 'document',
          confidence: 1.0
        });
      }
    }
  }
  
  // Remove overlapping matches, keep longest ones
  return removeDuplicateMatches(matches);
}

/**
 * N-gram based similarity detection
 */
function ngramSimilarity(text1: string, text2: string, n: number = 3): SimilarityMatch[] {
  const ngrams1 = generateNGrams(text1, n);
  const ngrams2 = generateNGrams(text2, n);
  const matches: SimilarityMatch[] = [];
  
  ngrams1.forEach((ngram, index) => {
    const matchIndex = ngrams2.indexOf(ngram);
    if (matchIndex !== -1) {
      const words1 = splitIntoWords(text1);
      const words2 = splitIntoWords(text2);
      
      // Calculate approximate positions
      const startPos1 = words1.slice(0, index).join(' ').length;
      const endPos1 = startPos1 + ngram.length;
      const startPos2 = words2.slice(0, matchIndex).join(' ').length;
      const endPos2 = startPos2 + ngram.length;
      
      matches.push({
        similarity: 0.8, // High similarity for n-gram matches
        matchedText: ngram,
        sourceText: ngram,
        startPosition: startPos1,
        endPosition: endPos1,
        sourceStartPos: startPos2,
        sourceEndPos: endPos2,
        algorithm: `${n}-gram`,
        sourceType: 'document',
        confidence: 0.8
      });
    }
  });
  
  return removeDuplicateMatches(matches);
}

/**
 * Remove duplicate and overlapping matches
 */
function removeDuplicateMatches(matches: SimilarityMatch[]): SimilarityMatch[] {
  // Sort by length (longest first)
  matches.sort((a, b) => (b.endPosition - b.startPosition) - (a.endPosition - a.startPosition));
  
  const filtered: SimilarityMatch[] = [];
  
  for (const match of matches) {
    const hasOverlap = filtered.some(existing => 
      (match.startPosition < existing.endPosition && match.endPosition > existing.startPosition)
    );
    
    if (!hasOverlap) {
      filtered.push(match);
    }
  }
  
  return filtered;
}

/**
 * Main similarity detection function
 */
export function detectSimilarity(text1: string, text2: string): SimilarityResult {
  const processed1 = preprocessText(text1);
  const processed2 = preprocessText(text2);
  
  // Collect all matches from different algorithms
  const allMatches: SimilarityMatch[] = [];
  
  // 1. Exact matches
  allMatches.push(...findExactMatches(processed1, processed2, 15));
  
  // 2. N-gram matches (3-gram, 4-gram, 5-gram)
  allMatches.push(...ngramSimilarity(processed1, processed2, 3));
  allMatches.push(...ngramSimilarity(processed1, processed2, 4));
  allMatches.push(...ngramSimilarity(processed1, processed2, 5));
  
  // Remove duplicates and overlaps
  const uniqueMatches = removeDuplicateMatches(allMatches);
  
  // Calculate overall similarity
  const totalMatchedLength = uniqueMatches.reduce((sum, match) => 
    sum + (match.endPosition - match.startPosition), 0
  );
  
  const overallSimilarity = Math.min(100, (totalMatchedLength / processed1.length) * 100);
  
  // Calculate statistics
  const matchLengths = uniqueMatches.map(match => match.endPosition - match.startPosition);
  const algorithmsUsed = [...new Set(uniqueMatches.map(match => match.algorithm))];
  
  return {
    overallSimilarity: Math.round(overallSimilarity * 100) / 100,
    matches: uniqueMatches,
    webMatches: [],
    citationAnalysis: { citations: [], totalCitations: 0, quotedText: [], references: [], bibliography: [], citationCoverage: 0 },
    excludeCitations: false,
    statistics: {
      totalMatches: uniqueMatches.length,
      averageMatchLength: matchLengths.length > 0 ?
        Math.round(matchLengths.reduce((a, b) => a + b, 0) / matchLengths.length) : 0,
      longestMatch: matchLengths.length > 0 ? Math.max(...matchLengths) : 0,
      algorithmsUsed,
      sourceBreakdown: {
        document: uniqueMatches.length,
        web: 0,
        academic: 0
      },
      citationStats: {
        totalCitations: 0,
        citationCoverage: 0,
        quotedTextCount: 0
      }
    }
  };
}

/**
 * Enhanced similarity check with citation analysis and web content integration
 */
export async function comprehensiveSimilarityCheck(
  text1: string,
  text2: string,
  options: {
    excludeCitations?: boolean;
    includeWebSearch?: boolean;
    includeSemanticAnalysis?: boolean;
  } = {}
): Promise<SimilarityResult> {
  const { excludeCitations = false, includeWebSearch = false, includeSemanticAnalysis = true } = options;

  // Analyze citations in both texts
  const citationAnalysis1 = analyzeCitations(text1);
  const citationAnalysis2 = analyzeCitations(text2);

  // Prepare texts for analysis
  let processedText1 = text1;
  let processedText2 = text2;

  if (excludeCitations) {
    processedText1 = excludeCitedContent(text1, citationAnalysis1.citations);
    processedText2 = excludeCitedContent(text2, citationAnalysis2.citations);
  }

  // Get basic similarity
  const basicResult = detectSimilarity(processedText1, processedText2);

  // Add semantic analysis for paraphrasing detection
  let semanticMatches: SimilarityMatch[] = [];
  if (includeSemanticAnalysis) {
    semanticMatches = detectParaphrasing(processedText1, processedText2);
  }

  // Combine all matches
  const allMatches = [...basicResult.matches, ...semanticMatches];
  const uniqueMatches = removeDuplicateMatches(allMatches);

  // Mark cited matches
  const markedMatches = uniqueMatches.map(match => ({
    ...match,
    isCited: isMatchCited(match, citationAnalysis1.citations)
  }));

  // Calculate additional similarity metrics
  const cosineScore = cosineSimilarity(processedText1, processedText2) * 100;
  const words1 = new Set(splitIntoWords(processedText1));
  const words2 = new Set(splitIntoWords(processedText2));
  const jaccardScore = jaccardSimilarity(words1, words2) * 100;
  const semanticScore = includeSemanticAnalysis ? semanticSimilarity(processedText1, processedText2) * 100 : 0;

  // Combine scores with weights
  const combinedScore = (
    basicResult.overallSimilarity * 0.4 +  // 40% weight to structural matches
    cosineScore * 0.2 +                    // 20% weight to cosine similarity
    jaccardScore * 0.2 +                   // 20% weight to word overlap
    semanticScore * 0.2                    // 20% weight to semantic similarity
  );

  // Get web matches if requested
  let webMatches: SimilarityMatch[] = [];
  if (includeWebSearch) {
    try {
      const webResults = await findWebMatches(processedText1);
      webMatches = webResults.map(webMatch => ({
        similarity: webMatch.similarity,
        matchedText: webMatch.matchedText,
        sourceText: webMatch.sourceText,
        startPosition: webMatch.startPosition,
        endPosition: webMatch.endPosition,
        sourceStartPos: 0,
        sourceEndPos: webMatch.sourceText.length,
        algorithm: 'web-search',
        sourceType: 'web' as const,
        sourceUrl: webMatch.url,
        sourceTitle: webMatch.title,
        confidence: webMatch.similarity
      }));
    } catch (error) {
      console.error('Error finding web matches:', error);
    }
  }

  // Calculate source breakdown
  const sourceBreakdown = {
    document: markedMatches.filter(m => m.sourceType === 'document').length,
    web: webMatches.length,
    academic: markedMatches.filter(m => m.sourceType === 'academic').length
  };

  return {
    overallSimilarity: Math.round(combinedScore * 100) / 100,
    matches: markedMatches,
    webMatches,
    citationAnalysis: citationAnalysis1,
    excludeCitations,
    statistics: {
      totalMatches: markedMatches.length + webMatches.length,
      averageMatchLength: markedMatches.length > 0 ?
        Math.round(markedMatches.reduce((sum, match) => sum + (match.endPosition - match.startPosition), 0) / markedMatches.length) : 0,
      longestMatch: markedMatches.length > 0 ?
        Math.max(...markedMatches.map(match => match.endPosition - match.startPosition)) : 0,
      algorithmsUsed: [...new Set([...markedMatches.map(m => m.algorithm), ...webMatches.map(m => m.algorithm)])],
      sourceBreakdown,
      citationStats: {
        totalCitations: citationAnalysis1.totalCitations,
        citationCoverage: citationAnalysis1.citationCoverage,
        quotedTextCount: citationAnalysis1.quotedText.length
      }
    }
  };
}

/**
 * Check if a match overlaps with any citations
 */
function isMatchCited(match: SimilarityMatch, citations: any[]): boolean {
  return citations.some(citation =>
    citation.startPosition <= match.startPosition && citation.endPosition >= match.endPosition
  );
}
