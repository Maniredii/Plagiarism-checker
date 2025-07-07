import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

interface Document {
  id: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

interface SimilarityMatch {
  similarity: number;
  matchedText: string;
  sourceText: string;
  startPosition: number;
  endPosition: number;
  sourceStartPos: number;
  sourceEndPos: number;
  algorithm: string;
}

interface SimilarityResult {
  overallSimilarity: number;
  matches: SimilarityMatch[];
  statistics: {
    totalMatches: number;
    averageMatchLength: number;
    longestMatch: number;
    algorithmsUsed: string[];
  };
}

interface ComparisonResult {
  id: string;
  document1: { id: string; name: string; statistics: any };
  document2: { id: string; name: string; statistics: any };
  similarityResult: SimilarityResult;
  createdAt: string;
}

const PlagiarismChecker: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc1, setSelectedDoc1] = useState<string>('');
  const [selectedDoc2, setSelectedDoc2] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [options, setOptions] = useState({
    excludeCitations: false,
    includeWebSearch: false,
    includeSemanticAnalysis: true
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/documents`);
      if (response.data.success) {
        setDocuments(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const checkPlagiarism = async () => {
    if (!selectedDoc1 || !selectedDoc2) {
      alert('Please select two documents to compare.');
      return;
    }

    if (selectedDoc1 === selectedDoc2) {
      alert('Please select two different documents.');
      return;
    }

    setChecking(true);
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/plagiarism/compare`, {
        document1Id: selectedDoc1,
        document2Id: selectedDoc2,
        ...options
      });

      if (response.data.success) {
        setResult(response.data.data);
      }
    } catch (error) {
      console.error('Error checking plagiarism:', error);
      alert('Failed to check plagiarism. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 70) return '#ff4444';
    if (similarity >= 40) return '#ff8800';
    if (similarity >= 20) return '#ffaa00';
    return '#44aa44';
  };

  const getSimilarityLevel = (similarity: number) => {
    if (similarity >= 70) return 'High Risk';
    if (similarity >= 40) return 'Medium Risk';
    if (similarity >= 20) return 'Low Risk';
    return 'Minimal Risk';
  };

  return (
    <div className="plagiarism-checker">
      <div className="checker-header">
        <h2>🔍 Plagiarism Checker</h2>
        <p>Compare two documents for similarity analysis</p>
      </div>

      <div className="document-selection">
        <div className="selection-row">
          <div className="document-selector">
            <label>📄 Document 1:</label>
            <select 
              value={selectedDoc1} 
              onChange={(e) => setSelectedDoc1(e.target.value)}
              disabled={checking}
            >
              <option value="">Select first document...</option>
              {documents.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.originalName}
                </option>
              ))}
            </select>
          </div>

          <div className="vs-indicator">VS</div>

          <div className="document-selector">
            <label>📄 Document 2:</label>
            <select 
              value={selectedDoc2} 
              onChange={(e) => setSelectedDoc2(e.target.value)}
              disabled={checking}
            >
              <option value="">Select second document...</option>
              {documents.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.originalName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="analysis-options">
          <h4>📋 Analysis Options</h4>
          <div className="options-grid">
            <label className="option-item">
              <input
                type="checkbox"
                checked={options.excludeCitations}
                onChange={(e) => setOptions(prev => ({ ...prev, excludeCitations: e.target.checked }))}
              />
              <span>Exclude properly cited content</span>
            </label>

            <label className="option-item">
              <input
                type="checkbox"
                checked={options.includeWebSearch}
                onChange={(e) => setOptions(prev => ({ ...prev, includeWebSearch: e.target.checked }))}
              />
              <span>Include web content search</span>
            </label>

            <label className="option-item">
              <input
                type="checkbox"
                checked={options.includeSemanticAnalysis}
                onChange={(e) => setOptions(prev => ({ ...prev, includeSemanticAnalysis: e.target.checked }))}
              />
              <span>Enable paraphrasing detection</span>
            </label>
          </div>
        </div>

        <button
          onClick={checkPlagiarism}
          disabled={!selectedDoc1 || !selectedDoc2 || checking}
          className="check-btn"
        >
          {checking ? (
            <>
              <div className="spinner small"></div>
              Analyzing...
            </>
          ) : (
            '🔍 Check Plagiarism'
          )}
        </button>
      </div>

      {result && (
        <div className="results-section">
          <div className="similarity-overview">
            <div className="similarity-score">
              <div 
                className="score-circle"
                style={{ borderColor: getSimilarityColor(result.similarityResult.overallSimilarity) }}
              >
                <span className="score-number">
                  {result.similarityResult.overallSimilarity.toFixed(1)}%
                </span>
                <span className="score-label">Similarity</span>
              </div>
              <div className="risk-level">
                <span 
                  className="risk-badge"
                  style={{ backgroundColor: getSimilarityColor(result.similarityResult.overallSimilarity) }}
                >
                  {getSimilarityLevel(result.similarityResult.overallSimilarity)}
                </span>
              </div>
            </div>

            <div className="comparison-stats">
              <div className="stat-item">
                <span className="stat-label">Total Matches:</span>
                <span className="stat-value">{result.similarityResult.statistics.totalMatches}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Document Matches:</span>
                <span className="stat-value">{result.similarityResult.statistics.sourceBreakdown?.document || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Web Matches:</span>
                <span className="stat-value">{result.similarityResult.statistics.sourceBreakdown?.web || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Citations Found:</span>
                <span className="stat-value">{result.similarityResult.statistics.citationStats?.totalCitations || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Match Length:</span>
                <span className="stat-value">{result.similarityResult.statistics.averageMatchLength} chars</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Algorithms Used:</span>
                <span className="stat-value">{result.similarityResult.statistics.algorithmsUsed.join(', ')}</span>
              </div>
            </div>
          </div>

          {result.similarityResult.matches.length > 0 && (
            <div className="matches-section">
              <h3>📋 Similarity Matches</h3>
              <div className="matches-list">
                {result.similarityResult.matches.slice(0, 10).map((match, index) => (
                  <div key={index} className="match-item">
                    <div className="match-header">
                      <span className="match-similarity">
                        {(match.similarity * 100).toFixed(1)}% match
                      </span>
                      <span className="match-algorithm">{match.algorithm}</span>
                    </div>
                    <div className="match-text">
                      <strong>Matched Text:</strong> "{match.matchedText.substring(0, 200)}
                      {match.matchedText.length > 200 ? '...' : ''}"
                    </div>
                  </div>
                ))}
              </div>
              
              {result.similarityResult.matches.length > 10 && (
                <p className="matches-note">
                  Showing top 10 matches out of {result.similarityResult.matches.length} total matches.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {documents.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No documents available</h3>
          <p>Upload at least two documents to perform plagiarism checking.</p>
        </div>
      )}
    </div>
  );
};

export default PlagiarismChecker;
