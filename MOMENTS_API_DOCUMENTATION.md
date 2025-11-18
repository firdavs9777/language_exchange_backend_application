# Moments API Documentation

## 📋 Overview

The Moments API allows users to create, read, update, and delete social media posts (moments). Each moment can include text, images, location data, tags, and various metadata. The API supports privacy settings, likes/dislikes, comments, and pagination.

**Base URL**: `/api/v1/moments`

## ✨ Recent Optimizations

The Moments API has been optimized for better performance and security:

- ✅ **Database Indexes**: Added indexes on `user`, `privacy`, `category`, `language`, and `createdAt` for faster queries
- ✅ **Query Optimization**: Using `.lean()` for read-only queries (faster, less memory)
- ✅ **Input Validation**: Comprehensive validation using `express-validator`
- ✅ **Security Improvements**: Using authenticated user instead of userId in request body
- ✅ **Image Utilities**: Centralized image URL generation for consistency
- ✅ **File Validation**: MIME type and size validation for image uploads
- ✅ **Image Limits**: Maximum 10 images per moment
- ✅ **Better Error Handling**: Consistent error responses
- ✅ **Performance**: Parallel queries where possible
- ✅ **Code Cleanup**: Removed redundant code and improved structure

---

## 📊 Data Model

### Moment Schema

```javascript
{
  _id: ObjectId,                    // Unique moment ID
  title: String,                    // Required, max 100 characters
  description: String,              // Required, max 2000 characters
  user: ObjectId,                   // Reference to User (required)
  images: [String],                 // Array of image filenames
  location: {                       // GeoJSON location data
    type: "Point",
    coordinates: [Number, Number],  // [longitude, latitude]
    formattedAddress: String,
    street: String,
    city: String,
    state: String,
    zipcode: String,
    country: String
  },
  mood: String,                    // Enum: 'happy', 'excited', 'grateful', 'motivated', 'relaxed', 'curious', ''
  tags: [String],                   // Max 5 tags
  category: String,                 // Enum: 'general', 'language-learning', 'culture', 'food', 'travel', 'music', 'books', 'hobbies'
  language: String,                 // ISO639-1 language code (default: 'en')
  privacy: String,                  // Enum: 'public', 'friends', 'private' (default: 'public')
  scheduledFor: Date,               // Optional scheduled publish date
  likeCount: Number,                // Default: 0
  likedUsers: [ObjectId],           // Array of user IDs who liked
  commentCount: Number,             // Default: 0
  comments: [ObjectId],             // Array of comment references
  createdAt: Date,                  // Auto-generated
  updatedAt: Date                   // Auto-generated
}
```

---

## 🔗 API Endpoints

### 1. Get All Moments (Feed)

**GET** `/api/v1/moments`

Get a paginated list of moments based on privacy settings.

**Access**: Public (shows public moments), Private (shows public + user's own moments)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)

**Response**:
```json
{
  "moments": [
    {
      "_id": "moment_id",
      "title": "My First Moment",
      "description": "This is my first moment description...",
      "user": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com",
        "imageUrls": ["http://domain.com/uploads/image1.jpg"],
        // ... other user fields
      },
      "imageUrls": ["http://domain.com/uploads/moment1.jpg"],
      "mood": "happy",
      "tags": ["travel", "adventure"],
      "category": "travel",
      "language": "en",
      "privacy": "public",
      "likeCount": 5,
      "commentCount": 2,
      "location": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749],
        "formattedAddress": "San Francisco, CA, USA"
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalMoments": 50,
    "limit": 10,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

**Privacy Logic**:
- **Public**: Shows all public moments
- **Logged in users**: Shows public moments + their own moments (regardless of privacy)
- **Future**: Will show friends' moments when friends feature is implemented

---

### 2. Get Single Moment

**GET** `/api/v1/moments/:id`

Get a single moment by ID with full details including comments.

**Access**: Public

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "moment_id",
    "title": "My First Moment",
    "description": "Full description...",
    "user": {
      "_id": "user_id",
      "name": "John Doe",
      "imageUrls": ["http://domain.com/uploads/user.jpg"]
    },
    "imageUrls": ["http://domain.com/uploads/moment1.jpg"],
    "comments": [
      {
        "_id": "comment_id",
        "text": "Great moment!",
        "user": "user_id",
        "moment": "moment_id"
      }
    ],
    "likeCount": 5,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses**:
- `404`: Moment not found

---

### 3. Create Moment

**POST** `/api/v1/moments`

Create a new moment.

**Access**: Private (requires authentication)

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "title": "My Amazing Moment",
  "description": "This is a detailed description of my moment. It can be up to 2000 characters long.",
  "mood": "excited",                    // Optional
  "tags": ["travel", "adventure"],      // Optional, max 5 tags
  "category": "travel",                 // Optional, default: "general"
  "language": "en",                     // Optional, ISO639-1 code, default: "en"
  "privacy": "public",                  // Optional: "public", "friends", "private"
  "location": {                         // Optional
    "coordinates": [-122.4194, 37.7749],  // [longitude, latitude]
    "formattedAddress": "San Francisco, CA, USA",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  },
  "scheduledFor": "2024-12-25T10:00:00.000Z"  // Optional - schedule for future (must be future date)
}
```

**Note**: The `user` field is automatically set from the authenticated user's token. Do not include it in the request body.

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "moment_id",
    "title": "My Amazing Moment",
    "description": "This is a detailed description...",
    "user": {
      "_id": "user_id",
      "name": "John Doe"
    },
    "imageUrls": [],
    "mood": "excited",
    "tags": ["travel", "adventure"],
    "category": "travel",
    "language": "en",
    "privacy": "public",
    "likeCount": 0,
    "commentCount": 0,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Validation Rules**:
- `title`: Required, max 100 characters
- `description`: Required, max 2000 characters
- `user`: Required, must be valid user ID
- `tags`: Max 5 tags
- `mood`: Must be one of: 'happy', 'excited', 'grateful', 'motivated', 'relaxed', 'curious', or empty string
- `category`: Must be one of: 'general', 'language-learning', 'culture', 'food', 'travel', 'music', 'books', 'hobbies'
- `language`: Must be valid ISO639-1 code (e.g., 'en', 'es', 'fr')
- `privacy`: Must be 'public', 'friends', or 'private'

---

### 4. Update Moment

**PUT** `/api/v1/moments/:id`

Update an existing moment. Only the moment owner can update it.

**Access**: Private (requires authentication + ownership)

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** (all fields optional):
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "mood": "happy",
  "tags": ["new", "tags"],
  "category": "general",
  "privacy": "private"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "moment_id",
    "title": "Updated Title",
    "description": "Updated description",
    "user": {
      "_id": "user_id",
      "name": "John Doe",
      "imageUrls": ["http://domain.com/uploads/user.jpg"]
    },
    "imageUrls": ["http://domain.com/uploads/moment1.jpg"],
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses**:
- `401`: Not authorized (not the moment owner)
- `404`: Moment not found
- `500`: Failed to update moment

---

### 5. Delete Moment

**DELETE** `/api/v1/moments/:id`

Delete a moment. Only the moment owner can delete it.

**Access**: Private (requires authentication + ownership)

**Headers**:
```
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {},
  "message": "Moment Deleted"
}
```

**Error Responses**:
- `401`: Not authorized (not the moment owner)
- `404`: Moment not found

---

### 6. Upload Photos to Moment

**PUT** `/api/v1/moments/:id/photo`

Upload one or multiple images to an existing moment.

**Access**: Private (requires authentication)

**Headers**:
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body** (Form Data):
- `file`: Image file(s) - can be single file or multiple files
- Max file size: 10MB per file
- Supported formats: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`
- Maximum images per moment: 10 images

**Validation**:
- File type is validated (MIME type check)
- File size is validated (max 10MB)
- Maximum 10 images per moment enforced

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "moment_id",
    "images": [
      "image1-1234567890.jpg",
      "image2-1234567891.jpg"
    ]
  }
}
```

**Note**: 
- Images are stored in the `/uploads` directory
- Filenames are automatically generated: `originalname-timestamp.extension`
- Multiple images can be uploaded in a single request
- Images are appended to existing images array

---

### 7. Get User's Moments

**GET** `/api/v1/moments/user/:userId`

Get all moments created by a specific user.

**Access**: Public

**Query Parameters**:
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response**:
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "_id": "moment_id",
      "title": "User's Moment",
      "description": "...",
      "user": {
        "_id": "user_id",
        "name": "John Doe",
        "imageUrls": ["http://domain.com/uploads/user.jpg"]
      },
      "imageUrls": ["http://domain.com/uploads/moment1.jpg"],
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 8. Like a Moment

**POST** `/api/v1/moments/:id/like`

Like a moment. Prevents duplicate likes from the same user.

**Access**: Private (requires authentication)

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**: None required (user ID is taken from authentication token)

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "moment_id",
    "likeCount": 6,
    "isLiked": true
  }
}
```

**Response** (if already liked):
```json
{
  "success": true,
  "message": "Already liked",
  "data": {
    "_id": "moment_id",
    "likeCount": 5,
    "isLiked": true
  }
}
```

**Error Responses**:
- `404`: Moment not found

**Note**: 
- Like count is automatically incremented
- User ID (from token) is added to `likedUsers` array
- If like count is negative, it's reset to 0
- If already liked, returns success with `isLiked: true` without error

---

### 9. Dislike (Unlike) a Moment

**POST** `/api/v1/moments/:id/dislike`

Remove a like from a moment.

**Access**: Private (requires authentication)

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**: None required (user ID is taken from authentication token)

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "moment_id",
    "likeCount": 5,
    "isLiked": false
  }
}
```

**Error Responses**:
- `404`: Moment not found

**Note**: 
- Like count is automatically decremented
- User ID (from token) is removed from `likedUsers` array
- If like count goes negative, it's reset to 0

---

## 🔒 Privacy Settings

### Public
- Visible to everyone (logged in and anonymous users)
- Appears in public feed
- Can be shared publicly

### Friends (Future Feature)
- Visible only to users who are friends with the moment creator
- Will be implemented when friends feature is added
- Currently treated as private

### Private
- Visible only to the moment creator
- Does not appear in public feed
- Only accessible via direct URL or user's profile

---

## 🖼️ Image Handling

### Image Storage
- Images are stored in the `/uploads` directory
- Filenames are automatically generated to prevent conflicts
- Format: `originalname-timestamp.extension`

### Image URLs
- All image responses include full URLs
- Format: `http://domain.com/uploads/filename.jpg`
- User images and moment images are both included in responses

### Image Limits
- Max file size: 10MB per file
- Maximum images per moment: **10 images** (enforced)
- Supported formats: JPEG, JPG, PNG, GIF, WEBP
- File type validation: MIME type checking
- Multiple images can be uploaded in a single request

---

## 🏷️ Categories

Available categories for moments:
- `general` - General posts (default)
- `language-learning` - Language learning related
- `culture` - Cultural content
- `food` - Food and recipes
- `travel` - Travel experiences
- `music` - Music related
- `books` - Book reviews and recommendations
- `hobbies` - Hobby related content

---

## 😊 Moods

Available moods for moments:
- `happy` - Happy moments
- `excited` - Excited about something
- `grateful` - Grateful moments
- `motivated` - Motivational content
- `relaxed` - Relaxed state
- `curious` - Curious or questioning
- `''` - No specific mood (default)

---

## 📍 Location Data

Moments can include geolocation data using GeoJSON format:

```json
{
  "location": {
    "type": "Point",
    "coordinates": [longitude, latitude],  // Note: [lng, lat] not [lat, lng]
    "formattedAddress": "Full address string",
    "street": "Street address",
    "city": "City name",
    "state": "State/Province",
    "zipcode": "Postal code",
    "country": "Country name"
  }
}
```

**Note**: Coordinates use [longitude, latitude] format (GeoJSON standard), not [latitude, longitude].

---

## 🔗 Comments Integration

Comments are handled through a nested router. See Comments API documentation for details.

**Endpoint**: `/api/v1/moments/:momentId/comments`

---

## 📄 Pagination

Most list endpoints support pagination:

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 50)

**Response Format**:
```json
{
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalMoments": 50,
    "limit": 10,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

---

## ⚠️ Error Handling

### Common Error Responses

**400 Bad Request**:
```json
{
  "success": false,
  "error": "Validation error message"
}
```

**401 Unauthorized**:
```json
{
  "success": false,
  "error": "Not authorized to access this route"
}
```

**404 Not Found**:
```json
{
  "success": false,
  "error": "Moment not found with id of {id}"
}
```

**500 Server Error**:
```json
{
  "error": "Server error",
  "message": "Detailed error message"
}
```

---

## 🎯 Best Practices

### 1. **Authentication**
- Always include the `Authorization: Bearer <token>` header for protected endpoints
- **Do NOT** include `user` or `userId` in request body - it's automatically taken from the token
- The API automatically uses the authenticated user for all operations

### 2. **Image Uploads**
- Compress images before uploading to reduce file size
- Use appropriate image formats (JPEG for photos, PNG for graphics)
- Consider image dimensions (recommend max 2000px width/height)
- Maximum 10 images per moment (enforced by API)
- Supported formats: JPEG, JPG, PNG, GIF, WEBP only

### 3. **Privacy**
- Set appropriate privacy levels for sensitive content
- Remember that public moments are visible to everyone
- Private moments are only visible to the creator
- Friends privacy setting is reserved for future implementation

### 4. **Performance**
- Use pagination for large lists (default: 10, max: 50 per page)
- Maximum 10 images per moment (enforced)
- API uses database indexes for fast queries
- Consider caching for frequently accessed moments
- Use appropriate page/limit values to avoid large responses

### 5. **Validation**
- Validate all input data on the client side before sending
- Check required fields before making requests
- Respect character limits (title: 1-100, description: 1-2000)
- API validates all inputs server-side with detailed error messages
- Tags: Maximum 5 tags per moment
- Scheduled dates must be in the future

### 6. **Error Handling**
- Always check response status codes
- Handle errors gracefully in your application
- Display user-friendly error messages

---

## 🔄 Example Workflows

### Creating a Moment with Images

1. **Create the moment**:
```bash
POST /api/v1/moments
{
  "title": "My Vacation",
  "description": "Amazing trip to the mountains",
  "user": "user_id",
  "category": "travel",
  "privacy": "public"
}
```

2. **Upload images**:
```bash
PUT /api/v1/moments/{moment_id}/photo
Form Data: file=image1.jpg, file=image2.jpg
```

### Updating a Moment

```bash
PUT /api/v1/moments/{moment_id}
{
  "title": "Updated Title",
  "description": "Updated description",
  "privacy": "private"
}
```

### Liking a Moment

```bash
POST /api/v1/moments/{moment_id}/like
Headers: Authorization: Bearer <token>
# No body required - user ID from token
```

---

## 🚀 Future Enhancements

Potential improvements to consider:

- [x] Add image limit per moment (✅ 10 images max)
- [x] Add input validation (✅ Comprehensive validation)
- [x] Add file type validation (✅ MIME type checking)
- [ ] Add image compression/resizing on upload
- [ ] Implement friends privacy setting
- [ ] Add moment search/filter functionality
- [ ] Add moment sharing feature
- [ ] Implement scheduled publishing
- [ ] Add video support
- [ ] Add moment reactions (beyond like/dislike)
- [ ] Add moment collections/bookmarks
- [ ] Add trending/popular moments endpoint
- [ ] Add location-based moment discovery
- [ ] Add caching layer (Redis)
- [ ] Add full-text search

---

## 📝 Implementation Notes

### ✅ Completed Optimizations

1. **Security**: All endpoints now use authenticated user from token (no `userId` in body)
2. **Image Cleanup**: Deleted moments now attempt to delete associated image files
3. **Like/Dislike Security**: Uses authenticated user automatically (no `userId` required)
4. **Input Validation**: Comprehensive validation with `express-validator`
5. **Database Indexes**: Added indexes for performance on frequently queried fields
6. **Query Optimization**: Using `.lean()` for read-only queries
7. **File Validation**: MIME type and size validation for uploads
8. **Image Limits**: Maximum 10 images per moment enforced

### 🔄 Future Enhancements

1. **Scheduled Publishing**: The `scheduledFor` field exists but scheduled publishing is not yet implemented
2. **Comments Count**: Consider using a virtual or updating it when comments are added/removed
3. **Image Compression**: Consider adding automatic image compression/resizing on upload
4. **Caching**: Consider implementing Redis caching for frequently accessed moments
5. **Friends Privacy**: Friends privacy setting is reserved for future implementation

---

## 🔧 Technical Details

### Database Indexes
The following indexes have been added for performance:
- `{ user: 1, createdAt: -1 }` - For user moments queries
- `{ privacy: 1, createdAt: -1 }` - For public feed queries
- `{ category: 1, createdAt: -1 }` - For category filtering
- `{ language: 1, createdAt: -1 }` - For language filtering
- `{ createdAt: -1 }` - For sorting by date
- `{ 'location.coordinates': '2dsphere' }` - For geospatial queries

### Query Optimization
- Using `.lean()` for read-only queries (faster, less memory)
- Limited user field population (only necessary fields)
- Parallel queries where possible (count + fetch)
- Pagination with max limit enforcement (50 per page)

### Validation Rules
- Title: 1-100 characters (required)
- Description: 1-2000 characters (required)
- Tags: Maximum 5 tags
- Mood: Enum validation
- Category: Enum validation
- Language: ISO639-1 code validation
- Privacy: Enum validation
- Location: Coordinate validation (longitude: -180 to 180, latitude: -90 to 90)
- Scheduled date: Must be in the future
- Images: Max 10 per moment, 10MB per file, MIME type validation

---

**Last Updated**: 2024
**API Version**: v1
**Status**: ✅ Production Ready (Optimized)

