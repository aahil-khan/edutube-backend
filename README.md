# EduTube Backend - Refactored

This is the refactored version of the EduTube backend, implementing modern Node.js/Express best practices and using Prisma ORM instead of raw SQL.

## 🏗️ Architecture Changes

### Before
- Everything in a single `index.js` file
- Raw SQL queries
- Tightly coupled code
- No separation of concerns

### After
- Modular structure with separation of concerns
- Prisma ORM for type-safe database operations
- Controllers, routes, middleware, and config separation
- Better error handling
- Improved maintainability and scalability

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Prisma schema definition
│   └── migrations/            # Database migrations
├── src/
│   ├── config/
│   │   ├── db.js             # Prisma client configuration
│   │   ├── elasticsearch.js   # Elasticsearch client
│   │   └── redis.js          # Redis configuration
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── courseController.js
│   │   ├── enrollmentController.js
│   │   ├── searchController.js
│   │   └── watchHistoryController.js
│   ├── middleware/
│   │   ├── auth.js           # Authentication middleware
│   │   └── cors.js           # CORS configuration
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── enrollmentRoutes.js
│   │   ├── searchRoutes.js
│   │   └── watchHistoryRoutes.js
│   ├── utils/
│   │   └── errorHandler.js   # Global error handling
│   └── app.js               # Express app configuration
├── index.js                 # Server entry point
├── package.json
└── .env.example            # Environment variables template
```

## 🔧 Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install Prisma dependencies:**
   ```bash
   npm install @prisma/client prisma
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Generate Prisma client:**
   ```bash
   npm run prisma:generate
   ```

5. **Run database migrations:**
   ```bash
   npm run prisma:migrate
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```

## 🎯 Key Improvements

### 1. **Separation of Concerns**
- **Controllers**: Handle business logic
- **Routes**: Define API endpoints
- **Middleware**: Handle cross-cutting concerns
- **Config**: Manage external service connections

### 2. **Prisma ORM Benefits**
- Type-safe database queries
- Auto-generated client
- Migration management
- Introspection capabilities
- Better error handling

### 3. **Error Handling**
- Centralized error handling middleware
- Custom error classes
- Development vs production error responses
- Async error handling wrapper

### 4. **Modular Architecture**
- Easy to test individual components
- Better code organization
- Easier to maintain and scale
- Clear dependency structure

### 5. **Security Improvements**
- Environment variables for sensitive data
- Proper CORS configuration
- JWT token handling
- Input validation (can be extended)

## 🔄 Migration from Old Structure

The refactoring preserves all existing functionality while improving the codebase structure:

1. **Database Operations**: Migrated from raw SQL to Prisma queries
2. **Route Handlers**: Extracted to individual controller files
3. **Middleware**: Separated into reusable modules
4. **Configuration**: Centralized in config files
5. **Error Handling**: Implemented global error handling

## 📊 API Routes

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify-auth` - Verify token

### Users
- `GET /api/users/get-user-data` - Get user data
- `POST /api/users/change-password` - Change password
- `GET /api/users/dashboard` - User dashboard

### Courses
- `GET /api/courses/:id` - Get courses by teacher

### Enrollment
- `POST /api/enrollment/enroll_course` - Enroll in course
- `DELETE /api/enrollment/unenroll_course` - Unenroll from course

### Search
- `POST /api/search` - Search functionality

### Watch History
- `POST /api/watch-history` - Add/update watch history
- `GET /api/watch-history` - Get watch history
- `GET /api/getVideoProgress/:lec_id` - Get video progress

## 🚀 Future Improvements

1. **Validation**: Add input validation using libraries like Joi or Zod
2. **Testing**: Implement unit and integration tests
3. **Caching**: Uncomment and configure Redis caching
4. **Logging**: Add structured logging with Winston
5. **Rate Limiting**: Implement API rate limiting
6. **API Documentation**: Add Swagger/OpenAPI documentation
7. **Performance**: Add database query optimization
8. **Security**: Add helmet, rate limiting, and input sanitization

## 🔧 Development Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

## 📝 Notes

- All original comments have been preserved for review
- Redis caching code is commented out but ready to be enabled
- Legacy routes are maintained for backward compatibility
- Database schema has been migrated to Prisma format
- Error handling has been improved with proper HTTP status codes
