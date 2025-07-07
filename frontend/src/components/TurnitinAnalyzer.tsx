import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

interface Document {
  id: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  content: string;
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
  sourceType?: 'document' | 'web' | 'academic';
  sourceTitle?: string;
  sourceId?: string;
  sourceUrl?: string;
  isCited?: boolean;
}

interface AnalysisResult {
  overallSimilarity: number;
  matches: SimilarityMatch[];
  sourceBreakdown: {
    document: number;
    web: number;
    academic: number;
  };
  statistics: {
    totalMatches: number;
    averageMatchLength: number;
    longestMatch: number;
    algorithmsUsed: string[];
    citedMatches: number;
    uncitedMatches: number;
  };
  processedDocuments: number;
  webSourcesChecked: number;
}

const TurnitinAnalyzer: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [options, setOptions] = useState({
    excludeCitations: false,
    includeWebSearch: true,
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

  const analyzeDocument = async () => {
    if (!selectedDocument) {
      alert('Please select a document to analyze.');
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/plagiarism/analyze`, {
        documentId: selectedDocument,
        ...options
      });

      if (response.data.success) {
        setResult(response.data.data);
      }
    } catch (error) {
      console.error('Error analyzing document:', error);
      alert('Failed to analyze document. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 70) return '#e74c3c';
    if (similarity >= 40) return '#f39c12';
    if (similarity >= 20) return '#f1c40f';
    return '#27ae60';
  };

  const getSimilarityLevel = (similarity: number) => {
    if (similarity >= 70) return 'High Risk';
    if (similarity >= 40) return 'Medium Risk';
    if (similarity >= 20) return 'Low Risk';
    return 'Minimal Risk';
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'document': return '📄';
      case 'web': return '🌐';
      case 'academic': return '🎓';
      default: return '📋';
    }
  };

  return (
    <div className="turnitin-analyzer">
      <div className="analyzer-header">
        <h2>🔍 Document Analysis</h2>
        <p>Analyze your document against our database and web sources (Turnitin-style)</p>
      </div>

      <div className="document-selection">
        <div className="selection-section">
          <label>📄 Select Document to Analyze:</label>
          <select 
            value={selectedDocument} 
            onChange={(e) => setSelectedDocument(e.target.value)}
            disabled={analyzing}
            className="document-select"
          >
            <option value="">Choose a document...</option>
            {documents.map(doc => (
              <option key={doc.id} value={doc.id}>
                {doc.originalName}
              </option>
            ))}
          </select>
        </div>

        <div className="analysis-options">
          <h3>🔧 Analysis Options</h3>
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
          onClick={analyzeDocument}
          disabled={!selectedDocument || analyzing}
          className="analyze-btn"
        >
          {analyzing ? (
            <>
              <div className="spinner small"></div>
              Analyzing Document...
            </>
          ) : (
            '🚀 Analyze Document'
          )}
        </button>
      </div>

      {result && (
        <div className="analysis-results">
          <div className="results-header">
            <h3>📊 Analysis Results</h3>
            <div className="overall-similarity">
              <div className="similarity-circle">
                <div
                  className="similarity-fill"
                  style={{
                    background: `conic-gradient(${getSimilarityColor(result.overallSimilarity)} ${result.overallSimilarity * 3.6}deg, #f0f0f0 0deg)`
                  }}
                >
                  <div className="similarity-inner">
                    <span className="similarity-percentage">{result.overallSimilarity.toFixed(1)}%</span>
                    <span className="similarity-label">Similarity</span>
                  </div>
                </div>
              </div>
              <div className="similarity-info">
                <div
                  className="similarity-level"
                  style={{ color: getSimilarityColor(result.overallSimilarity) }}
                >
                  {getSimilarityLevel(result.overallSimilarity)}
                </div>
              </div>
            </div>
          </div>

          <div className="source-breakdown">
            <h4>📈 Source Breakdown</h4>
            <div className="breakdown-grid">
              <div className="breakdown-item">
                <span className="breakdown-icon">📄</span>
                <span className="breakdown-label">Documents</span>
                <span className="breakdown-value">{result.sourceBreakdown.document.toFixed(1)}%</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-icon">🌐</span>
                <span className="breakdown-label">Web Sources</span>
                <span className="breakdown-value">{result.sourceBreakdown.web.toFixed(1)}%</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-icon">🎓</span>
                <span className="breakdown-label">Academic</span>
                <span className="breakdown-value">{result.sourceBreakdown.academic.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="analysis-stats">
            <h4>📋 Analysis Statistics</h4>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Matches:</span>
                <span className="stat-value">{result.statistics.totalMatches}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Documents Checked:</span>
                <span className="stat-value">{result.processedDocuments}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Web Sources Checked:</span>
                <span className="stat-value">{result.webSourcesChecked}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Cited Matches:</span>
                <span className="stat-value">{result.statistics.citedMatches}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Uncited Matches:</span>
                <span className="stat-value">{result.statistics.uncitedMatches}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Longest Match:</span>
                <span className="stat-value">{result.statistics.longestMatch} chars</span>
              </div>
            </div>
          </div>

          <div className="matches-section">
            <h4>🔍 Similarity Matches ({result.matches.length})</h4>
            {result.matches.length === 0 ? (
              <div className="no-matches">
                <p>✅ No significant similarities found!</p>
              </div>
            ) : (
              <div className="matches-list">
                {result.matches.slice(0, 10).map((match, index) => (
                  <div key={index} className={`match-item ${match.isCited ? 'cited' : 'uncited'}`}>
                    <div className="match-header">
                      <div className="match-info">
                        <span className="match-similarity">{match.similarity.toFixed(1)}%</span>
                        <span className="match-source">
                          {getSourceIcon(match.sourceType || 'document')}
                          {match.sourceTitle || 'Unknown Source'}
                        </span>
                        {match.isCited && <span className="cited-badge">✓ Cited</span>}
                      </div>
                      <div className="match-algorithm">{match.algorithm}</div>
                    </div>
                    <div className="match-content">
                      <div className="matched-text">
                        <strong>Your text:</strong> "{match.matchedText}"
                      </div>
                      <div className="source-text">
                        <strong>Source text:</strong> "{match.sourceText}"
                      </div>
                      {match.sourceUrl && (
                        <div className="source-link">
                          <a href={match.sourceUrl} target="_blank" rel="noopener noreferrer">
                            🔗 View Source
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {result.matches.length > 10 && (
                  <div className="more-matches">
                    <p>... and {result.matches.length - 10} more matches</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TurnitinAnalyzer;
