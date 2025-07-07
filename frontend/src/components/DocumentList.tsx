import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

interface Document {
  id: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  contentPreview: string;
}

const DocumentList: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await axios.delete(`${API_BASE_URL}/documents/${id}`);
      if (response.data.success) {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
        if (selectedDocument?.id === id) {
          setSelectedDocument(null);
        }
        alert('Document deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document.');
    }
  };

  const viewDocument = async (id: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/documents/${id}`);
      if (response.data.success) {
        setSelectedDocument(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      alert('Failed to load document content.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="document-list">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="document-list">
      <div className="documents-header">
        <h2>📁 My Documents</h2>
        <p>Manage your uploaded documents</p>
        <button onClick={fetchDocuments} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No documents uploaded yet</h3>
          <p>Upload your first document to get started with plagiarism detection.</p>
        </div>
      ) : (
        <div className="documents-grid">
          <div className="documents-list">
            {documents.map((doc) => (
              <div key={doc.id} className="document-card">
                <div className="document-header">
                  <div className="document-icon">📄</div>
                  <div className="document-info">
                    <h4>{doc.originalName}</h4>
                    <p>{formatFileSize(doc.size)} • {new Date(doc.uploadedAt).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="document-preview">
                  {doc.contentPreview}
                </div>
                
                <div className="document-actions">
                  <button 
                    onClick={() => viewDocument(doc.id)}
                    className="btn-primary"
                  >
                    👁️ View
                  </button>
                  <button 
                    onClick={() => deleteDocument(doc.id)}
                    className="btn-danger"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selectedDocument && (
            <div className="document-viewer">
              <div className="viewer-header">
                <h3>📖 {selectedDocument.originalName}</h3>
                <button 
                  onClick={() => setSelectedDocument(null)}
                  className="close-btn"
                >
                  ✕
                </button>
              </div>
              
              <div className="document-content">
                <div className="content-stats">
                  <span>📊 {selectedDocument.content.length} characters</span>
                  <span>📝 {selectedDocument.content.split(' ').length} words</span>
                  <span>📅 {new Date(selectedDocument.uploadedAt).toLocaleString()}</span>
                </div>
                
                <div className="content-text">
                  {selectedDocument.content}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentList;
