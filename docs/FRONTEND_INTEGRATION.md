# Frontend Integration Guide

This document covers the frontend changes needed to integrate the new Leaderboard and Smart Matching features.

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Data Models](#data-models)
3. [Leaderboard Feature](#leaderboard-feature)
4. [Smart Matching Feature](#smart-matching-feature)
5. [Push Notifications](#push-notifications)
6. [UI Components](#ui-components)
7. [Implementation Priority](#implementation-priority)

---

## API Endpoints

### Leaderboard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/leaderboard/xp` | XP leaderboard |
| GET | `/api/v1/leaderboard/streaks` | Streak leaderboard |
| GET | `/api/v1/leaderboard/language/:language` | Language-specific leaderboard |
| GET | `/api/v1/leaderboard/me` | Current user's ranks |
| GET | `/api/v1/leaderboard/friends` | Friends leaderboard |

### Matching Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/matching/recommendations` | Personalized partner recommendations |
| GET | `/api/v1/matching/quick` | Quick matches (online users) |
| GET | `/api/v1/matching/language/:language` | Find partners by language |
| GET | `/api/v1/matching/similar/:userId` | Users similar to a profile |

---

## Data Models

### Dart/Flutter Models

```dart
// ============================================
// LEADERBOARD MODELS
// ============================================

class LeaderboardResponse {
  final bool success;
  final LeaderboardData data;

  LeaderboardResponse({required this.success, required this.data});

  factory LeaderboardResponse.fromJson(Map<String, dynamic> json) {
    return LeaderboardResponse(
      success: json['success'] ?? false,
      data: LeaderboardData.fromJson(json['data']),
    );
  }
}

class LeaderboardData {
  final List<LeaderboardEntry> leaderboard;
  final int total;
  final String? period;
  final String? type;
  final String? language;
  final MyRank? myRank;

  LeaderboardData({
    required this.leaderboard,
    required this.total,
    this.period,
    this.type,
    this.language,
    this.myRank,
  });

  factory LeaderboardData.fromJson(Map<String, dynamic> json) {
    return LeaderboardData(
      leaderboard: (json['leaderboard'] as List?)
          ?.map((e) => LeaderboardEntry.fromJson(e))
          .toList() ?? [],
      total: json['total'] ?? 0,
      period: json['period'],
      type: json['type'],
      language: json['language'],
      myRank: json['myRank'] != null ? MyRank.fromJson(json['myRank']) : null,
    );
  }
}

class LeaderboardEntry {
  final int rank;
  final String odId;
  final String name;
  final String? username;
  final String? avatar;
  final String? country;
  final String? nativeLanguage;
  final String? learningLanguage;
  final int totalXP;
  final int currentStreak;
  final int? longestStreak;
  final int level;
  final int? streakDays;
  final bool isMe;

  LeaderboardEntry({
    required this.rank,
    required this.odId,
    required this.name,
    this.username,
    this.avatar,
    this.country,
    this.nativeLanguage,
    this.learningLanguage,
    required this.totalXP,
    required this.currentStreak,
    this.longestStreak,
    required this.level,
    this.streakDays,
    this.isMe = false,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) {
    return LeaderboardEntry(
      rank: json['rank'] ?? 0,
      odId: json['user']?.toString() ?? json['_id']?.toString() ?? '',
      name: json['name'] ?? '',
      username: json['username'],
      avatar: json['avatar'],
      country: json['country'],
      nativeLanguage: json['nativeLanguage'],
      learningLanguage: json['learningLanguage'],
      totalXP: json['totalXP'] ?? 0,
      currentStreak: json['currentStreak'] ?? 0,
      longestStreak: json['longestStreak'],
      level: json['level'] ?? 1,
      streakDays: json['streakDays'],
      isMe: json['isMe'] ?? false,
    );
  }
}

class MyRank {
  final int? rank;
  final int? value;
  final int? total;

  MyRank({this.rank, this.value, this.total});

  factory MyRank.fromJson(Map<String, dynamic> json) {
    return MyRank(
      rank: json['rank'],
      value: json['value'],
      total: json['total'],
    );
  }
}

class MyRanksResponse {
  final bool success;
  final MyRanksData data;

  MyRanksResponse({required this.success, required this.data});

  factory MyRanksResponse.fromJson(Map<String, dynamic> json) {
    return MyRanksResponse(
      success: json['success'] ?? false,
      data: MyRanksData.fromJson(json['data']),
    );
  }
}

class MyRanksData {
  final RankInfo xp;
  final RankInfo streak;
  final LearningStats stats;

  MyRanksData({
    required this.xp,
    required this.streak,
    required this.stats,
  });

  factory MyRanksData.fromJson(Map<String, dynamic> json) {
    return MyRanksData(
      xp: RankInfo.fromJson(json['xp'] ?? {}),
      streak: RankInfo.fromJson(json['streak'] ?? {}),
      stats: LearningStats.fromJson(json['stats'] ?? {}),
    );
  }
}

class RankInfo {
  final int? rank;
  final int total;
  final int value;

  RankInfo({this.rank, required this.total, required this.value});

  factory RankInfo.fromJson(Map<String, dynamic> json) {
    return RankInfo(
      rank: json['rank'],
      total: json['total'] ?? 0,
      value: json['value'] ?? 0,
    );
  }
}

class LearningStats {
  final int totalXP;
  final int currentStreak;
  final int longestStreak;
  final int level;
  final int streakFreezes;

  LearningStats({
    required this.totalXP,
    required this.currentStreak,
    required this.longestStreak,
    required this.level,
    required this.streakFreezes,
  });

  factory LearningStats.fromJson(Map<String, dynamic> json) {
    return LearningStats(
      totalXP: json['totalXP'] ?? 0,
      currentStreak: json['currentStreak'] ?? 0,
      longestStreak: json['longestStreak'] ?? 0,
      level: json['level'] ?? 1,
      streakFreezes: json['streakFreezes'] ?? 0,
    );
  }
}

// ============================================
// MATCHING MODELS
// ============================================

class MatchingResponse {
  final bool success;
  final int count;
  final List<MatchRecommendation> data;
  final bool cached;

  MatchingResponse({
    required this.success,
    required this.count,
    required this.data,
    this.cached = false,
  });

  factory MatchingResponse.fromJson(Map<String, dynamic> json) {
    return MatchingResponse(
      success: json['success'] ?? false,
      count: json['count'] ?? 0,
      data: (json['data'] as List?)
          ?.map((e) => MatchRecommendation.fromJson(e))
          .toList() ?? [],
      cached: json['cached'] ?? false,
    );
  }
}

class MatchRecommendation {
  final String odId;
  final String name;
  final String? username;
  final String? avatar;
  final List<String> images;
  final String? bio;
  final String nativeLanguage;
  final String languageToLearn;
  final String? languageLevel;
  final MatchLocation? location;
  final DateTime? lastActive;
  final double matchScore;
  final List<String> matchReasons;
  final bool isOnline;

  MatchRecommendation({
    required this.odId,
    required this.name,
    this.username,
    this.avatar,
    required this.images,
    this.bio,
    required this.nativeLanguage,
    required this.languageToLearn,
    this.languageLevel,
    this.location,
    this.lastActive,
    required this.matchScore,
    required this.matchReasons,
    required this.isOnline,
  });

  factory MatchRecommendation.fromJson(Map<String, dynamic> json) {
    return MatchRecommendation(
      odId: json['_id']?.toString() ?? '',
      name: json['name'] ?? '',
      username: json['username'],
      avatar: json['avatar'],
      images: (json['images'] as List?)?.map((e) => e.toString()).toList() ?? [],
      bio: json['bio'],
      nativeLanguage: json['native_language'] ?? '',
      languageToLearn: json['language_to_learn'] ?? '',
      languageLevel: json['languageLevel'],
      location: json['location'] != null
          ? MatchLocation.fromJson(json['location'])
          : null,
      lastActive: json['lastActive'] != null
          ? DateTime.tryParse(json['lastActive'])
          : null,
      matchScore: (json['matchScore'] ?? 0).toDouble(),
      matchReasons: (json['matchReasons'] as List?)
          ?.map((e) => e.toString())
          .toList() ?? [],
      isOnline: json['isOnline'] ?? false,
    );
  }
}

class MatchLocation {
  final String? city;
  final String? country;

  MatchLocation({this.city, this.country});

  factory MatchLocation.fromJson(Map<String, dynamic> json) {
    return MatchLocation(
      city: json['city'],
      country: json['country'],
    );
  }

  String get displayName {
    if (city != null && country != null) return '$city, $country';
    return country ?? city ?? '';
  }
}
```

---

## Leaderboard Feature

### API Usage

#### Get XP Leaderboard

```dart
// Query Parameters:
// - period: 'all' | 'weekly' | 'monthly' (default: 'all')
// - language: string (optional, filter by language)
// - limit: number (default: 50)
// - offset: number (default: 0)

Future<LeaderboardResponse> getXPLeaderboard({
  String period = 'all',
  String? language,
  int limit = 50,
  int offset = 0,
}) async {
  final queryParams = {
    'period': period,
    if (language != null) 'language': language,
    'limit': limit.toString(),
    'offset': offset.toString(),
  };

  final response = await dio.get(
    '/api/v1/leaderboard/xp',
    queryParameters: queryParams,
  );

  return LeaderboardResponse.fromJson(response.data);
}
```

#### Get Streak Leaderboard

```dart
// Query Parameters:
// - type: 'current' | 'longest' (default: 'current')
// - limit: number (default: 50)
// - offset: number (default: 0)

Future<LeaderboardResponse> getStreakLeaderboard({
  String type = 'current',
  int limit = 50,
  int offset = 0,
}) async {
  final response = await dio.get(
    '/api/v1/leaderboard/streaks',
    queryParameters: {
      'type': type,
      'limit': limit.toString(),
      'offset': offset.toString(),
    },
  );

  return LeaderboardResponse.fromJson(response.data);
}
```

#### Get Friends Leaderboard

```dart
// Query Parameters:
// - type: 'xp' | 'streak' (default: 'xp')

Future<LeaderboardResponse> getFriendsLeaderboard({
  String type = 'xp',
}) async {
  final response = await dio.get(
    '/api/v1/leaderboard/friends',
    queryParameters: {'type': type},
  );

  return LeaderboardResponse.fromJson(response.data);
}
```

#### Get My Ranks

```dart
Future<MyRanksResponse> getMyRanks() async {
  final response = await dio.get('/api/v1/leaderboard/me');
  return MyRanksResponse.fromJson(response.data);
}
```

### Sample Response: XP Leaderboard

```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "user": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "username": "johndoe",
        "avatar": "https://cdn.example.com/avatar1.jpg",
        "country": "USA",
        "nativeLanguage": "English",
        "learningLanguage": "Korean",
        "totalXP": 15420,
        "currentStreak": 45,
        "level": 16
      }
    ],
    "total": 1250,
    "period": "weekly",
    "language": "all",
    "myRank": {
      "rank": 127,
      "value": 2340
    }
  }
}
```

---

## Smart Matching Feature

### API Usage

#### Get Recommendations

```dart
// Query Parameters:
// - limit: number (default: 20)
// - refresh: boolean (default: false) - set true to bypass cache

Future<MatchingResponse> getRecommendations({
  int limit = 20,
  bool refresh = false,
}) async {
  final response = await dio.get(
    '/api/v1/matching/recommendations',
    queryParameters: {
      'limit': limit.toString(),
      'refresh': refresh.toString(),
    },
  );

  return MatchingResponse.fromJson(response.data);
}
```

#### Get Quick Matches (Online Users)

```dart
// Query Parameters:
// - limit: number (default: 10)

Future<MatchingResponse> getQuickMatches({int limit = 10}) async {
  final response = await dio.get(
    '/api/v1/matching/quick',
    queryParameters: {'limit': limit.toString()},
  );

  return MatchingResponse.fromJson(response.data);
}
```

#### Find by Language

```dart
// Path Parameters:
// - language: string (e.g., 'Korean', 'English')
//
// Query Parameters:
// - type: 'native' | 'learning' (default: 'native')
// - limit: number (default: 30)
// - offset: number (default: 0)

Future<MatchingResponse> findByLanguage(
  String language, {
  String type = 'native',
  int limit = 30,
  int offset = 0,
}) async {
  final response = await dio.get(
    '/api/v1/matching/language/$language',
    queryParameters: {
      'type': type,
      'limit': limit.toString(),
      'offset': offset.toString(),
    },
  );

  return MatchingResponse.fromJson(response.data);
}
```

#### Get Similar Users

```dart
// Path Parameters:
// - userId: string
//
// Query Parameters:
// - limit: number (default: 10)

Future<MatchingResponse> getSimilarUsers(
  String userId, {
  int limit = 10,
}) async {
  final response = await dio.get(
    '/api/v1/matching/similar/$userId',
    queryParameters: {'limit': limit.toString()},
  );

  return MatchingResponse.fromJson(response.data);
}
```

### Sample Response: Recommendations

```json
{
  "success": true,
  "count": 20,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Min-ji Kim",
      "username": "minji_kr",
      "avatar": "https://cdn.example.com/avatar.jpg",
      "images": [
        "https://cdn.example.com/img1.jpg",
        "https://cdn.example.com/img2.jpg"
      ],
      "bio": "Learning English, happy to help with Korean!",
      "native_language": "Korean",
      "language_to_learn": "English",
      "languageLevel": "B2",
      "location": {
        "city": "Seoul",
        "country": "South Korea"
      },
      "lastActive": "2024-01-15T10:30:00.000Z",
      "matchScore": 65.3,
      "matchReasons": [
        "Perfect language exchange partner",
        "Online now"
      ],
      "isOnline": true
    }
  ],
  "cached": false
}
```

---

## Push Notifications

### New Notification Types

Handle these notification types for deep linking:

| Type | Action | Screen |
|------|--------|--------|
| `streak_reminder` | User's streak is at risk | Learning/Home |
| `daily_reminder` | Daily practice reminder | Learning/Home |
| `level_up` | User leveled up | Profile (show celebration) |
| `achievement` | Achievement unlocked | Achievements |
| `leaderboard_update` | Rank changed significantly | Leaderboard |

### Notification Handler Example

```dart
void handleNotification(RemoteMessage message) {
  final type = message.data['type'];

  switch (type) {
    case 'streak_reminder':
    case 'daily_reminder':
      // Navigate to learning screen
      Navigator.pushNamed(context, '/learning');
      break;

    case 'level_up':
      final level = int.tryParse(message.data['level'] ?? '');
      // Show celebration animation
      showLevelUpCelebration(level);
      // Then navigate to profile
      Navigator.pushNamed(context, '/profile');
      break;

    case 'achievement':
      final achievement = message.data['achievement'];
      // Navigate to achievements screen
      Navigator.pushNamed(
        context,
        '/achievements',
        arguments: {'highlight': achievement},
      );
      break;

    default:
      // Default handling
      break;
  }
}
```

---

## UI Components

### Leaderboard Entry Widget

```dart
class LeaderboardEntryTile extends StatelessWidget {
  final LeaderboardEntry entry;
  final String valueType; // 'xp' or 'streak'

  const LeaderboardEntryTile({
    required this.entry,
    this.valueType = 'xp',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: entry.isMe ? Colors.yellow.withOpacity(0.1) : null,
        border: Border(
          bottom: BorderSide(color: Colors.grey.shade200),
        ),
      ),
      child: Row(
        children: [
          // Rank
          SizedBox(
            width: 40,
            child: Text(
              _getRankDisplay(entry.rank),
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: entry.rank <= 3 ? 18 : 14,
                color: _getRankColor(entry.rank),
              ),
            ),
          ),

          // Avatar
          CircleAvatar(
            radius: 24,
            backgroundImage: entry.avatar != null
                ? NetworkImage(entry.avatar!)
                : null,
            child: entry.avatar == null
                ? Text(entry.name[0].toUpperCase())
                : null,
          ),

          SizedBox(width: 12),

          // Name and info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.name,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                  ),
                ),
                if (entry.country != null)
                  Text(
                    entry.country!,
                    style: TextStyle(
                      color: Colors.grey,
                      fontSize: 12,
                    ),
                  ),
              ],
            ),
          ),

          // Value (XP or Streak)
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                valueType == 'xp'
                    ? '${_formatNumber(entry.totalXP)} XP'
                    : '${entry.streakDays ?? entry.currentStreak} days',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: Theme.of(context).primaryColor,
                ),
              ),
              Text(
                'Level ${entry.level}',
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _getRankDisplay(int rank) {
    if (rank == 1) return '🥇';
    if (rank == 2) return '🥈';
    if (rank == 3) return '🥉';
    return '#$rank';
  }

  Color _getRankColor(int rank) {
    if (rank == 1) return Colors.amber;
    if (rank == 2) return Colors.grey;
    if (rank == 3) return Colors.brown;
    return Colors.black;
  }

  String _formatNumber(int number) {
    if (number >= 1000000) {
      return '${(number / 1000000).toStringAsFixed(1)}M';
    }
    if (number >= 1000) {
      return '${(number / 1000).toStringAsFixed(1)}K';
    }
    return number.toString();
  }
}
```

### Match Card Widget

```dart
class MatchCard extends StatelessWidget {
  final MatchRecommendation match;
  final VoidCallback? onTap;
  final VoidCallback? onMessage;

  const MatchCard({
    required this.match,
    this.onTap,
    this.onMessage,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // Avatar with online indicator
                  Stack(
                    children: [
                      CircleAvatar(
                        radius: 32,
                        backgroundImage: match.avatar != null
                            ? NetworkImage(match.avatar!)
                            : null,
                        child: match.avatar == null
                            ? Text(match.name[0].toUpperCase())
                            : null,
                      ),
                      if (match.isOnline)
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              color: Colors.green,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.white,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),

                  SizedBox(width: 16),

                  // Name and languages
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          match.name,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                        SizedBox(height: 4),
                        Row(
                          children: [
                            _languageChip(
                              match.nativeLanguage,
                              'Native',
                              Colors.blue,
                            ),
                            SizedBox(width: 8),
                            _languageChip(
                              match.languageToLearn,
                              'Learning',
                              Colors.green,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Bio
              if (match.bio != null && match.bio!.isNotEmpty) ...[
                SizedBox(height: 12),
                Text(
                  match.bio!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: Colors.grey[700]),
                ),
              ],

              // Match reasons
              if (match.matchReasons.isNotEmpty) ...[
                SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: match.matchReasons.map((reason) {
                    return Chip(
                      label: Text(
                        reason,
                        style: TextStyle(fontSize: 12),
                      ),
                      backgroundColor: Colors.purple.withOpacity(0.1),
                      padding: EdgeInsets.zero,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    );
                  }).toList(),
                ),
              ],

              // Location and action
              SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (match.location != null)
                    Row(
                      children: [
                        Icon(Icons.location_on, size: 16, color: Colors.grey),
                        SizedBox(width: 4),
                        Text(
                          match.location!.displayName,
                          style: TextStyle(color: Colors.grey),
                        ),
                      ],
                    ),

                  ElevatedButton.icon(
                    onPressed: onMessage,
                    icon: Icon(Icons.chat_bubble_outline, size: 18),
                    label: Text('Message'),
                    style: ElevatedButton.styleFrom(
                      padding: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _languageChip(String language, String label, Color color) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        language,
        style: TextStyle(
          fontSize: 12,
          color: color,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
```

---

## Implementation Priority

| Priority | Feature | Effort | Description |
|----------|---------|--------|-------------|
| **P0** | Leaderboard Screen | Medium | XP leaderboard with period tabs |
| **P0** | My Rank Card | Low | Show user's rank on profile |
| **P1** | Partner Recommendations | Medium | Main discovery screen |
| **P1** | Quick Matches | Low | "Online Now" section |
| **P2** | Streak Leaderboard | Low | Add tab to leaderboard |
| **P2** | Friends Leaderboard | Low | Add tab to leaderboard |
| **P2** | Notification Deep Links | Low | Handle new notification types |
| **P3** | Language Browser | Medium | Browse by language screen |
| **P3** | Similar Users | Low | "More like this" on profiles |

---

## Screen Navigation Structure

```
App
├── Home Tab
│   └── Quick Matches Section (horizontal scroll)
│
├── Discover Tab
│   ├── Recommendations (default)
│   ├── Online Now
│   └── Browse by Language
│
├── Leaderboard Tab
│   ├── XP (with Weekly/Monthly/All-Time tabs)
│   ├── Streaks
│   └── Friends
│
└── Profile Tab
    └── My Rank Card
        ├── XP Rank: #127 of 1,250
        └── Streak Rank: #45 of 890
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Handle common errors:

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Unauthorized | Redirect to login |
| 404 | Not found | Show "User not found" message |
| 429 | Rate limited | Show "Please wait" message |
| 500 | Server error | Show generic error, retry |

---

## Caching Recommendations

- **Leaderboards**: Cache for 1-2 minutes (data updates every few minutes)
- **My Ranks**: Cache for 30 seconds
- **Recommendations**: Cache until user explicitly refreshes
- **Quick Matches**: Don't cache (real-time online status)
