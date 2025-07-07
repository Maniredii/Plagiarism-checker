import React, { useState } from 'react';
import Header from './components/Header';
import DocumentUpload from './components/DocumentUpload';
import DocumentList from './components/DocumentList';
import PlagiarismChecker from './components/PlagiarismChecker';
import TurnitinAnalyzer from './components/TurnitinAnalyzer';
import ReportViewer from './components/ReportViewer';
import QuickCheck from './components/QuickCheck';
import BatchProcessor from './components/BatchProcessor';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'documents' | 'analyze' | 'check' | 'batch' | 'reports' | 'quick'>('analyze');

  return (
    <div className="app">
      <Header />

      <nav className="nav-tabs">
        <button
          className={activeTab === 'analyze' ? 'active' : ''}
          onClick={() => setActiveTab('analyze')}
        >
          🎯 Analyze Document
        </button>
        <button
          className={activeTab === 'upload' ? 'active' : ''}
          onClick={() => setActiveTab('upload')}
        >
          📄 Upload Documents
        </button>
        <button
          className={activeTab === 'documents' ? 'active' : ''}
          onClick={() => setActiveTab('documents')}
        >
          📁 My Documents
        </button>
        <button
          className={activeTab === 'check' ? 'active' : ''}
          onClick={() => setActiveTab('check')}
        >
          🔍 Compare Documents
        </button>
        <button
          className={activeTab === 'batch' ? 'active' : ''}
          onClick={() => setActiveTab('batch')}
        >
          📊 Batch Processing
        </button>
        <button
          className={activeTab === 'reports' ? 'active' : ''}
          onClick={() => setActiveTab('reports')}
        >
          📋 Reports
        </button>
        <button
          className={activeTab === 'quick' ? 'active' : ''}
          onClick={() => setActiveTab('quick')}
        >
          ⚡ Quick Check
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'analyze' && <TurnitinAnalyzer />}
        {activeTab === 'upload' && <DocumentUpload />}
        {activeTab === 'documents' && <DocumentList />}
        {activeTab === 'check' && <PlagiarismChecker />}
        {activeTab === 'batch' && <BatchProcessor />}
        {activeTab === 'reports' && <ReportViewer />}
        {activeTab === 'quick' && <QuickCheck />}
      </main>
    </div>
  );
}

export default App;
