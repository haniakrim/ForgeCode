# FORGE Auth Testing Playbook

## Overview
- Uses Emergent Google OAuth via `https://auth.emergentagent.com/`
- Backend exchanges `session_id` for `session_token` via `POST /api/auth/session` (header `X-Session-ID`)
- Frontend stores auth via httpOnly cookie `session_token`
- Backend also accepts `Authorization: Bearer <session_token>` as fallback

## Manual Testing (bypass Google)

### 1. Seed user + session in MongoDB
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@forge.dev',
  name: 'Test Forger',
  picture: 'https://via.placeholder.com/150',
  credits: 100,
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('session_token=' + sessionToken);
print('user_id=' + userId);
"
```

### 2. Test endpoints
```bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)/api
TOKEN=<paste session_token>
curl -s "$API/auth/me" -H "Authorization: Bearer $TOKEN"
curl -s "$API/projects" -H "Authorization: Bearer $TOKEN"
curl -s -X POST "$API/projects" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Test","description":"hi"}'
```

### 3. Browser playwright
```js
await page.context.addCookies([{
  name: "session_token",
  value: TOKEN,
  domain: "<your-host>",
  path: "/", httpOnly: true, secure: true, sameSite: "None"
}]);
await page.goto("<frontend-url>/dashboard");
```

## Checklist
- [x] `user_id` is custom UUID (not `_id`)
- [x] All queries use `{"_id": 0}` projection
- [x] `expires_at` timezone-aware
- [x] Cookie set with `secure=True, samesite='none', httponly=True`
- [x] AuthProvider skips `/auth/me` when `session_id` is in URL hash
- [x] `AuthCallback` uses `useRef` for idempotent processing
