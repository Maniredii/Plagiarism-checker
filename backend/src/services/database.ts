import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '../../data/plagiarism.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(dbPath);

// Database schema
const initializeDatabase = () => {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      // Documents table
      db.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size INTEGER NOT NULL,
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          file_path TEXT NOT NULL
        )
      `);

      // Web sources table for caching web content
      db.run(`
        CREATE TABLE IF NOT EXISTS web_sources (
          id TEXT PRIMARY KEY,
          url TEXT UNIQUE NOT NULL,
          title TEXT,
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          last_crawled DATETIME DEFAULT CURRENT_TIMESTAMP,
          source_type TEXT DEFAULT 'web'
        )
      `);

      // Similarity reports table
      db.run(`
        CREATE TABLE IF NOT EXISTS similarity_reports (
          id TEXT PRIMARY KEY,
          document1_id TEXT NOT NULL,
          document2_id TEXT,
          web_source_id TEXT,
          overall_similarity REAL NOT NULL,
          algorithm_scores TEXT, -- JSON string
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          report_type TEXT DEFAULT 'document_comparison',
          FOREIGN KEY (document1_id) REFERENCES documents (id),
          FOREIGN KEY (document2_id) REFERENCES documents (id),
          FOREIGN KEY (web_source_id) REFERENCES web_sources (id)
        )
      `);

      // Similarity matches table
      db.run(`
        CREATE TABLE IF NOT EXISTS similarity_matches (
          id TEXT PRIMARY KEY,
          report_id TEXT NOT NULL,
          similarity REAL NOT NULL,
          matched_text TEXT NOT NULL,
          source_text TEXT NOT NULL,
          start_position INTEGER NOT NULL,
          end_position INTEGER NOT NULL,
          source_start_pos INTEGER,
          source_end_pos INTEGER,
          algorithm TEXT NOT NULL,
          source_type TEXT NOT NULL, -- 'document', 'web', 'academic'
          source_url TEXT,
          source_title TEXT,
          confidence REAL DEFAULT 1.0,
          FOREIGN KEY (report_id) REFERENCES similarity_reports (id)
        )
      `);

      // Citations table for tracking properly cited content
      db.run(`
        CREATE TABLE IF NOT EXISTS citations (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          citation_text TEXT NOT NULL,
          citation_type TEXT, -- 'quote', 'reference', 'bibliography'
          start_position INTEGER NOT NULL,
          end_position INTEGER NOT NULL,
          source_info TEXT, -- JSON string with source details
          FOREIGN KEY (document_id) REFERENCES documents (id)
        )
      `);

      // Academic sources table
      db.run(`
        CREATE TABLE IF NOT EXISTS academic_sources (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          authors TEXT,
          publication TEXT,
          year INTEGER,
          doi TEXT,
          abstract TEXT,
          content TEXT,
          content_hash TEXT,
          source_url TEXT,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Database initialized successfully');
          resolve();
        }
      });
    });
  });
};

// Document operations
export const saveDocument = (document: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO documents (id, filename, original_name, mime_type, size, content, content_hash, file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      document.id,
      document.filename,
      document.originalName,
      document.mimeType,
      document.size,
      document.content,
      document.contentHash,
      document.filePath
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    
    stmt.finalize();
  });
};

export const getAllDocuments = (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT id, filename, original_name, mime_type, size, uploaded_at,
             substr(content, 1, 200) || '...' as content_preview
      FROM documents 
      ORDER BY uploaded_at DESC
    `, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

export const getDocumentById = (id: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM documents WHERE id = ?
    `, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

export const deleteDocument = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM documents WHERE id = ?`, [id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Web source operations
export const saveWebSource = (webSource: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO web_sources (id, url, title, content, content_hash, source_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      webSource.id,
      webSource.url,
      webSource.title,
      webSource.content,
      webSource.contentHash,
      webSource.sourceType || 'web'
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    
    stmt.finalize();
  });
};

export const getWebSourceByUrl = (url: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM web_sources WHERE url = ?
    `, [url], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Report operations
export const saveSimilarityReport = (report: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO similarity_reports (id, document1_id, document2_id, web_source_id, overall_similarity, algorithm_scores, report_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      report.id,
      report.document1Id,
      report.document2Id || null,
      report.webSourceId || null,
      report.overallSimilarity,
      JSON.stringify(report.algorithmScores || {}),
      report.reportType || 'document_comparison'
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    
    stmt.finalize();
  });
};

export const saveSimilarityMatch = (match: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO similarity_matches (id, report_id, similarity, matched_text, source_text, start_position, end_position, source_start_pos, source_end_pos, algorithm, source_type, source_url, source_title, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      match.id,
      match.reportId,
      match.similarity,
      match.matchedText,
      match.sourceText,
      match.startPosition,
      match.endPosition,
      match.sourceStartPos || null,
      match.sourceEndPos || null,
      match.algorithm,
      match.sourceType,
      match.sourceUrl || null,
      match.sourceTitle || null,
      match.confidence || 1.0
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    
    stmt.finalize();
  });
};

export const getAllReports = (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT sr.*, 
             d1.original_name as document1_name,
             d2.original_name as document2_name,
             ws.title as web_source_title,
             ws.url as web_source_url
      FROM similarity_reports sr
      LEFT JOIN documents d1 ON sr.document1_id = d1.id
      LEFT JOIN documents d2 ON sr.document2_id = d2.id
      LEFT JOIN web_sources ws ON sr.web_source_id = ws.id
      ORDER BY sr.created_at DESC
    `, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

export const getReportById = (id: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT sr.*, 
             d1.original_name as document1_name,
             d2.original_name as document2_name,
             ws.title as web_source_title,
             ws.url as web_source_url
      FROM similarity_reports sr
      LEFT JOIN documents d1 ON sr.document1_id = d1.id
      LEFT JOIN documents d2 ON sr.document2_id = d2.id
      LEFT JOIN web_sources ws ON sr.web_source_id = ws.id
      WHERE sr.id = ?
    `, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

export const getMatchesByReportId = (reportId: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM similarity_matches WHERE report_id = ? ORDER BY similarity DESC
    `, [reportId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Initialize database on module load
initializeDatabase().catch(console.error);

export default db;
