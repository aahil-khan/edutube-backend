# Lecture Tag Management API

## Overview
Added comprehensive lecture tagging system to allow keyword-based search and organization of lectures. Each lecture can have multiple tags for easy discovery.

## Database Changes
- Added `LectureTag` model with relationships to `Lecture`
- Tags are stored as lowercase strings to ensure consistency
- Unique constraint prevents duplicate tags per lecture

## New API Endpoints

### 1. Add Tags to Lecture
**POST** `/api/admin/lectures/:id/tags`
```json
{
  "tags": ["javascript", "beginner", "variables"]
}
```

### 2. Remove Tag from Lecture
**DELETE** `/api/admin/lectures/:id/tags/:tagId`

### 3. Get All Tags for Lecture
**GET** `/api/admin/lectures/:id/tags`

### 4. Update Lecture with Tags
**PUT** `/api/admin/lectures/:id/with-tags`
```json
{
  "title": "Updated Title",
  "description": "Updated Description",
  "tags": ["new-tag1", "new-tag2"]
}
```

### 5. Search Lectures by Tags
**GET** `/api/admin/lectures/search/by-tags?tags=javascript,beginner&course_id=1`

### 6. Get All Unique Tags
**GET** `/api/admin/tags/unique?course_id=1`

## Enhanced Existing Endpoints
- `GET /api/admin/courses/:courseId/lectures` - Now includes tags in response
- `POST /api/admin/lectures` - Now includes tags in response
- `PUT /api/admin/lectures/:id` - Now includes tags in response

## Example Usage

### Search for lectures with specific tags:
```bash
curl "http://localhost:5000/api/admin/lectures/search/by-tags?tags=javascript,beginner"
```

### Add tags to a lecture:
```bash
curl -X POST http://localhost:5000/api/admin/lectures/1/tags \
  -H "Content-Type: application/json" \
  -d '{"tags": ["react", "frontend", "components"]}'
```

### Get all unique tags:
```bash
curl http://localhost:5000/api/admin/tags/unique
```

## Sample Data
The seed script now includes sample tags:
- `javascript`, `beginner`, `variables`, `fundamentals`
- `functions`, `programming`
- `control-flow`, `loops`, `conditionals`
- `html`, `web-development`, `frontend`
- `es6`, `arrow-functions`, `destructuring`, `advanced`

## Benefits
1. **Easy Discovery**: Search lectures by topic/difficulty
2. **Organization**: Group related lectures across courses
3. **Filtering**: Filter course content by skill level or topic
4. **Analytics**: Track popular topics and learning paths
5. **Recommendations**: Suggest related content based on tags
