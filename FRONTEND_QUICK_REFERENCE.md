# Frontend Changes - Quick Reference

## What Changed?

All message endpoints now return paginated responses instead of all messages at once.

## Response Format Change

**Old:**
```json
{ "success": true, "data": [...] }
```

**New:**
```json
{
  "success": true,
  "count": 50,
  "total": 150,
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "limit": 50,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "data": [...]
}
```

## Quick Fix Steps

### 1. Add Pagination Models (5 minutes)

```dart
class PaginationInfo {
  final int currentPage;
  final int totalPages;
  final int limit;
  final bool hasNextPage;
  final bool hasPrevPage;
  
  PaginationInfo.fromJson(Map<String, dynamic> json) : 
    currentPage = json['currentPage'] ?? 1,
    totalPages = json['totalPages'] ?? 1,
    limit = json['limit'] ?? 50,
    hasNextPage = json['hasNextPage'] ?? false,
    hasPrevPage = json['hasPrevPage'] ?? false;
}

class PaginatedResponse<T> {
  final bool success;
  final int count;
  final int total;
  final PaginationInfo pagination;
  final List<T> data;
  
  PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) : 
    success = json['success'] ?? false,
    count = json['count'] ?? 0,
    total = json['total'] ?? 0,
    pagination = PaginationInfo.fromJson(json['pagination'] ?? {}),
    data = (json['data'] as List?)?.map((item) => fromJsonT(item)).toList() ?? [];
}
```

### 2. Update API Calls (10 minutes)

Add `page` and `limit` query parameters:

```dart
// Before
final response = await dio.get('/api/v1/messages');

// After
final response = await dio.get(
  '/api/v1/messages',
  queryParameters: {'page': 1, 'limit': 50},
);
```

### 3. Parse New Response Format (5 minutes)

```dart
// Before
final messages = (response.data['data'] as List)
    .map((json) => Message.fromJson(json))
    .toList();

// After
final paginatedResponse = PaginatedResponse.fromJson(
  response.data,
  (json) => Message.fromJson(json),
);
final messages = paginatedResponse.data;
final hasMore = paginatedResponse.pagination.hasNextPage;
```

### 4. Implement Infinite Scroll (30 minutes)

```dart
int _currentPage = 1;
bool _hasMore = true;
List<Message> _messages = [];

Future<void> _loadMore() async {
  if (!_hasMore) return;
  
  final response = await _messageService.getMessages(
    page: _currentPage + 1,
    limit: 50,
  );
  
  setState(() {
    _messages.addAll(response.data);
    _hasMore = response.pagination.hasNextPage;
    _currentPage++;
  });
}
```

## Affected Endpoints

All these endpoints now support pagination:

1. `GET /api/v1/messages` - All messages
2. `GET /api/v1/messages/user/:userId` - User's messages
3. `GET /api/v1/messages/senders/:userId` - Conversation list
4. `GET /api/v1/messages/from/:userId` - Messages from user
5. `GET /api/v1/messages/conversation/:senderId/:receiverId` - Conversation

## Default Values

If you don't send `page` or `limit`:
- `page` defaults to `1`
- `limit` defaults to `50`
- Maximum `limit` is `100`

So existing code will still work, but you'll only get the first 50 results.

## Testing

1. ✅ Load first page - should get 50 messages
2. ✅ Scroll to load more - should get next 50
3. ✅ Check `hasNextPage` - should be false on last page
4. ✅ Verify no duplicates - messages shouldn't repeat

## Need Help?

See `FRONTEND_CHANGES_GUIDE.md` for complete examples and detailed implementation.

