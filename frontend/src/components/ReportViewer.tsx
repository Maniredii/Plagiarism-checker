import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

interface ReportSummary {
  id: string;
  document1Name: string;
  document2Name: string;
  overallSimilarity: number;
  totalMatches: number;
  createdAt: string;
}

const ReportViewer: React.FC = () => {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/plagiarism/reports`);
      if (response.data.success) {
        setReports(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="report-viewer">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-viewer">
      <div className="reports-header">
        <h2>📊 Plagiarism Reports</h2>
        <p>View and manage your plagiarism analysis reports</p>
        <button onClick={fetchReports} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No reports generated yet</h3>
          <p>Run plagiarism checks to generate reports that will appear here.</p>
        </div>
      ) : (
        <div className="reports-grid">
          {reports.map((report) => (
            <div key={report.id} className="report-card">
              <div className="report-header">
                <div className="report-title">
                  <h4>📄 {report.document1Name}</h4>
                  <span className="vs-text">vs</span>
                  <h4>📄 {report.document2Name}</h4>
                </div>
                <div className="report-date">
                  {new Date(report.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="report-summary">
                <div className="similarity-indicator">
                  <div 
                    className="similarity-bar"
                    style={{ 
                      width: `${report.overallSimilarity}%`,
                      backgroundColor: getSimilarityColor(report.overallSimilarity)
                    }}
                  ></div>
                  <div className="similarity-text">
                    <span className="similarity-percentage">
                      {report.overallSimilarity.toFixed(1)}%
                    </span>
                    <span 
                      className="similarity-level"
                      style={{ color: getSimilarityColor(report.overallSimilarity) }}
                    >
                      {getSimilarityLevel(report.overallSimilarity)}
                    </span>
                  </div>
                </div>

                <div className="report-stats">
                  <div className="stat">
                    <span className="stat-label">Matches:</span>
                    <span className="stat-value">{report.totalMatches}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Generated:</span>
                    <span className="stat-value">
                      {new Date(report.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="report-actions">
                <button 
                  className="btn-primary"
                  onClick={() => {
                    // In a real app, this would open a detailed report view
                    alert(`Detailed report view for ${report.id} would open here.`);
                  }}
                >
                  👁️ View Details
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => {
                    // In a real app, this would download a PDF report
                    alert(`PDF download for ${report.id} would start here.`);
                  }}
                >
                  📄 Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reports.length > 0 && (
        <div className="reports-summary">
          <div className="summary-stats">
            <div className="summary-item">
              <span className="summary-label">Total Reports:</span>
              <span className="summary-value">{reports.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Average Similarity:</span>
              <span className="summary-value">
                {(reports.reduce((sum, r) => sum + r.overallSimilarity, 0) / reports.length).toFixed(1)}%
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">High Risk Reports:</span>
              <span className="summary-value">
                {reports.filter(r => r.overallSimilarity >= 70).length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportViewer;
