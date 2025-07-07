import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

interface Document {
  id: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

interface BatchResult {
  document1: { id: string; name: string };
  document2: { id: string; name: string };
  similarity: number;
  matchCount: number;
  riskLevel: string;
}

interface BatchSummary {
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  averageSimilarity: number;
}

const BatchProcessor: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);

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

  const handleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const selectAll = () => {
    setSelectedDocuments(documents.map(doc => doc.id));
  };

  const clearSelection = () => {
    setSelectedDocuments([]);
  };

  const startBatchProcessing = async () => {
    if (selectedDocuments.length < 2) {
      alert('Please select at least 2 documents for batch processing.');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResults([]);
    setSummary(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/plagiarism/batch-compare`, {
        documentIds: selectedDocuments,
        options: {
          excludeCitations: false,
          includeWebSearch: false,
          includeSemanticAnalysis: true
        }
      });

      if (response.data.success) {
        setResults(response.data.data.results);
        setSummary(response.data.data.summary);
        setProgress(100);
      }
    } catch (error) {
      console.error('Error in batch processing:', error);
      alert('Failed to process documents. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'High Risk': return '#ef4444';
      case 'Medium Risk': return '#f59e0b';
      case 'Low Risk': return '#10b981';
      default: return '#6b7280';
    }
  };

  const totalComparisons = selectedDocuments.length > 1 ? 
    (selectedDocuments.length * (selectedDocuments.length - 1)) / 2 : 0;

  return (
    <div className="batch-processor">
      <div className="batch-header">
        <h2>📊 Batch Processing</h2>
        <p>Compare multiple documents simultaneously to identify potential plagiarism patterns</p>
      </div>

      <div className="document-selection-section">
        <div className="selection-header">
          <h3>📋 Select Documents</h3>
          <div className="selection-controls">
            <button onClick={selectAll} className="btn-secondary">
              ✅ Select All ({documents.length})
            </button>
            <button onClick={clearSelection} className="btn-secondary">
              ❌ Clear Selection
            </button>
          </div>
        </div>

        <div className="documents-grid">
          {documents.map(doc => (
            <div 
              key={doc.id} 
              className={`document-item ${selectedDocuments.includes(doc.id) ? 'selected' : ''}`}
              onClick={() => handleDocumentSelection(doc.id)}
            >
              <div className="document-checkbox">
                <input 
                  type="checkbox" 
                  checked={selectedDocuments.includes(doc.id)}
                  onChange={() => handleDocumentSelection(doc.id)}
                />
              </div>
              <div className="document-info">
                <div className="document-name">{doc.originalName}</div>
                <div className="document-meta">
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedDocuments.length > 0 && (
          <div className="selection-summary">
            <p>
              <strong>{selectedDocuments.length}</strong> documents selected • 
              <strong> {totalComparisons}</strong> comparisons will be performed
            </p>
          </div>
        )}
      </div>

      <div className="batch-controls">
        <button 
          onClick={startBatchProcessing}
          disabled={selectedDocuments.length < 2 || processing}
          className="batch-process-btn"
        >
          {processing ? (
            <>
              <div className="spinner small"></div>
              Processing... ({Math.round(progress)}%)
            </>
          ) : (
            `🚀 Start Batch Processing (${totalComparisons} comparisons)`
          )}
        </button>
      </div>

      {processing && (
        <div className="progress-section">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p>Processing comparisons... {Math.round(progress)}% complete</p>
        </div>
      )}

      {summary && (
        <div className="batch-summary">
          <h3>📈 Batch Summary</h3>
          <div className="summary-stats">
            <div className="summary-stat">
              <div className="stat-value" style={{ color: '#ef4444' }}>
                {summary.highRisk}
              </div>
              <div className="stat-label">High Risk</div>
            </div>
            <div className="summary-stat">
              <div className="stat-value" style={{ color: '#f59e0b' }}>
                {summary.mediumRisk}
              </div>
              <div className="stat-label">Medium Risk</div>
            </div>
            <div className="summary-stat">
              <div className="stat-value" style={{ color: '#10b981' }}>
                {summary.lowRisk}
              </div>
              <div className="stat-label">Low Risk</div>
            </div>
            <div className="summary-stat">
              <div className="stat-value">
                {summary.averageSimilarity}%
              </div>
              <div className="stat-label">Avg Similarity</div>
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="batch-results">
          <h3>🔍 Comparison Results</h3>
          <div className="results-list">
            {results.map((result, index) => (
              <div key={index} className="result-item">
                <div className="result-header">
                  <div className="document-pair">
                    <span className="doc-name">{result.document1.name}</span>
                    <span className="vs">vs</span>
                    <span className="doc-name">{result.document2.name}</span>
                  </div>
                  <div 
                    className="risk-badge"
                    style={{ backgroundColor: getRiskColor(result.riskLevel) }}
                  >
                    {result.riskLevel}
                  </div>
                </div>
                
                <div className="result-stats">
                  <div className="similarity-bar">
                    <div 
                      className="similarity-fill"
                      style={{ 
                        width: `${result.similarity}%`,
                        backgroundColor: getRiskColor(result.riskLevel)
                      }}
                    ></div>
                  </div>
                  <div className="result-details">
                    <span>{result.similarity.toFixed(1)}% similarity</span>
                    <span>{result.matchCount} matches</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No documents available</h3>
          <p>Upload documents first to use batch processing.</p>
        </div>
      )}
    </div>
  );
};

export default BatchProcessor;
