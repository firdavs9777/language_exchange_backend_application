# Frontend Changes Guide - Chat Optimization

## Overview

This guide outlines all the frontend (Flutter) changes needed to work with the optimized backend chat system. The main changes involve implementing pagination for message endpoints and handling the new response format.

## Breaking Changes

### API Response Format

**Before:**
```json
{
  "success": true,
  "data": [...]
}
```

**After:**
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

## Required Changes

### 1. Update Message Models

**File:** `lib/models/message.dart` (or similar)

Add pagination model:

```dart
class PaginationInfo {
  final int currentPage;
  final int totalPages;
  final int limit;
  final bool hasNextPage;
  final bool hasPrevPage;

  PaginationInfo({
    required this.currentPage,
    required this.totalPages,
    required this.limit,
    required this.hasNextPage,
    required this.hasPrevPage,
  });

  factory PaginationInfo.fromJson(Map<String, dynamic> json) {
    return PaginationInfo(
      currentPage: json['currentPage'] ?? 1,
      totalPages: json['totalPages'] ?? 1,
      limit: json['limit'] ?? 50,
      hasNextPage: json['hasNextPage'] ?? false,
      hasPrevPage: json['hasPrevPage'] ?? false,
    );
  }
}

class PaginatedResponse<T> {
  final bool success;
  final int count;
  final int total;
  final PaginationInfo pagination;
  final List<T> data;

  PaginatedResponse({
    required this.success,
    required this.count,
    required this.total,
    required this.pagination,
    required this.data,
  });

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) {
    return PaginatedResponse<T>(
      success: json['success'] ?? false,
      count: json['count'] ?? 0,
      total: json['total'] ?? 0,
      pagination: PaginationInfo.fromJson(json['pagination'] ?? {}),
      data: (json['data'] as List<dynamic>?)
          ?.map((item) => fromJsonT(item as Map<String, dynamic>))
          .toList() ?? [],
    );
  }
}
```

### 2. Update API Service

**File:** `lib/services/message_service.dart` (or similar)

Update all message endpoints to support pagination:

```dart
class MessageService {
  final Dio _dio;
  
  MessageService(this._dio);

  // Get all messages with pagination
  Future<PaginatedResponse<Message>> getMessages({
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get(
        '/api/v1/messages',
        queryParameters: {
          'page': page,
          'limit': limit,
        },
      );
      
      return PaginatedResponse.fromJson(
        response.data,
        (json) => Message.fromJson(json),
      );
    } catch (e) {
      throw Exception('Failed to load messages: $e');
    }
  }

  // Get user messages with pagination
  Future<PaginatedResponse<Message>> getUserMessages(
    String userId, {
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get(
        '/api/v1/messages/user/$userId',
        queryParameters: {
          'page': page,
          'limit': limit,
        },
      );
      
      return PaginatedResponse.fromJson(
        response.data,
        (json) => Message.fromJson(json),
      );
    } catch (e) {
      throw Exception('Failed to load user messages: $e');
    }
  }

  // Get conversation messages with pagination
  Future<PaginatedResponse<Message>> getConversation(
    String senderId,
    String receiverId, {
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get(
        '/api/v1/messages/conversation/$senderId/$receiverId',
        queryParameters: {
          'page': page,
          'limit': limit,
        },
      );
      
      return PaginatedResponse.fromJson(
        response.data,
        (json) => Message.fromJson(json),
      );
    } catch (e) {
      throw Exception('Failed to load conversation: $e');
    }
  }

  // Get user senders (conversation list) with pagination
  Future<PaginatedResponse<ConversationUser>> getUserSenders(
    String userId, {
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get(
        '/api/v1/messages/senders/$userId',
        queryParameters: {
          'page': page,
          'limit': limit,
        },
      );
      
      return PaginatedResponse.fromJson(
        response.data,
        (json) => ConversationUser.fromJson(json),
      );
    } catch (e) {
      throw Exception('Failed to load senders: $e');
    }
  }

  // Get messages from a specific user with pagination
  Future<PaginatedResponse<Message>> getMessagesFromUser(
    String userId, {
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get(
        '/api/v1/messages/from/$userId',
        queryParameters: {
          'page': page,
          'limit': limit,
        },
      );
      
      return PaginatedResponse.fromJson(
        response.data,
        (json) => Message.fromJson(json),
      );
    } catch (e) {
      throw Exception('Failed to load messages from user: $e');
    }
  }
}
```

### 3. Update Chat Screen with Infinite Scroll

**File:** `lib/screens/chat_screen.dart` (or similar)

Implement pagination with infinite scroll:

```dart
class ChatScreen extends StatefulWidget {
  final String conversationId;
  final String otherUserId;
  
  const ChatScreen({
    Key? key,
    required this.conversationId,
    required this.otherUserId,
  }) : super(key: key);

  @override
  _ChatScreenState createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final ScrollController _scrollController = ScrollController();
  final MessageService _messageService = MessageService();
  
  List<Message> _messages = [];
  bool _isLoading = false;
  bool _hasMore = true;
  int _currentPage = 1;
  final int _pageSize = 50;

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    // Load more when scrolled to top (for chat, load older messages)
    if (_scrollController.position.pixels <= 100 && 
        _hasMore && 
        !_isLoading) {
      _loadMoreMessages();
    }
  }

  Future<void> _loadMessages() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final response = await _messageService.getConversation(
        widget.conversationId,
        widget.otherUserId,
        page: 1,
        limit: _pageSize,
      );

      setState(() {
        _messages = response.data;
        _hasMore = response.pagination.hasNextPage;
        _currentPage = 1;
        _isLoading = false;
      });

      // Scroll to bottom (newest messages)
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load messages: $e')),
      );
    }
  }

  Future<void> _loadMoreMessages() async {
    if (!_hasMore || _isLoading) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final nextPage = _currentPage + 1;
      final response = await _messageService.getConversation(
        widget.conversationId,
        widget.otherUserId,
        page: nextPage,
        limit: _pageSize,
      );

      setState(() {
        // Prepend older messages (chat loads from newest to oldest)
        _messages = [...response.data, ..._messages];
        _hasMore = response.pagination.hasNextPage;
        _currentPage = nextPage;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load more messages: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Chat'),
      ),
      body: Column(
        children: [
          Expanded(
            child: _isLoading && _messages.isEmpty
                ? Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollController,
                    reverse: true, // Chat shows newest at bottom
                    itemCount: _messages.length + (_hasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == _messages.length) {
                        // Loading indicator at top
                        return Center(
                          child: Padding(
                            padding: EdgeInsets.all(8.0),
                            child: CircularProgressIndicator(),
                          ),
                        );
                      }
                      
                      final message = _messages[index];
                      return MessageBubble(message: message);
                    },
                  ),
          ),
          // Message input widget here
        ],
      ),
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
}
```

### 4. Update Conversation List Screen

**File:** `lib/screens/conversations_screen.dart` (or similar)

Implement pagination for conversation list:

```dart
class ConversationsScreen extends StatefulWidget {
  @override
  _ConversationsScreenState createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  final MessageService _messageService = MessageService();
  final ScrollController _scrollController = ScrollController();
  
  List<ConversationUser> _conversations = [];
  bool _isLoading = false;
  bool _hasMore = true;
  int _currentPage = 1;
  final int _pageSize = 50;

  @override
  void initState() {
    super.initState();
    _loadConversations();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    // Load more when scrolled near bottom
    if (_scrollController.position.pixels >= 
        _scrollController.position.maxScrollExtent - 200 && 
        _hasMore && 
        !_isLoading) {
      _loadMoreConversations();
    }
  }

  Future<void> _loadConversations() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final userId = await _getCurrentUserId(); // Your auth service
      final response = await _messageService.getUserSenders(
        userId,
        page: 1,
        limit: _pageSize,
      );

      setState(() {
        _conversations = response.data;
        _hasMore = response.pagination.hasNextPage;
        _currentPage = 1;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load conversations: $e')),
      );
    }
  }

  Future<void> _loadMoreConversations() async {
    if (!_hasMore || _isLoading) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final userId = await _getCurrentUserId();
      final nextPage = _currentPage + 1;
      final response = await _messageService.getUserSenders(
        userId,
        page: nextPage,
        limit: _pageSize,
      );

      setState(() {
        _conversations.addAll(response.data);
        _hasMore = response.pagination.hasNextPage;
        _currentPage = nextPage;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load more conversations: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Conversations'),
      ),
      body: _isLoading && _conversations.isEmpty
          ? Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadConversations,
              child: ListView.builder(
                controller: _scrollController,
                itemCount: _conversations.length + (_hasMore ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index == _conversations.length) {
                    return Center(
                      child: Padding(
                        padding: EdgeInsets.all(8.0),
                        child: CircularProgressIndicator(),
                      ),
                    );
                  }
                  
                  final conversation = _conversations[index];
                  return ConversationTile(conversation: conversation);
                },
              ),
            ),
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
}
```

### 5. Update ConversationUser Model

**File:** `lib/models/conversation_user.dart` (or similar)

Update to match new response format from `getUserSenders`:

```dart
class ConversationUser {
  final String id;
  final String name;
  final List<String> images;
  final List<String> imageUrls;
  final LastMessage? lastMessage;
  final int unreadCount;

  ConversationUser({
    required this.id,
    required this.name,
    required this.images,
    required this.imageUrls,
    this.lastMessage,
    required this.unreadCount,
  });

  factory ConversationUser.fromJson(Map<String, dynamic> json) {
    return ConversationUser(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      images: List<String>.from(json['images'] ?? []),
      imageUrls: List<String>.from(json['imageUrls'] ?? json['images'] ?? []),
      lastMessage: json['lastMessage'] != null
          ? LastMessage.fromJson(json['lastMessage'])
          : null,
      unreadCount: json['unreadCount'] ?? 0,
    );
  }
}

class LastMessage {
  final String? message;
  final DateTime? createdAt;
  final String? id;

  LastMessage({
    this.message,
    this.createdAt,
    this.id,
  });

  factory LastMessage.fromJson(Map<String, dynamic> json) {
    return LastMessage(
      message: json['message'],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : null,
      id: json['_id'] ?? json['id'],
    );
  }
}
```

## Migration Strategy

### Option 1: Gradual Migration (Recommended)

1. **Update API service first** - Add pagination support while keeping old methods
2. **Update one screen at a time** - Start with conversation list, then chat screen
3. **Test thoroughly** - Ensure pagination works correctly
4. **Remove old code** - Once all screens are updated

### Option 2: Full Migration

1. **Update all models** - Add pagination models
2. **Update all API services** - Add pagination to all endpoints
3. **Update all screens** - Implement infinite scroll everywhere
4. **Test and deploy**

## Testing Checklist

- [ ] Messages load correctly on first page
- [ ] "Load More" works when scrolling
- [ ] Loading indicators show properly
- [ ] Empty states handled correctly
- [ ] Error states handled correctly
- [ ] Pull-to-refresh works (if implemented)
- [ ] Conversation list pagination works
- [ ] Chat screen pagination works (loading older messages)
- [ ] No duplicate messages when loading more
- [ ] Performance is acceptable with large message lists

## Performance Tips

1. **Use ListView.builder** - Only builds visible items
2. **Implement caching** - Cache loaded messages locally
3. **Debounce scroll events** - Don't load more on every scroll event
4. **Limit page size** - Use 50 messages per page (backend default)
5. **Show loading indicators** - Better UX during pagination

## Backward Compatibility

The backend still accepts requests without pagination parameters (defaults to page 1, limit 50), so you can update the frontend gradually without breaking existing functionality.

## Example: Complete Chat Screen with Pagination

```dart
import 'package:flutter/material.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';

class OptimizedChatScreen extends StatefulWidget {
  final String conversationId;
  final String otherUserId;

  const OptimizedChatScreen({
    Key? key,
    required this.conversationId,
    required this.otherUserId,
  }) : super(key: key);

  @override
  _OptimizedChatScreenState createState() => _OptimizedChatScreenState();
}

class _OptimizedChatScreenState extends State<OptimizedChatScreen> {
  final PagingController<int, Message> _pagingController =
      PagingController(firstPageKey: 1);
  final MessageService _messageService = MessageService();

  @override
  void initState() {
    super.initState();
    _pagingController.addPageRequestListener((pageKey) {
      _fetchPage(pageKey);
    });
  }

  Future<void> _fetchPage(int pageKey) async {
    try {
      final response = await _messageService.getConversation(
        widget.conversationId,
        widget.otherUserId,
        page: pageKey,
        limit: 50,
      );

      final isLastPage = !response.pagination.hasNextPage;
      
      if (isLastPage) {
        _pagingController.appendLastPage(response.data);
      } else {
        final nextPageKey = pageKey + 1;
        _pagingController.appendPage(response.data, nextPageKey);
      }
    } catch (error) {
      _pagingController.error = error;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Chat')),
      body: PagedListView<int, Message>(
        pagingController: _pagingController,
        reverse: true,
        builderDelegate: PagedChildBuilderDelegate<Message>(
          itemBuilder: (context, message, index) =>
              MessageBubble(message: message),
          firstPageErrorIndicatorBuilder: (context) => ErrorWidget(
            _pagingController.error,
          ),
          newPageErrorIndicatorBuilder: (context) => ErrorWidget(
            _pagingController.error,
          ),
          firstPageProgressIndicatorBuilder: (context) =>
              Center(child: CircularProgressIndicator()),
          newPageProgressIndicatorBuilder: (context) =>
              Center(child: CircularProgressIndicator()),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _pagingController.dispose();
    super.dispose();
  }
}
```

**Note:** This example uses the `infinite_scroll_pagination` package. Install it with:
```yaml
dependencies:
  infinite_scroll_pagination: ^3.1.0
```

## Summary

The main changes needed are:
1. ✅ Add pagination models (`PaginationInfo`, `PaginatedResponse`)
2. ✅ Update API service methods to accept `page` and `limit` parameters
3. ✅ Update screens to handle paginated responses
4. ✅ Implement infinite scroll or "Load More" functionality
5. ✅ Update conversation list to use new `getUserSenders` response format

All changes are backward compatible - the backend will work with or without pagination parameters.

