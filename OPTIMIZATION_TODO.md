# Backend Optimization Todo List

## 🔴 Critical Priority

### Security & Stability
- [ ] **Re-enable and properly configure rate limiting**
  - Currently disabled in `server.js` (line 118)
  - Implement per-route rate limiting (auth endpoints stricter)
  - Use `express-rate-limit` with proper trust proxy configuration
  - Add rate limit headers to responses

- [ ] **Fix CORS configuration**
  - Currently using ultra-permissive CORS (allows all origins)
  - Restrict to specific allowed origins from environment variables
  - Remove manual CORS headers duplication (lines 72-90 in server.js)
  - Use `cors` middleware properly instead of manual implementation

- [ ] **Add input validation middleware**
  - Implement `express-validator` or `joi` for request validation
  - Validate all user inputs before processing
  - Sanitize file uploads (check MIME types, file sizes, extensions)

- [ ] **Improve error handling**
  - Add structured error logging (use Winston or similar)
  - Don't expose internal error details in production
  - Add error tracking (Sentry or similar)
  - Standardize error response format

---

## 🟠 High Priority

### Database Optimization

- [ ] **Add database indexes**
  - `Message`: compound index on `(sender, receiver, createdAt)`
  - `Message`: index on `participants` array field
  - `Moment`: compound index on `(user, createdAt)` for user moments
  - `Moment`: index on `privacy` field
  - `User`: compound index on `(email, isEmailVerified)`
  - Review all frequently queried fields and add indexes

- [ ] **Optimize database queries**
  - Fix N+1 query problems in `getUserSenders` (loads all messages then filters)
  - Use aggregation pipeline for conversation lists instead of loading all messages
  - Add `.lean()` to read-only queries that don't need Mongoose documents
  - Use `select()` to limit populated fields (currently populating too many fields)

- [ ] **Implement query result caching**
  - Add Redis or `node-cache` for frequently accessed data
  - Cache user profiles, language lists, public moments feed
  - Set appropriate TTLs (5-15 minutes for dynamic data)
  - Invalidate cache on updates

- [ ] **Optimize populate calls**
  - Reduce populated fields (currently populating entire user objects)
  - Use projection to only fetch needed fields
  - Consider virtual populate for relationships
  - Example: `populate('user', 'name image')` instead of listing 10+ fields

### Performance Improvements

- [ ] **Enable response compression**
  - `compression` package is installed but not used
  - Add `app.use(compression())` middleware
  - Reduces payload size significantly for JSON responses

- [ ] **Optimize image URL generation**
  - Currently duplicated in every controller
  - Create utility function for image URL generation
  - Consider using virtual fields in Mongoose schemas
  - Or middleware to transform responses

- [ ] **Add pagination to all list endpoints**
  - `getMessages` (line 109) - no pagination, loads all messages
  - `getUserMessages` (line 136) - no pagination
  - `getUserSenders` (line 180) - no pagination
  - `getMessagesFromUser` (line 223) - no pagination
  - Use consistent pagination pattern across all endpoints

- [ ] **Optimize Socket.IO operations**
  - Cache online users list instead of fetching all sockets on each connection
  - Batch message read status updates
  - Add connection pooling/limits
  - Implement socket room management optimization

- [ ] **File upload optimization**
  - Add image compression/resizing before saving
  - Validate file types more strictly
  - Consider using cloud storage (S3, Cloudinary) instead of local storage
  - Add file cleanup job for orphaned files

---

## 🟡 Medium Priority

### Code Quality & Architecture

- [ ] **Refactor duplicate code**
  - Extract image URL generation to utility function
  - Create reusable pagination middleware
  - Standardize response format across all endpoints
  - Extract common query patterns to model methods

- [ ] **Improve code organization**
  - Separate business logic from controllers (create service layer)
  - Move Socket.IO logic to separate module
  - Create constants file for magic numbers/strings
  - Add JSDoc comments to all functions

- [ ] **Add request logging and monitoring**
  - Structured logging with request IDs
  - Log slow queries (>100ms)
  - Add performance metrics (response times, error rates)
  - Consider APM tool (New Relic, DataDog, etc.)

- [ ] **Database connection optimization**
  - Review connection pool settings (currently maxPoolSize: 10)
  - Monitor connection usage
  - Add connection retry logic with exponential backoff
  - Implement graceful shutdown for database connections

- [ ] **Add API versioning**
  - Currently using `/api/v1/` but no versioning strategy
  - Plan for future API versions
  - Document deprecation policy

### Data Consistency

- [ ] **Fix data inconsistencies**
  - `getUserSenders` may return duplicate senders (check Set logic)
  - `deleteMessage` calls `message.remove()` after `findByIdAndDelete` (redundant)
  - `updateMoment` has inconsistent error handling
  - Review all update operations for race conditions

- [ ] **Add database transactions**
  - Use transactions for multi-step operations
  - Example: creating message + updating unread count
  - Ensure data consistency on failures

- [ ] **Implement soft deletes**
  - Currently using hard deletes
  - Add `deletedAt` field to models
  - Filter deleted records from queries
  - Add cleanup job for old soft-deleted records

---

## 🟢 Low Priority (Nice to Have)

### Developer Experience

- [ ] **Add API documentation**
  - Implement Swagger/OpenAPI documentation
  - Document all endpoints, request/response schemas
  - Add example requests/responses

- [ ] **Improve environment configuration**
  - Validate required environment variables on startup
  - Use `config` package for better config management
  - Add development vs production configs

- [ ] **Add unit and integration tests**
  - Set up Jest or Mocha
  - Test critical paths (auth, messages, moments)
  - Add test coverage reporting
  - Set up CI/CD pipeline

- [ ] **Code linting and formatting**
  - Add ESLint configuration
  - Add Prettier for code formatting
  - Set up pre-commit hooks with Husky

### Advanced Features

- [ ] **Implement full-text search**
  - Add MongoDB text indexes for moments/messages
  - Consider Elasticsearch for advanced search
  - Add search endpoint with filters

- [ ] **Add real-time notifications**
  - Implement notification system (push notifications)
  - Queue system for background jobs (Bull/BullMQ)
  - Email notification batching

- [ ] **Implement GraphQL API**
  - Consider GraphQL for flexible data fetching
  - Reduce over-fetching issues
  - Better for mobile clients

- [ ] **Add analytics and metrics**
  - Track API usage patterns
  - Monitor database query performance
  - User activity analytics
  - Performance dashboards

---

## 📊 Performance Metrics to Track

- [ ] Response time percentiles (p50, p95, p99)
- [ ] Database query execution times
- [ ] Memory usage patterns
- [ ] CPU usage
- [ ] Error rates by endpoint
- [ ] Request throughput
- [ ] Socket.IO connection counts
- [ ] File upload success/failure rates

---

## 🔧 Quick Wins (Do First)

1. **Enable compression middleware** (5 minutes)
2. **Add database indexes** (30 minutes)
3. **Fix CORS configuration** (15 minutes)
4. **Extract image URL utility function** (20 minutes)
5. **Add pagination to `getMessages`** (30 minutes)
6. **Re-enable rate limiting with proper config** (20 minutes)

**Estimated total time for quick wins: ~2 hours**

---

## 📝 Notes

- Review all TODO comments in code
- Check for unused dependencies in `package.json`
- Consider upgrading dependencies (check for security vulnerabilities)
- Review MongoDB connection string security
- Add health check endpoint with database status
- Consider implementing request ID tracking for debugging

---

## 🎯 Success Criteria

- [ ] All endpoints respond in <200ms (p95)
- [ ] Database queries use indexes (no collection scans)
- [ ] Zero security vulnerabilities in dependencies
- [ ] 90%+ test coverage for critical paths
- [ ] API documentation complete
- [ ] Monitoring and logging in place
- [ ] Rate limiting properly configured
- [ ] All endpoints have pagination where needed

---

**Last Updated:** $(date)
**Priority Order:** Critical → High → Medium → Low

