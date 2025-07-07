# Plagiarism Detection System - Setup Guide

## Project Status

✅ **Completed:**
- Project structure and architecture design
- Frontend React TypeScript setup with Vite
- Backend Node.js TypeScript setup with Express
- Database schema design with Prisma ORM
- Authentication system with JWT
- Basic API routes structure
- Error handling middleware
- Environment configuration

🔄 **In Progress:**
- Database setup and configuration

📋 **Next Steps:**
- User authentication implementation
- Document upload and processing
- Text similarity algorithms
- Frontend user interface
- Real-time progress tracking

## Prerequisites

Before running the application, ensure you have:

1. **Node.js 18+** installed
2. **PostgreSQL 14+** installed and running
3. **Git** for version control

## Database Setup

### 1. Install PostgreSQL

**Windows:**
- Download from https://www.postgresql.org/download/windows/
- Install with default settings
- Remember the password for the `postgres` user

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create Database

Connect to PostgreSQL and create the database:

```sql
-- Connect as postgres user
psql -U postgres

-- Create database
CREATE DATABASE plagiarism_detector;

-- Create user (optional)
CREATE USER plagiarism_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE plagiarism_detector TO plagiarism_user;

-- Exit
\q
```

### 3. Configure Environment

1. Copy the environment file:
```bash
cd backend
cp .env.example .env
```

2. Update the `DATABASE_URL` in `.env`:
```
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/plagiarism_detector"
```

## Installation & Running

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies (already done)
npm install

# Generate Prisma client (already done)
npm run db:generate

# Push database schema
npm run db:push

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

The backend will run on http://localhost:3001

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install additional dependencies for our app
npm install axios react-router-dom @types/react-router-dom socket.io-client

# Start development server
npm run dev
```

The frontend will run on http://localhost:5173

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Documents (Protected)
- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - Get user documents
- `GET /api/documents/:id` - Get document by ID
- `DELETE /api/documents/:id` - Delete document

### Reports (Protected)
- `GET /api/reports` - Get user reports
- `GET /api/reports/:id` - Get report by ID
- `GET /api/reports/:id/pdf` - Download PDF report

### Users (Protected)
- `GET /api/users` - Get all users (admin only)
- `PUT /api/users/profile` - Update user profile

## Default Users

After seeding, you can login with:

**Administrator:**
- Email: admin@plagiarismdetector.com
- Password: admin123

**Instructor:**
- Email: instructor@example.com
- Password: instructor123

**Student:**
- Email: student@example.com
- Password: student123

## Development Tools

- **Database GUI:** `npm run db:studio` (opens Prisma Studio)
- **API Testing:** Use Postman or similar tools
- **Logs:** Check console output for both frontend and backend

## Troubleshooting

### Database Connection Issues
1. Ensure PostgreSQL is running
2. Check DATABASE_URL in .env file
3. Verify database exists and user has permissions

### Port Conflicts
- Backend default: 3001
- Frontend default: 5173
- Change PORT in .env if needed

### Module Not Found Errors
- Run `npm install` in respective directories
- Clear node_modules and reinstall if needed

## Next Development Phase

The next phase will focus on:
1. Implementing document upload with file processing
2. Building the similarity detection algorithms
3. Creating the frontend user interface
4. Adding real-time progress tracking

Each component will be built incrementally with proper testing.
