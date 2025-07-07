import express from 'express';
import { documents } from './documents-simple';
import { comprehensiveSimilarityCheck, SimilarityResult } from '../algorithms/similarity';
import { getTextStatistics } from '../services/textExtraction';
import { createError } from '../middleware/errorHandler';
import { findWebMatches } from '../services/webContentService';
import { analyzeCitations } from '../services/citationService';
import {
  getAllDocuments as getDbDocuments,
  saveSimilarityReport,
  saveSimilarityMatch,
  getAllReports,
  getReportById,
  getMatchesByReportId
} from '../services/database';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = express.Router();

interface PlagiarismReport {
  id: string;
  document1: {
    id: string;
    name: string;
    statistics: any;
  };
  document2: {
    id: string;
    name: string;
    statistics: any;
  };
  similarityResult: SimilarityResult;
  createdAt: Date;
}

// In-memory storage for reports
const reports: Map<string, PlagiarismReport> = new Map();

// Turnitin-style analysis: analyze one document against everything
router.post('/analyze', async (req, res, next) => {
  try {
    const {
      documentId,
      excludeCitations = false,
      includeWebSearch = true,
      includeSemanticAnalysis = true
    } = req.body;

    if (!documentId) {
      throw createError('Document ID is required', 400);
    }

    const targetDoc = documents.get(documentId);
    if (!targetDoc) {
      throw createError('Document not found', 404);
    }

    // Get all other documents for comparison
    const allDocuments = Array.from(documents.values()).filter(doc => doc.id !== documentId);

    const allMatches: any[] = [];
    const sourceBreakdown = {
      document: 0,
      web: 0,
      academic: 0
    };

    // Emit progress updates
    const emitProgress = (progress: number, status: string) => {
      if (global.io) {
        global.io.emit('analysis-progress', {
          documentId,
          progress,
          status,
          totalSources: allDocuments.length + (includeWebSearch ? 1 : 0)
        });
      }
    };

    emitProgress(10, 'Starting analysis...');

    // 1. Compare against all documents in database
    let processedDocs = 0;
    for (const doc of allDocuments) {
      try {
        const result = await comprehensiveSimilarityCheck(targetDoc.content, doc.content, {
          excludeCitations,
          includeWebSearch: false, // Don't do web search for each document
          includeSemanticAnalysis
        });

        // Add source information to matches
        const docMatches = result.matches.map(match => ({
          ...match,
          sourceType: 'document',
          sourceTitle: doc.originalName,
          sourceId: doc.id
        }));

        allMatches.push(...docMatches);
        sourceBreakdown.document += docMatches.length;

        processedDocs++;
        emitProgress(10 + (processedDocs / allDocuments.length) * 60, `Compared against ${doc.originalName}`);
      } catch (error) {
        console.error(`Error comparing against ${doc.originalName}:`, error);
      }
    }

    // 2. Compare against web content if enabled
    if (includeWebSearch) {
      emitProgress(75, 'Searching web content...');
      try {
        const webMatches = await findWebMatches(targetDoc.content, 10);
        const formattedWebMatches = webMatches.map(webMatch => ({
          similarity: webMatch.similarity,
          matchedText: webMatch.matchedText,
          sourceText: webMatch.sourceText,
          startPosition: webMatch.startPosition,
          endPosition: webMatch.endPosition,
          sourceStartPos: 0,
          sourceEndPos: webMatch.sourceText.length,
          algorithm: 'web-search',
          sourceType: 'web',
          sourceUrl: webMatch.url,
          sourceTitle: webMatch.title,
          confidence: webMatch.similarity
        }));

        allMatches.push(...formattedWebMatches);
        sourceBreakdown.web = formattedWebMatches.length;
        emitProgress(90, 'Web search completed');
      } catch (error) {
        console.error('Error in web search:', error);
        emitProgress(90, 'Web search failed, continuing...');
      }
    }

    // 3. Analyze citations
    emitProgress(95, 'Analyzing citations...');
    const citationAnalysis = analyzeCitations(targetDoc.content);

    // 4. Calculate overall similarity
    const totalMatchedLength = allMatches.reduce((sum, match) =>
      sum + (match.endPosition - match.startPosition), 0
    );
    const overallSimilarity = Math.min(100, (totalMatchedLength / targetDoc.content.length) * 100);

    // 5. Create comprehensive report
    const reportId = uuidv4();
    const report = {
      id: reportId,
      documentId: targetDoc.id,
      documentName: targetDoc.originalName,
      overallSimilarity: Math.round(overallSimilarity * 100) / 100,
      totalMatches: allMatches.length,
      sourceBreakdown,
      citationAnalysis,
      matches: allMatches.sort((a, b) => b.similarity - a.similarity).slice(0, 50), // Top 50 matches
      analysisOptions: {
        excludeCitations,
        includeWebSearch,
        includeSemanticAnalysis
      },
      createdAt: new Date()
    };

    // Save to database
    try {
      await saveSimilarityReport({
        id: reportId,
        document1Id: targetDoc.id,
        document2Id: null,
        overallSimilarity: report.overallSimilarity,
        algorithmScores: report.analysisOptions,
        reportType: 'turnitin_analysis'
      });

      // Save matches
      for (const match of allMatches.slice(0, 100)) { // Save top 100 matches
        await saveSimilarityMatch({
          id: uuidv4(),
          reportId,
          similarity: match.similarity,
          matchedText: match.matchedText,
          sourceText: match.sourceText,
          startPosition: match.startPosition,
          endPosition: match.endPosition,
          sourceStartPos: match.sourceStartPos || 0,
          sourceEndPos: match.sourceEndPos || match.sourceText.length,
          algorithm: match.algorithm,
          sourceType: match.sourceType,
          sourceUrl: match.sourceUrl,
          sourceTitle: match.sourceTitle,
          confidence: match.confidence || match.similarity
        });
      }
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
    }

    emitProgress(100, 'Analysis complete!');

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// Enhanced document comparison with advanced features (keep for manual comparison)
router.post('/compare', async (req, res, next) => {
  try {
    const {
      document1Id,
      document2Id,
      excludeCitations = false,
      includeWebSearch = false,
      includeSemanticAnalysis = true
    } = req.body;

    if (!document1Id || !document2Id) {
      throw createError('Both document IDs are required', 400);
    }

    if (document1Id === document2Id) {
      throw createError('Cannot compare a document with itself', 400);
    }

    const doc1 = documents.get(document1Id);
    const doc2 = documents.get(document2Id);

    if (!doc1 || !doc2) {
      throw createError('One or both documents not found', 404);
    }

    // Perform enhanced similarity analysis
    const similarityResult = await comprehensiveSimilarityCheck(doc1.content, doc2.content, {
      excludeCitations,
      includeWebSearch,
      includeSemanticAnalysis
    });

    // Get text statistics for both documents
    const doc1Stats = getTextStatistics(doc1.content);
    const doc2Stats = getTextStatistics(doc2.content);

    // Create report
    const reportId = uuidv4();
    const report: PlagiarismReport = {
      id: reportId,
      document1: {
        id: doc1.id,
        name: doc1.originalName,
        statistics: doc1Stats
      },
      document2: {
        id: doc2.id,
        name: doc2.originalName,
        statistics: doc2Stats
      },
      similarityResult,
      createdAt: new Date()
    };

    // Save to database
    try {
      await saveSimilarityReport({
        id: reportId,
        document1Id: doc1.id,
        document2Id: doc2.id,
        overallSimilarity: similarityResult.overallSimilarity,
        algorithmScores: {
          excludeCitations,
          includeWebSearch,
          includeSemanticAnalysis
        },
        reportType: 'document_comparison'
      });

      // Save individual matches
      for (const match of similarityResult.matches) {
        await saveSimilarityMatch({
          id: uuidv4(),
          reportId,
          similarity: match.similarity,
          matchedText: match.matchedText,
          sourceText: match.sourceText,
          startPosition: match.startPosition,
          endPosition: match.endPosition,
          sourceStartPos: match.sourceStartPos,
          sourceEndPos: match.sourceEndPos,
          algorithm: match.algorithm,
          sourceType: match.sourceType,
          sourceUrl: match.sourceUrl,
          sourceTitle: match.sourceTitle,
          confidence: match.confidence
        });
      }

      // Save web matches
      for (const webMatch of similarityResult.webMatches) {
        await saveSimilarityMatch({
          id: uuidv4(),
          reportId,
          similarity: webMatch.similarity,
          matchedText: webMatch.matchedText,
          sourceText: webMatch.sourceText,
          startPosition: webMatch.startPosition,
          endPosition: webMatch.endPosition,
          sourceStartPos: webMatch.sourceStartPos,
          sourceEndPos: webMatch.sourceEndPos,
          algorithm: webMatch.algorithm,
          sourceType: webMatch.sourceType,
          sourceUrl: webMatch.sourceUrl,
          sourceTitle: webMatch.sourceTitle,
          confidence: webMatch.confidence
        });
      }
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
      // Continue without database save
    }

    reports.set(reportId, report);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// Get all reports
router.get('/reports', (req, res) => {
  const reportList = Array.from(reports.values()).map(report => ({
    id: report.id,
    document1Name: report.document1.name,
    document2Name: report.document2.name,
    overallSimilarity: report.similarityResult.overallSimilarity,
    totalMatches: report.similarityResult.statistics.totalMatches,
    createdAt: report.createdAt
  }));

  res.json({
    success: true,
    data: reportList
  });
});

// Get specific report
router.get('/reports/:id', (req, res, next) => {
  try {
    const report = reports.get(req.params.id);
    
    if (!report) {
      throw createError('Report not found', 404);
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

// Quick similarity check (without saving report)
router.post('/quick-check', async (req, res, next) => {
  try {
    const { text1, text2 } = req.body;

    if (!text1 || !text2) {
      throw createError('Both text inputs are required', 400);
    }

    if (text1.trim().length < 10 || text2.trim().length < 10) {
      throw createError('Text inputs must be at least 10 characters long', 400);
    }

    // Perform similarity analysis
    const similarityResult = comprehensiveSimilarityCheck(text1, text2);

    // Get text statistics
    const text1Stats = getTextStatistics(text1);
    const text2Stats = getTextStatistics(text2);

    res.json({
      success: true,
      data: {
        text1Statistics: text1Stats,
        text2Statistics: text2Stats,
        similarityResult,
        timestamp: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Batch comparison - compare one document against all others
router.post('/batch-compare/:documentId', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const targetDoc = documents.get(documentId);

    if (!targetDoc) {
      throw createError('Target document not found', 404);
    }

    const comparisons: Array<{
      documentId: string;
      documentName: string;
      similarity: number;
      matchCount: number;
    }> = [];

    // Compare against all other documents
    for (const [id, doc] of documents) {
      if (id !== documentId) {
        const result = await comprehensiveSimilarityCheck(targetDoc.content, doc.content);
        comparisons.push({
          documentId: id,
          documentName: doc.originalName,
          similarity: result.overallSimilarity,
          matchCount: result.statistics.totalMatches
        });
      }
    }

    // Sort by similarity (highest first)
    comparisons.sort((a, b) => b.similarity - a.similarity);

    res.json({
      success: true,
      data: {
        targetDocument: {
          id: targetDoc.id,
          name: targetDoc.originalName
        },
        comparisons,
        totalDocumentsCompared: comparisons.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Batch processing - compare multiple documents
router.post('/batch-compare', async (req, res, next) => {
  try {
    const { documentIds, options = {} } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
      throw createError('At least 2 document IDs are required for batch comparison', 400);
    }

    const results = [];
    const totalComparisons = (documentIds.length * (documentIds.length - 1)) / 2;
    let completedComparisons = 0;

    // Emit progress updates via WebSocket if available
    const emitProgress = (progress: number) => {
      if (global.io) {
        global.io.emit('batch-progress', { progress, total: totalComparisons });
      }
    };

    for (let i = 0; i < documentIds.length; i++) {
      for (let j = i + 1; j < documentIds.length; j++) {
        const doc1 = documents.get(documentIds[i]);
        const doc2 = documents.get(documentIds[j]);

        if (doc1 && doc2) {
          try {
            const similarityResult = await comprehensiveSimilarityCheck(doc1.content, doc2.content, options);

            results.push({
              document1: { id: doc1.id, name: doc1.originalName },
              document2: { id: doc2.id, name: doc2.originalName },
              similarity: similarityResult.overallSimilarity,
              matchCount: similarityResult.statistics.totalMatches,
              riskLevel: getSimilarityRiskLevel(similarityResult.overallSimilarity)
            });
          } catch (error) {
            console.error(`Error comparing ${doc1.originalName} vs ${doc2.originalName}:`, error);
          }
        }

        completedComparisons++;
        emitProgress((completedComparisons / totalComparisons) * 100);
      }
    }

    // Sort by similarity (highest first)
    results.sort((a, b) => b.similarity - a.similarity);

    res.json({
      success: true,
      data: {
        totalComparisons,
        results,
        summary: {
          highRisk: results.filter(r => r.riskLevel === 'High Risk').length,
          mediumRisk: results.filter(r => r.riskLevel === 'Medium Risk').length,
          lowRisk: results.filter(r => r.riskLevel === 'Low Risk').length,
          averageSimilarity: results.length > 0 ?
            Math.round((results.reduce((sum, r) => sum + r.similarity, 0) / results.length) * 100) / 100 : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Enhanced reports with database integration
router.get('/reports', async (req, res, next) => {
  try {
    // Try to get reports from database first
    let dbReports = [];
    try {
      dbReports = await getAllReports();
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    // Combine with in-memory reports
    const memoryReports = Array.from(reports.values()).map(report => ({
      id: report.id,
      document1_name: report.document1.name,
      document2_name: report.document2.name,
      overall_similarity: report.similarityResult.overallSimilarity,
      created_at: report.createdAt.toISOString(),
      report_type: 'document_comparison'
    }));

    const allReports = [...dbReports, ...memoryReports];

    // Remove duplicates based on ID
    const uniqueReports = allReports.filter((report, index, self) =>
      index === self.findIndex(r => r.id === report.id)
    );

    res.json({
      success: true,
      data: uniqueReports.map(report => ({
        id: report.id,
        document1Name: report.document1_name,
        document2Name: report.document2_name,
        webSourceTitle: report.web_source_title,
        webSourceUrl: report.web_source_url,
        overallSimilarity: report.overall_similarity,
        reportType: report.report_type,
        createdAt: report.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Get detailed report with matches
router.get('/reports/:id/detailed', async (req, res, next) => {
  try {
    const reportId = req.params.id;

    // Try database first
    let report = null;
    let matches = [];

    try {
      report = await getReportById(reportId);
      if (report) {
        matches = await getMatchesByReportId(reportId);
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    // Fallback to memory
    if (!report) {
      const memoryReport = reports.get(reportId);
      if (memoryReport) {
        report = {
          id: memoryReport.id,
          document1_name: memoryReport.document1.name,
          document2_name: memoryReport.document2.name,
          overall_similarity: memoryReport.similarityResult.overallSimilarity,
          created_at: memoryReport.createdAt.toISOString()
        };
        matches = memoryReport.similarityResult.matches.map(match => ({
          similarity: match.similarity,
          matched_text: match.matchedText,
          source_text: match.sourceText,
          algorithm: match.algorithm,
          source_type: match.sourceType,
          source_url: match.sourceUrl,
          source_title: match.sourceTitle,
          confidence: match.confidence
        }));
      }
    }

    if (!report) {
      throw createError('Report not found', 404);
    }

    res.json({
      success: true,
      data: {
        report,
        matches: matches.slice(0, 50), // Limit to top 50 matches
        totalMatches: matches.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to determine risk level
function getSimilarityRiskLevel(similarity: number): string {
  if (similarity >= 70) return 'High Risk';
  if (similarity >= 40) return 'Medium Risk';
  if (similarity >= 20) return 'Low Risk';
  return 'Minimal Risk';
}

export default router;
