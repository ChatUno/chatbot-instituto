# V5.1 Visual RAG - API Documentation

## Backend Structure Analysis

### API Endpoints

#### 1. POST /api/screenshot
**Purpose**: Capture webpage screenshot using Puppeteer

**Request**:
```json
{
  "url": "https://example.com"
}
```

**Response**:
```json
{
  "success": true,
  "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "metadata": {
    "url": "https://example.com",
    "capturedAt": "2026-04-18T10:30:00.000Z",
    "sizeBytes": 1234567
  }
}
```

#### 2. POST /api/extract
**Purpose**: Extract text and links from screenshot using AI

**Request**:
```json
{
  "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "text": "Extracted text content from the image",
    "links": ["https://example.com/page1", "https://example.com/page2"],
    "model": "anthropic/claude-3-haiku",
    "tokensUsed": 1234
  }
}
```

#### 3. POST /api/chunk
**Purpose**: Generate semantic chunks from text

**Request**:
```json
{
  "text": "Long text content to be chunked...",
  "sourceUrl": "https://example.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "chunks": [
      {
        "text": "First chunk content",
        "category": "general",
        "quality_score": 85,
        "source_url": "https://example.com",
        "word_count": 45,
        "created_at": "2026-04-18T10:30:00.000Z"
      }
    ],
    "totalChunks": 1,
    "sourceUrl": "https://example.com"
  }
}
```

#### 4. POST /api/export
**Purpose**: Export approved chunks to database

**Request**:
```json
{
  "chunks": [
    {
      "text": "Approved chunk content",
      "category": "general",
      "quality_score": 85,
      "editedText": "Modified chunk text (optional)"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "exported": 1,
    "totalAfter": 10,
    "backupFile": "chunks-2026-04-18T10-30-00-000Z.json",
    "skippedDuplicates": 0
  }
}
```

#### 5. GET /api/export/status
**Purpose**: Get current database status

**Response**:
```json
{
  "success": true,
  "data": {
    "totalChunks": 10,
    "lastModified": "2026-04-18T10:30:00.000Z"
  }
}
```

#### 6. GET /api/export/backups
**Purpose**: List available backups

**Response**:
```json
{
  "success": true,
  "data": {
    "backups": [
      "chunks-2026-04-18T10-30-00-000Z.json",
      "chunks-2026-04-18T09-15-00-000Z.json"
    ]
  }
}
```

### Data Models

#### Chunk Model
```typescript
interface Chunk {
  text: string;
  category: 'general' | 'horario' | 'matricula' | 'oferta' | 'contacto' | 'actividades' | 'calendario' | 'servicios';
  quality_score: number; // 0-100
  source_url?: string;
  word_count?: number;
  created_at?: string;
  editedText?: string; // For user modifications
  status?: 'pending' | 'approved' | 'rejected' | 'edited'; // Frontend state
}
```

#### Screenshot Model
```typescript
interface Screenshot {
  screenshot: string; // base64 image
  url: string;
  title: string;
  dimensions: { width: number; height: number };
  timestamp: string;
}
```

#### Extracted Data Model
```typescript
interface ExtractedData {
  text: string;
  links: string[];
  model: string;
  tokensUsed: number;
}
```

### Error Handling

All endpoints return consistent error format:
```json
{
  "success": false,
  "error": "Error message",
  "detail": "Additional error details (in development mode)"
}
```

### Features

1. **Screenshot Service**: Puppeteer-based webpage capture
2. **AI Extraction**: OpenRouter with Claude 3 Haiku + Llama 3.2 Vision fallback
3. **Semantic Chunking**: Groq with Llama 3.3 70B
4. **Local Fallbacks**: When APIs fail, uses local processing
5. **Backup System**: Automatic backups before exports
6. **Deduplication**: Prevents duplicate chunks
7. **Quality Scoring**: AI-based quality assessment
8. **Categorization**: Automatic content categorization
