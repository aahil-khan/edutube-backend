# 📚 Chapter Management System - API Documentation

## 🔄 Major Schema Changes

### ✅ What Changed
- **Added Chapter Model**: New `chapters` table with proper course relationships
- **Updated Lecture Model**: Lectures now reference chapters instead of storing chapter names
- **Hierarchical Structure**: Course → Chapters → Lectures (proper 3-level hierarchy)
- **Improved Data Integrity**: Foreign key constraints and unique constraints

### 🗂️ New Database Structure

```
Course (1) → Chapters (*) → Lectures (*)
```

**Before:**
```javascript
// Old Lecture Structure
{
  id: 1,
  course_id: 1,
  chapter_name: "Introduction",
  chapter_number: 1,
  lecture_number: 1,
  title: "Getting Started"
}
```

**After:**
```javascript
// New Structure
// Chapter
{
  id: 1,
  course_id: 1,
  name: "Introduction", 
  number: 1
}

// Lecture
{
  id: 1,
  course_id: 1,
  chapter_id: 1,  // References chapter
  lecture_number: 1,
  title: "Getting Started"
}
```

---

## 🔧 Admin Workflow Changes

### 📋 New Content Creation Flow

1. **Create Course** (unchanged)
2. **Create Chapters** (new step)
3. **Create Lectures** (updated to reference chapters)

---

## 📡 API Endpoints

### 🏫 Chapter Management

#### 📖 Get Course Chapters
```http
GET /api/admin/courses/{courseId}/chapters
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "chapters": [
    {
      "id": 1,
      "course_id": 1,
      "name": "Introduction to Programming",
      "description": "Basic concepts and setup",
      "number": 1,
      "created_at": "2025-09-01T10:00:00Z",
      "updated_at": "2025-09-01T10:00:00Z",
      "_count": {
        "lectures": 5
      }
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

#### ➕ Create Chapter
```http
POST /api/admin/chapters
```

**Request Body:**
```json
{
  "name": "Advanced JavaScript",
  "description": "Deep dive into JS concepts",
  "number": 2,
  "course_id": 1
}
```

**Response:**
```json
{
  "message": "Chapter created successfully",
  "chapter": {
    "id": 2,
    "course_id": 1,
    "name": "Advanced JavaScript", 
    "description": "Deep dive into JS concepts",
    "number": 2,
    "created_at": "2025-09-01T10:30:00Z",
    "updated_at": "2025-09-01T10:30:00Z",
    "course": {
      "id": 1,
      "name": "JavaScript Fundamentals"
    },
    "_count": {
      "lectures": 0
    }
  }
}
```

#### ✏️ Update Chapter
```http
PUT /api/admin/chapters/{id}
```

**Request Body:**
```json
{
  "name": "Updated Chapter Name",
  "description": "Updated description",
  "number": 3
}
```

#### 🗑️ Delete Chapter
```http
DELETE /api/admin/chapters/{id}
```

**⚠️ Warning:** Deletes all lectures and their watch history in this chapter

#### 📋 Get Chapters for Dropdown
```http
GET /api/admin/chapters/dropdown?courseId={courseId}
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Introduction",
    "number": 1
  },
  {
    "id": 2, 
    "name": "Advanced Topics",
    "number": 2
  }
]
```

---

### 🎥 Updated Lecture Management

#### 📖 Get Course Lectures (Updated)
```http
GET /api/admin/courses/{courseId}/lectures
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page  
- `chapterId` (optional): Filter by chapter

**Response:**
```json
{
  "lectures": [
    {
      "id": 1,
      "course_id": 1,
      "chapter_id": 1,
      "lecture_number": 1,
      "title": "Introduction to Variables",
      "description": "Learn about variables in JavaScript",
      "youtube_url": "https://youtube.com/watch?v=abc123",
      "duration": 1200,
      "created_at": "2025-09-01T11:00:00Z",
      "updated_at": "2025-09-01T11:00:00Z",
      "chapter": {
        "id": 1,
        "name": "JavaScript Basics",
        "number": 1
      },
      "tags": [
        {
          "id": 1,
          "tag": "variables",
          "lecture_id": 1
        }
      ]
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 10,
    "totalPages": 2
  }
}
```

#### ➕ Create Lecture (Updated)
```http
POST /api/admin/lectures
```

**Request Body:**
```json
{
  "title": "JavaScript Functions",
  "description": "Understanding functions in JavaScript",
  "youtube_url": "https://youtube.com/watch?v=def456", 
  "duration": 1800,
  "course_id": 1,
  "chapter_id": 1,
  "lecture_number": 2
}
```

**Key Changes:**
- ❌ Removed: `chapter_name`, `chapter_number`
- ✅ Added: `chapter_id` (required)
- ✅ `duration` is optional (auto-fetch from YouTube)

#### ✏️ Update Lecture (Updated)
```http
PUT /api/admin/lectures/{id}
```

**Request Body:**
```json
{
  "title": "Updated Lecture Title",
  "description": "Updated description", 
  "youtube_url": "https://youtube.com/watch?v=new123",
  "duration": 2000,
  "chapter_id": 2,
  "lecture_number": 1
}
```

---

## 🎯 Frontend Integration Guide

### 📱 UI Flow Updates

#### 1. **Course Management Page**
```javascript
// No changes needed - same course CRUD operations
```

#### 2. **New Chapter Management Page**
```javascript
// New page: /admin/courses/{courseId}/chapters

const ChapterManagement = () => {
  // List chapters for a course
  // Create new chapters
  // Edit/delete existing chapters
  // Show lecture count per chapter
};
```

#### 3. **Updated Lecture Creation Form**
```javascript
// Updated: /admin/lectures/create

const CreateLectureForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtube_url: '',
    duration: '', // Optional now
    course_id: '',
    chapter_id: '', // New required field
    lecture_number: ''
  });

  // Step 1: Select Course
  // Step 2: Select Chapter (dropdown populated based on course)
  // Step 3: Fill lecture details
};
```

#### 4. **Chapter Dropdown Component**
```javascript
const ChapterDropdown = ({ courseId, value, onChange }) => {
  const [chapters, setChapters] = useState([]);
  
  useEffect(() => {
    if (courseId) {
      fetchChapters(courseId);
    }
  }, [courseId]);

  const fetchChapters = async (courseId) => {
    const response = await fetch(`/api/admin/chapters/dropdown?courseId=${courseId}`);
    const data = await response.json();
    setChapters(data);
  };

  return (
    <select value={value} onChange={onChange}>
      <option value="">Select Chapter</option>
      {chapters.map(chapter => (
        <option key={chapter.id} value={chapter.id}>
          {chapter.number}. {chapter.name}
        </option>
      ))}
    </select>
  );
};
```

### 🔄 Required Frontend Changes

#### ✅ Immediate Changes Needed

1. **Create Chapter Management Page**
   - CRUD operations for chapters
   - Chapter ordering (by number)
   - Lecture count display

2. **Update Lecture Forms**
   - Replace chapter name/number inputs with chapter dropdown
   - Make duration optional
   - Add chapter selection step

3. **Update Lecture Listing**
   - Display chapter information instead of chapter_name
   - Add chapter-based filtering

4. **Navigation Updates**
   - Add "Manage Chapters" link in course details
   - Update breadcrumbs: Course → Chapters → Lectures

#### 📋 Optional Enhancements

1. **Drag & Drop Reordering**
   - For chapters within a course
   - For lectures within a chapter

2. **Bulk Operations**
   - Move lectures between chapters
   - Duplicate chapters with lectures

3. **Chapter Templates**
   - Predefined chapter structures
   - Quick chapter creation

---

## 🗃️ Database Migration Notes

### ⚠️ Migration Requirements

The schema changes require a database migration that will:

1. **Create `chapters` table**
2. **Add `chapter_id` to `lectures` table** 
3. **Remove `chapter_name` and `chapter_number` from `lectures`**
4. **Migrate existing data** (if any)

### 🔄 Data Migration Strategy

If you have existing lectures:

1. **Backup existing data**
2. **Create chapters** from existing `chapter_name` and `chapter_number`
3. **Update lectures** to reference new chapter IDs
4. **Remove old columns**

---

## 🚀 Quick Start for Frontend

### 1. Test the API
```bash
# Get chapters for course ID 1
curl "http://localhost:3000/api/admin/courses/1/chapters"

# Create a chapter
curl -X POST "http://localhost:3000/api/admin/chapters" \
  -H "Content-Type: application/json" \
  -d '{"name": "Getting Started", "number": 1, "course_id": 1}'

# Get chapters for dropdown
curl "http://localhost:3000/api/admin/chapters/dropdown?courseId=1"
```

### 2. Update Your Frontend Forms

```javascript
// Old lecture creation
const oldData = {
  title: "Intro",
  course_id: 1,
  chapter_name: "Beginning",
  chapter_number: 1,
  lecture_number: 1
};

// New lecture creation
const newData = {
  title: "Intro", 
  course_id: 1,
  chapter_id: 1, // From chapter dropdown
  lecture_number: 1
};
```

### 3. Navigation Flow

```
Courses List → Course Details → Chapters List → Chapter Details → Lectures List → Lecture Details
```

This new structure provides much better organization and follows proper database normalization principles! 🎉
