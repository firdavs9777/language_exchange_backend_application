# Email Preferences - Frontend Guide

Quick guide for implementing email notification settings in the frontend.

---

## API Endpoint

```javascript
PUT /api/v1/auth/updatedetails
Authorization: Bearer <token>

Body:
{
  "privacySettings": {
    "emailNotifications": true,     // Master switch
    "weeklyDigest": true,           // Weekly activity summary
    "newMessageEmails": true,       // New message alerts (when inactive 24h+)
    "newFollowerEmails": true,      // New follower notifications
    "securityAlerts": true          // Password changes, new logins
  }
}
```

---

## Settings UI

| Setting | Description | Default |
|---------|-------------|---------|
| `emailNotifications` | Master switch for all emails | `true` |
| `weeklyDigest` | Weekly activity summary (Sundays) | `true` |
| `newMessageEmails` | Alerts when receiving messages while away | `true` |
| `newFollowerEmails` | Alerts when someone follows you | `true` |
| `securityAlerts` | Password & login security alerts | `true` ⭐ Recommended |

---

## React Native Example

```tsx
const EmailPreferencesScreen = () => {
  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    weeklyDigest: true,
    newMessageEmails: true,
    newFollowerEmails: true,
    securityAlerts: true,
  });

  const updatePref = async (key, value) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    
    await api.put('/auth/updatedetails', {
      privacySettings: { [key]: value }
    });
  };

  return (
    <View>
      <Toggle
        label="Email Notifications"
        value={prefs.emailNotifications}
        onChange={(v) => updatePref('emailNotifications', v)}
      />
      
      {prefs.emailNotifications && (
        <>
          <Toggle
            label="Weekly Summary"
            subtitle="Activity recap every Sunday"
            value={prefs.weeklyDigest}
            onChange={(v) => updatePref('weeklyDigest', v)}
          />
          <Toggle
            label="New Messages"
            subtitle="When you're away for 24+ hours"
            value={prefs.newMessageEmails}
            onChange={(v) => updatePref('newMessageEmails', v)}
          />
          <Toggle
            label="New Followers"
            value={prefs.newFollowerEmails}
            onChange={(v) => updatePref('newFollowerEmails', v)}
          />
          <Toggle
            label="Security Alerts"
            subtitle="Recommended"
            value={prefs.securityAlerts}
            onChange={(v) => updatePref('securityAlerts', v)}
          />
        </>
      )}
    </View>
  );
};
```

---

## UI Layout

```
┌─────────────────────────────────┐
│ ⬅️  Email Preferences           │
├─────────────────────────────────┤
│                                 │
│ ✉️  Email Notifications    [🔵] │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 📊 Weekly Summary          [🔵] │
│    Activity recap on Sundays    │
│                                 │
│ 💬 New Messages            [⚪] │
│    When you're away 24h+        │
│                                 │
│ 👤 New Followers           [🔵] │
│                                 │
│ 🔒 Security Alerts    ⭐   [🔵] │
│    Password & login alerts      │
│                                 │
└─────────────────────────────────┘
```

---

## Notes

- When master switch is OFF, hide all other toggles
- Security Alerts should show "Recommended" badge
- All emails respect user preferences automatically
- No other frontend changes needed - backend handles everything!

