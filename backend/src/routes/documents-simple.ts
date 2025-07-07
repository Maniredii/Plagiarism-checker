import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { extractTextFromFile } from '../services/textExtraction';
import { createError } from '../middleware/errorHandler';
import {
  saveDocument,
  getAllDocuments as getDbDocuments,
  getDocumentById as getDbDocumentById,
  deleteDocument as deleteDbDocument
} from '../services/database';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// In-memory storage for documents (replace with database later)
interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  content: string;
  uploadedAt: Date;
  filePath: string;
}

const documents: Map<string, Document> = new Map();

// Upload single document
router.post('/upload', upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw createError('No file uploaded', 400);
    }

    const documentId = uuidv4();
    
    // Extract text from the uploaded file
    const extractedText = await extractTextFromFile(req.file.path, req.file.mimetype);

    // Create content hash for deduplication
    const contentHash = crypto.createHash('md5').update(extractedText).digest('hex');

    const document: Document = {
      id: documentId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      content: extractedText,
      uploadedAt: new Date(),
      filePath: req.file.path
    };

    // Save to both memory and database
    documents.set(documentId, document);

    try {
      await saveDocument({
        ...document,
        contentHash,
        uploadedAt: document.uploadedAt.toISOString()
      });
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
      // Continue without database save
    }

    res.json({
      success: true,
      data: {
        id: document.id,
        originalName: document.originalName,
        size: document.size,
        uploadedAt: document.uploadedAt,
        contentPreview: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : '')
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all uploaded documents
router.get('/', (req, res) => {
  const documentList = Array.from(documents.values()).map(doc => ({
    id: doc.id,
    originalName: doc.originalName,
    size: doc.size,
    uploadedAt: doc.uploadedAt,
    contentPreview: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : '')
  }));

  res.json({
    success: true,
    data: documentList
  });
});

// Get document by ID
router.get('/:id', (req, res, next) => {
  try {
    const document = documents.get(req.params.id);
    
    if (!document) {
      throw createError('Document not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: document.id,
        originalName: document.originalName,
        size: document.size,
        uploadedAt: document.uploadedAt,
        content: document.content
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete document
router.delete('/:id', (req, res, next) => {
  try {
    const document = documents.get(req.params.id);
    
    if (!document) {
      throw createError('Document not found', 404);
    }

    // Delete file from filesystem
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    // Remove from memory
    documents.delete(req.params.id);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
export { documents };
