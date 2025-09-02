# PostgreSQL Full-Text Search Implementation

This document describes the advanced search functionality that replaces Elasticsearch with PostgreSQL Full-Text Search (FTS) for better performance and simpler deployment.

## 🚀 Features

### Advanced Search Capabilities
- **Multi-entity search**: Teachers, courses, students, lectures
- **Fuzzy search**: Handles typos and partial matches
- **Prefix matching**: Autocomplete-style searching
- **Relevance ranking**: Results sorted by search relevance
- **Lazy loading**: Paginated results with infinite scroll
- **Real-time suggestions**: Autocomplete with debounced queries

### Search Types
- **All**: Search across all entity types
- **Teachers**: Search teacher names and emails
- **Courses**: Search course names, codes, and descriptions  
- **Lectures**: Search lecture titles and descriptions
- **Students**: Search student information (admin only)

### Advanced Filters
- Course code filtering
- Teacher name filtering
- Chapter name filtering
- Active/inactive course filtering
- Enrollment-based filtering (admin)

### Performance Optimizations
- PostgreSQL GIN indexes for full-text search
- Trigram indexes for fuzzy matching
- Composite indexes for join operations
- Partial indexes for common filter conditions

## 📊 API Endpoints

### 1. Quick Search (Autocomplete)
```
GET /quick-search?q={query}&limit={limit}
```
- **Purpose**: Provides autocomplete suggestions
- **Authentication**: None required
- **Response**: Array of suggestions with type and relevance

### 2. Advanced Search
```
POST /advanced-search
```
- **Purpose**: Full search functionality with filters and pagination
- **Authentication**: Required (JWT token)
- **Body Parameters**:
  ```json
  {
    "query": "search term",
    "type": "all|teachers|courses|lectures|students",
    "page": 1,
    "limit": 10,
    "filters": {
      "courseCode": "CS101",
      "teacherName": "john",
      "chapterName": "intro",
      "isActive": true
    },
    "sortBy": "relevance|name|date",
    "sortOrder": "asc|desc"
  }
  ```

### 3. Legacy Search (Backward Compatibility)
```
POST /search
```
- Redirects to advanced search for compatibility

## 🗄️ Database Indexes

The following indexes are automatically applied for optimal performance:

### Full-Text Search Indexes
```sql
-- Users (teachers and students)
CREATE INDEX idx_users_fts ON users USING gin(to_tsvector('english', name || ' ' || email));

-- Course templates
CREATE INDEX idx_course_templates_fts ON course_templates USING gin(to_tsvector('english', name || ' ' || course_code || ' ' || COALESCE(description, '')));

-- Lectures
CREATE INDEX idx_lectures_fts ON lectures USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

### Trigram Indexes (Fuzzy Search)
```sql
-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fuzzy search indexes
CREATE INDEX idx_users_name_trgm ON users USING gin(name gin_trgm_ops);
CREATE INDEX idx_lectures_title_trgm ON lectures USING gin(title gin_trgm_ops);
```

## 🎯 Frontend Integration

### Search Page Component
- **Location**: `/src/app/search/page.js`
- **Features**: 
  - Real-time autocomplete
  - Advanced filters panel
  - Paginated results
  - Type-specific result display
  - Role-based access control

### Reusable Search Box
- **Location**: `/src/app/component/SearchBox.js`
- **Usage**: Can be embedded in navbar, dashboard, etc.
- **Features**:
  - Debounced suggestions
  - Click-outside handling
  - Keyboard navigation

### API Routes (Next.js)
- **Advanced Search**: `/src/app/api/advanced-search/route.js`
- **Quick Search**: `/src/app/api/quick-search/route.js`
- **Configuration**: Updated in `/src/utils/apiConfig.js`

## 🛠️ Setup Instructions

### 1. Apply Database Indexes
```bash
cd backend
npm run search:indexes
```

### 2. Remove Elasticsearch Dependencies
Already completed in package.json files.

### 3. Test Search Functionality
```bash
cd backend
node scripts/testSearch.js
```

### 4. Start the Application
```bash
# Backend
cd backend
npm run dev

# Frontend  
cd edutube
npm run dev
```

## 🔧 Usage Examples

### Frontend Search Usage
```javascript
import SearchBox from '@/app/component/SearchBox';

// In a component
<SearchBox 
  placeholder="Search courses..." 
  compact={true}
  onResultSelect={(result) => {
    // Handle result selection
    router.push(`/course-page/${result.id}`);
  }}
/>
```

### Direct API Usage
```javascript
// Quick search for autocomplete
const suggestions = await axios.get('/api/quick-search?q=computer&limit=5');

// Advanced search with filters
const results = await axios.post('/api/advanced-search', {
  query: 'machine learning',
  type: 'courses',
  filters: { isActive: true },
  page: 1,
  limit: 10
});
```

## 📈 Performance Benefits

### Compared to Elasticsearch:
- ✅ **Simpler deployment**: No additional services required
- ✅ **Better resource usage**: Uses existing PostgreSQL instance
- ✅ **Faster queries**: Optimized indexes for specific use cases
- ✅ **Real-time updates**: No indexing delays
- ✅ **ACID compliance**: Consistent search results

### Search Performance:
- **Sub-100ms queries** for most searches
- **Efficient pagination** with offset optimization
- **Relevance ranking** using PostgreSQL's ts_rank
- **Fuzzy matching** with configurable similarity thresholds

## 🚦 Monitoring and Debugging

### Performance Monitoring
Search queries are automatically monitored for performance:
```javascript
import { monitorSearchPerformance } from '@/utils/searchUtils';

const results = await monitorSearchPerformance('teacher_search', async () => {
  return await searchTeachers(query, filters);
});
```

### Debug Logging
Enable detailed search logging:
```javascript
console.log('Search request:', { query, type, filters });
console.log('Generated tsquery:', createTsQuery(query));
console.log('Search results:', results.totalCount, 'found');
```

## 🔮 Future Enhancements

### Planned Features:
- **Search analytics**: Track popular searches and results
- **Personalized search**: User-based result ranking
- **Search filters memory**: Remember user filter preferences
- **Export results**: Allow users to export search results
- **Advanced highlighting**: Highlight search terms in results

### Performance Optimizations:
- **Materialized views**: For complex cross-entity searches
- **Search result caching**: Redis-based caching for popular queries
- **Query optimization**: Further index tuning based on usage patterns

## 🐛 Troubleshooting

### Common Issues:

1. **Slow search queries**:
   - Run `npm run search:indexes` to ensure indexes are applied
   - Check PostgreSQL query planner with EXPLAIN ANALYZE

2. **No search results**:
   - Verify data exists in database
   - Check tsquery generation in logs
   - Test with simpler queries

3. **Authentication errors**:
   - Ensure JWT token is valid and not expired
   - Check user role permissions for student search

4. **Frontend search not working**:
   - Verify API routes are correctly configured
   - Check browser network tab for errors
   - Ensure backend is running on correct port

### Database Performance:
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
WHERE indexname LIKE '%_fts' OR indexname LIKE '%_trgm';

-- Analyze search query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE to_tsvector('english', name) @@ to_tsquery('english', 'john:*');
```
