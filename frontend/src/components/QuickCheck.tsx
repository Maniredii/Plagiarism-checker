import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

interface QuickCheckResult {
  text1Statistics: any;
  text2Statistics: any;
  similarityResult: {
    overallSimilarity: number;
    matches: Array<{
      similarity: number;
      matchedText: string;
      algorithm: string;
    }>;
    statistics: {
      totalMatches: number;
      averageMatchLength: number;
      longestMatch: number;
      algorithmsUsed: string[];
    };
  };
  timestamp: string;
}

const QuickCheck: React.FC = () => {
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<QuickCheckResult | null>(null);

  const handleQuickCheck = async () => {
    if (!text1.trim() || !text2.trim()) {
      alert('Please enter text in both fields.');
      return;
    }

    if (text1.trim().length < 10 || text2.trim().length < 10) {
      alert('Each text must be at least 10 characters long.');
      return;
    }

    setChecking(true);
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/plagiarism/quick-check`, {
        text1: text1.trim(),
        text2: text2.trim()
      });

      if (response.data.success) {
        setResult(response.data.data);
      }
    } catch (error) {
      console.error('Error performing quick check:', error);
      alert('Failed to perform quick check. Please try again.');
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
    if (similarity >= 70) return 'High Similarity';
    if (similarity >= 40) return 'Medium Similarity';
    if (similarity >= 20) return 'Low Similarity';
    return 'Minimal Similarity';
  };

  const clearAll = () => {
    setText1('');
    setText2('');
    setResult(null);
  };

  const loadSampleTexts = () => {
    setText1(`Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals. Colloquially, the term "artificial intelligence" is often used to describe machines that mimic "cognitive" functions that humans associate with the human mind, such as "learning" and "problem solving".`);
    
    setText2(`Machine learning is a subset of artificial intelligence that focuses on the development of algorithms and statistical models that enable computer systems to improve their performance on a specific task through experience. AI is intelligence demonstrated by machines, as opposed to the natural intelligence shown by humans and animals. The field of AI is defined as the study of intelligent agents - devices that perceive their environment and take actions to maximize their chances of achieving their goals.`);
  };

  return (
    <div className="quick-check">
      <div className="quick-check-header">
        <h2>⚡ Quick Text Comparison</h2>
        <p>Instantly compare two pieces of text for similarity</p>
        <div className="header-actions">
          <button onClick={loadSampleTexts} className="sample-btn">
            📝 Load Sample Texts
          </button>
          <button onClick={clearAll} className="clear-btn">
            🗑️ Clear All
          </button>
        </div>
      </div>

      <div className="text-input-section">
        <div className="text-input-group">
          <div className="text-input">
            <label>📄 Text 1:</label>
            <textarea
              value={text1}
              onChange={(e) => setText1(e.target.value)}
              placeholder="Paste or type the first text here..."
              rows={8}
              disabled={checking}
            />
            <div className="text-stats">
              Characters: {text1.length} | Words: {text1.trim().split(/\s+/).filter(w => w).length}
            </div>
          </div>

          <div className="text-input">
            <label>📄 Text 2:</label>
            <textarea
              value={text2}
              onChange={(e) => setText2(e.target.value)}
              placeholder="Paste or type the second text here..."
              rows={8}
              disabled={checking}
            />
            <div className="text-stats">
              Characters: {text2.length} | Words: {text2.trim().split(/\s+/).filter(w => w).length}
            </div>
          </div>
        </div>

        <button 
          onClick={handleQuickCheck}
          disabled={!text1.trim() || !text2.trim() || checking}
          className="quick-check-btn"
        >
          {checking ? (
            <>
              <div className="spinner small"></div>
              Analyzing...
            </>
          ) : (
            '⚡ Quick Check'
          )}
        </button>
      </div>

      {result && (
        <div className="quick-results">
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
              <div className="similarity-level">
                <span 
                  className="level-badge"
                  style={{ backgroundColor: getSimilarityColor(result.similarityResult.overallSimilarity) }}
                >
                  {getSimilarityLevel(result.similarityResult.overallSimilarity)}
                </span>
              </div>
            </div>

            <div className="quick-stats">
              <div className="stat-grid">
                <div className="stat-item">
                  <span className="stat-label">Matches Found:</span>
                  <span className="stat-value">{result.similarityResult.statistics.totalMatches}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Avg Match Length:</span>
                  <span className="stat-value">{result.similarityResult.statistics.averageMatchLength}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Longest Match:</span>
                  <span className="stat-value">{result.similarityResult.statistics.longestMatch}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Algorithms:</span>
                  <span className="stat-value">{result.similarityResult.statistics.algorithmsUsed.join(', ')}</span>
                </div>
              </div>
            </div>
          </div>

          {result.similarityResult.matches.length > 0 && (
            <div className="matches-preview">
              <h3>🔍 Top Matches</h3>
              <div className="matches-list">
                {result.similarityResult.matches.slice(0, 5).map((match, index) => (
                  <div key={index} className="match-item">
                    <div className="match-header">
                      <span className="match-similarity">
                        {(match.similarity * 100).toFixed(1)}%
                      </span>
                      <span className="match-algorithm">{match.algorithm}</span>
                    </div>
                    <div className="match-text">
                      "{match.matchedText.substring(0, 150)}
                      {match.matchedText.length > 150 ? '...' : ''}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="analysis-timestamp">
            <small>Analysis completed at {new Date(result.timestamp).toLocaleString()}</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickCheck;
