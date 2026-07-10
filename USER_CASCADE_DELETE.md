# User Cascade Delete Feature

## Overview
When a user deletes their account, all associated data is automatically deleted to ensure complete data removal and GDPR compliance.

## What Gets Deleted

### Direct User Content (Created by user)
- ✅ **Moments** - All moments/posts created by the user
- ✅ **Stories** - All stories created by the user
- ✅ **Comments** - All comments written by the user
- ✅ **Messages** - All messages sent by the user
- ✅ **Challenges** - All challenges created by the user
- ✅ **Polls** - All polls created by the user
- ✅ **Voice Rooms** - All voice rooms hosted by the user
- ✅ **Reports** - All reports filed by the user
- ✅ **AI Conversations** - All AI conversation sessions with the user
- ✅ **Study Plans** - All study plans created for the user
- ✅ **User Achievements** - All achievements earned by the user
- ✅ **Learning Progress** - All learning progress tracked for the user
- ✅ **Profile Images** - All profile pictures and images from S3/Spaces

### Relational Data (Where user is a participant)
- ✅ **Conversations** - All conversations where user is a participant
- ✅ **Calls** - All calls initiated or received by the user
- ✅ **Notifications** - All notifications sent to the user
- ✅ **Profile Visits** - All profile visits made by the user
- ✅ **Conversation Activities** - All activities/interactions within conversations
- ✅ **User Interactions** - All interactions with other users (follows, blocks, etc.)

### User Account
- ✅ **User Account** - The user record itself is deleted

## Implementation Details

### Service: `userCascadeDeleteService.js`
Located at: `services/userCascadeDeleteService.js`

#### Methods:

**1. `deleteUserAndAllData(userId)`**
- Performs complete cascade deletion
- Returns detailed deletion statistics
- Handles all 20+ data types
- Atomic operation within service (individual operations may fail)

**2. `getDelectionSummary(userId)` (Preview)**
- Shows what would be deleted without actually deleting
- Useful for confirmation dialogs
- Returns count of each data type

**3. `removeUserReferencesOnly(userId)` (Soft Delete)**
- Removes user from arrays (likes, saved, participants, etc.)
- Keeps parent documents intact
- Useful for privacy without full deletion

### Controller Updates

**1. User Deletion (`DELETE /api/v1/users/:id`)**
- User can delete their own account
- Admin can delete any user account
- Returns deletion statistics in response

**2. Admin Hard Delete (`DELETE /api/v1/admin/users/:id`)**
- Requires admin permission
- Also blacklists user to prevent re-registration
- Returns detailed deletion statistics

## API Response Example

```json
{
  "success": true,
  "message": "User account and all associated data deleted successfully",
  "data": {
    "success": true,
    "message": "User and all associated data deleted successfully",
    "stats": {
      "user": 1,
      "moments": 12,
      "messages": 45,
      "conversations": 3,
      "comments": 8,
      "stories": 2,
      "notifications": 28,
      "calls": 5,
      "challenges": 1,
      "reports": 0,
      "voiceRooms": 0,
      "polls": 1,
      "interactions": 15,
      "profileVisits": 22,
      "aiConversations": 6,
      "achievements": 3,
      "studyPlans": 2,
      "learningProgress": 10,
      "conversationActivities": 8,
      "otherReferences": 0
    }
  }
}
```

## Compliance & Safety

### GDPR Compliance
- ✅ User right to be forgotten (deletion of personal data)
- ✅ Complete removal of user content
- ✅ No orphaned references to deleted users
- ✅ Detailed audit trail (shows what was deleted)

### Data Integrity
- ✅ No orphaned moments from deleted users
- ✅ Conversations cleaned of deleted participants
- ✅ User references removed from interaction records
- ✅ Notifications cleaned up

### Performance
- All deletions use MongoDB bulk operations (`deleteMany`, `updateMany`)
- Parallel deletion of independent data types via `Promise.all()`
- No N+1 queries
- Efficient indexing on `user` field used throughout

## Future Enhancements

Optional soft-delete approaches:
1. **Archive instead of delete** - Keep user data for archival purposes
2. **Anonymization** - Replace user info with anonymous data
3. **Delayed deletion** - 30-day grace period before actual deletion
4. **Selective deletion** - User chooses what data to delete
5. **Export before deletion** - User can download their data first

## Testing

To preview what will be deleted before actual deletion:

```javascript
const service = require('./services/userCascadeDeleteService');
const summary = await service.getDelectionSummary(userId);
console.log(summary);
```

To perform actual deletion:

```javascript
const result = await service.deleteUserAndAllData(userId);
console.log(result.stats);
```
