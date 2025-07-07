import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <h1>🔍 PlagiarismDetector</h1>
          <p>Advanced Document Similarity Analysis</p>
        </div>
        <div className="header-info">
          <div className="status-indicator">
            <span className="status-dot online"></span>
            <span>System Online</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
