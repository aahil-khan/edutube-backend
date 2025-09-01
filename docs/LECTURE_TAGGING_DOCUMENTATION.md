# Lecture Tagging System Documentation

## Overview
The lecture tagging system allows administrators to add keyword-based metadata to lectures for enhanced searchability and content organization. This system enables users to find lectures across courses using topic-based searches.

## Database Schema

### LectureTag Model
```prisma
model LectureTag {
  id         Int      @id @default(autoincrement())
  lecture_id Int      // Foreign key to lecture
  tag        String   // The tag/keyword (stored as lowercase)
  created_at DateTime @default(now())
  
  // Relations
  lecture Lecture @relation(fields: [lecture_id], references: [id], onDelete: Cascade)
  
  @@unique([lecture_id, tag]) // Prevent duplicate tags for the same lecture
  @@map("lecture_tags")
}
```

### Updated Lecture Model
```prisma
model Lecture {
  // ... existing fields ...
  tags         LectureTag[]   // One-to-many: Tags for this lecture
  // ... rest of model ...
}
```

## API Endpoints

### 1. Add Tags to Lecture
**Endpoint:** `POST /api/admin/lectures/:id/tags`

**Description:** Add multiple tags to a specific lecture

**Request Body:**
```json
{
  "tags": ["javascript", "beginner", "variables", "programming"]
}
```

**Response:**
```json
{
  "message": "Tags added successfully",
  "lecture": {
    "id": 1,
    "title": "Introduction to Variables",
    "tags": [
      {"id": 1, "tag": "javascript", "created_at": "2025-09-01T..."},
      {"id": 2, "tag": "beginner", "created_at": "2025-09-01T..."},
      {"id": 3, "tag": "variables", "created_at": "2025-09-01T..."},
      {"id": 4, "tag": "programming", "created_at": "2025-09-01T..."}
    ]
  }
}
```

**Features:**
- Tags are automatically converted to lowercase
- Duplicate tags are ignored (`skipDuplicates: true`)
- Validates lecture existence before adding tags

---

### 2. Remove Tag from Lecture
**Endpoint:** `DELETE /api/admin/lectures/:id/tags/:tagId`

**Description:** Remove a specific tag from a lecture

**URL Parameters:**
- `id`: Lecture ID
- `tagId`: Tag ID to remove

**Response:**
```json
{
  "message": "Tag removed successfully"
}
```

**Error Responses:**
- `404`: Tag not found for this lecture

---

### 3. Get All Tags for Lecture
**Endpoint:** `GET /api/admin/lectures/:id/tags`

**Description:** Retrieve all tags associated with a specific lecture

**Response:**
```json
{
  "lecture_id": 1,
  "title": "Introduction to Variables",
  "tags": [
    {"id": 1, "tag": "javascript", "created_at": "2025-09-01T..."},
    {"id": 2, "tag": "beginner", "created_at": "2025-09-01T..."},
    {"id": 3, "tag": "variables", "created_at": "2025-09-01T..."}
  ]
}
```

---

### 4. Update Lecture with Tags
**Endpoint:** `PUT /api/admin/lectures/:id/with-tags`

**Description:** Update lecture information and replace all tags in one request

**Request Body:**
```json
{
  "title": "Updated Lecture Title",
  "description": "Updated description",
  "youtube_url": "https://youtube.com/watch?v=...",
  "duration": "30:45",
  "tags": ["react", "frontend", "components", "jsx"]
}
```

**Response:**
```json
{
  "message": "Lecture updated successfully",
  "lecture": {
    "id": 1,
    "title": "Updated Lecture Title",
    "description": "Updated description",
    "youtube_url": "https://youtube.com/watch?v=...",
    "duration": "30:45",
    "tags": [
      {"id": 5, "tag": "react", "created_at": "2025-09-01T..."},
      {"id": 6, "tag": "frontend", "created_at": "2025-09-01T..."},
      {"id": 7, "tag": "components", "created_at": "2025-09-01T..."},
      {"id": 8, "tag": "jsx", "created_at": "2025-09-01T..."}
    ],
    "course": {
      "id": 1,
      "name": "Introduction to Programming"
    }
  }
}
```

**Behavior:**
- Removes all existing tags first
- Adds new tags provided in the request
- Updates lecture fields if provided
- Returns complete lecture data with course information

---

### 5. Search Lectures by Tags
**Endpoint:** `GET /api/admin/lectures/search/by-tags`

**Description:** Search for lectures that have specific tags

**Query Parameters:**
- `tags` (required): Comma-separated list of tags to search for
- `course_id` (optional): Filter results by specific course

**Example Requests:**
```bash
# Search for lectures with javascript OR beginner tags
GET /api/admin/lectures/search/by-tags?tags=javascript,beginner

# Search within a specific course
GET /api/admin/lectures/search/by-tags?tags=react,components&course_id=2
```

**Response:**
```json
{
  "searchTags": ["javascript", "beginner"],
  "total": 3,
  "lectures": [
    {
      "id": 1,
      "title": "Introduction to Variables",
      "description": "Learn about variables and data types",
      "chapter_name": "Getting Started",
      "chapter_number": 1,
      "lecture_number": 1,
      "youtube_url": "https://youtube.com/watch?v=...",
      "duration": "25:30",
      "tags": [
        {"id": 1, "tag": "javascript"},
        {"id": 2, "tag": "beginner"},
        {"id": 3, "tag": "variables"}
      ],
      "course": {
        "id": 1,
        "name": "Introduction to Programming"
      }
    }
    // ... more lectures
  ]
}
```

**Features:**
- Uses `OR` logic (lectures with ANY of the specified tags)
- Results ordered by course, chapter, and lecture number
- Includes full lecture and course information
- Returns count of matching lectures

---

### 6. Get All Unique Tags
**Endpoint:** `GET /api/admin/tags/unique`

**Description:** Retrieve all unique tags across lectures

**Query Parameters:**
- `course_id` (optional): Filter tags by specific course

**Example Requests:**
```bash
# Get all tags across all courses
GET /api/admin/tags/unique

# Get tags for a specific course
GET /api/admin/tags/unique?course_id=1
```

**Response:**
```json
{
  "total": 12,
  "tags": [
    "advanced",
    "arrow-functions",
    "beginner",
    "conditionals",
    "control-flow",
    "destructuring",
    "es6",
    "frontend",
    "functions",
    "fundamentals",
    "html",
    "javascript",
    "loops",
    "programming",
    "variables",
    "web-development"
  ]
}
```

**Features:**
- Tags returned in alphabetical order
- Includes total count
- Can be filtered by course

---

## Enhanced Existing Endpoints

### Course Lectures (Enhanced)
**Endpoint:** `GET /api/admin/courses/:courseId/lectures`

**Enhancement:** Now includes tags in the response and better ordering

**Response Example:**
```json
{
  "lectures": [
    {
      "id": 1,
      "title": "Introduction to Variables",
      "chapter_number": 1,
      "lecture_number": 1,
      "tags": [
        {"id": 1, "tag": "javascript"},
        {"id": 2, "tag": "beginner"}
      ]
      // ... other lecture fields
    }
  ],
  "pagination": { /* ... */ }
}
```

### Create Lecture (Enhanced)
**Endpoint:** `POST /api/admin/lectures`

**Enhancement:** Response now includes empty tags array

### Update Lecture (Enhanced)
**Endpoint:** `PUT /api/admin/lectures/:id`

**Enhancement:** Response now includes existing tags

---

## Sample Data

The seed script creates the following sample tags:

### Course 1: "Introduction to Programming"
- **Lecture 1**: `beginner`, `variables`, `javascript`, `fundamentals`
- **Lecture 2**: `functions`, `javascript`, `programming`, `beginner`
- **Lecture 3**: `control-flow`, `loops`, `conditionals`, `javascript`

### Course 2: "Web Development Fundamentals"
- **Lecture 4**: `html`, `web-development`, `frontend`, `beginner`

### Course 3: "Advanced JavaScript"
- **Lecture 5**: `es6`, `arrow-functions`, `destructuring`, `advanced`, `javascript`

---

## Usage Examples

### 1. Tag Management Workflow
```bash
# 1. Create a new lecture
POST /api/admin/lectures
{
  "title": "React Components",
  "course_id": 2,
  "chapter_name": "React Basics",
  "chapter_number": 2,
  "lecture_number": 1
}

# 2. Add tags to the lecture
POST /api/admin/lectures/6/tags
{
  "tags": ["react", "components", "jsx", "frontend"]
}

# 3. Search for React-related lectures
GET /api/admin/lectures/search/by-tags?tags=react,jsx

# 4. Update lecture and tags together
PUT /api/admin/lectures/6/with-tags
{
  "title": "React Component Fundamentals",
  "tags": ["react", "components", "jsx", "props", "state"]
}
```

### 2. Content Discovery
```bash
# Find all beginner content
GET /api/admin/lectures/search/by-tags?tags=beginner

# Find JavaScript-specific content
GET /api/admin/lectures/search/by-tags?tags=javascript

# Get all available topics
GET /api/admin/tags/unique
```

### 3. Course-Specific Tag Management
```bash
# Get tags for a specific course
GET /api/admin/tags/unique?course_id=1

# Search within a course
GET /api/admin/lectures/search/by-tags?tags=advanced&course_id=3
```

---

## Implementation Notes

### Data Consistency
- Tags are automatically converted to lowercase for consistency
- Unique constraints prevent duplicate tags per lecture
- Cascading deletes ensure tags are removed when lectures are deleted

### Performance Considerations
- Database indexes on `lecture_id` and `tag` fields for fast searches
- `skipDuplicates` option prevents unnecessary database errors
- Efficient batch operations for multiple tag creation

### Error Handling
- Validates lecture existence before tag operations
- Handles duplicate tag attempts gracefully
- Provides meaningful error messages for invalid requests

### Security
- All endpoints require admin authentication
- Input validation for tag format and length
- SQL injection protection through Prisma ORM

---

## Integration with Frontend

The tagging system is designed to support various frontend features:

1. **Tag Input Components**: Autocomplete with existing tags
2. **Search Filters**: Multi-select tag filtering
3. **Content Discovery**: Tag-based recommendation system
4. **Analytics**: Popular tags and learning path tracking
5. **Batch Operations**: Bulk tag management for multiple lectures
