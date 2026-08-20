# Notification Manual Test Guide

Current scope:

- Flutter app: `PARENT`, `NANNY`
- Web app: `ADMIN`, `PARTNER`

This guide verifies:

- DB notification creation
- REST notification list/read/delete
- realtime socket delivery
- language-aware realtime delivery
- mobile FCM push path
- broadcast notifications

## Prerequisites

Set these env vars before testing:

```bash
JWT_SECRET=
GOOGLE_TRANSLATE_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=
```

If you use a service account file instead of inline JSON:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
FIREBASE_PROJECT_ID=
```

Start backend:

```bash
npm run start:dev
```

## Test Users

Prepare at least these users:

1. `admin_user`
2. `partner_user`
3. `parent_user`
4. `nanny_user`

Make sure:

- all users are `ACTIVE`
- each user can log in
- parent/nanny mobile apps can register device tokens

## API Smoke Test

### 1. Register device token

Login as `parent_user` or `nanny_user`, then call:

```http
POST /api/v1/notifications/device-token
Authorization: Bearer <mobile_user_jwt>
Content-Type: application/json

{
  "fcmToken": "REAL_FCM_TOKEN_FROM_DEVICE",
  "deviceType": "ANDROID"
}
```

Expected:

- success response
- row created in `user_device_tokens`

### 2. Create a test notification

Login as admin and call:

```http
POST /api/v1/notifications/send-test
Authorization: Bearer <admin_jwt>
Content-Type: application/json

{
  "userId": "<parent_or_nanny_user_id>",
  "type": "NEW_MESSAGE",
  "title": "Test Notification",
  "message": "This is a notification test",
  "iconType": "CHAT",
  "actionText": "Open Chat",
  "actionUrl": "/mobile-messages.html?conversationId=test"
}
```

Expected:

- notification row saved in DB
- unread count increases
- realtime socket event fires if user is connected
- mobile device receives push if Firebase credentials + real FCM token are valid

### 3. Fetch notifications

```http
GET /api/v1/notifications?page=1&limit=20
Authorization: Bearer <target_user_jwt>
```

Expected:

- `items` contains created notification
- `groups.today` contains notification if created today
- `meta.unreadCount` is correct

### 4. Mark single notification as read

```http
PATCH /api/v1/notifications/<notification_id>/read
Authorization: Bearer <target_user_jwt>
```

Expected:

- `isRead = true` in DB
- unread count decreases
- realtime `notification:read` and `notification:unread_count` events fire

### 5. Mark all notifications as read

```http
PATCH /api/v1/notifications/read-all
Authorization: Bearer <target_user_jwt>
```

Expected:

- all target user notifications become read
- unread count becomes `0`
- realtime `notification:read_all` and `notification:unread_count` fire

### 6. Delete notification

```http
DELETE /api/v1/notifications/<notification_id>
Authorization: Bearer <target_user_jwt>
```

Expected:

- DB record removed
- realtime `notification:deleted` fires
- unread count updates

## Broadcast Test

Login as `admin_user` or `partner_user`:

```http
POST /api/v1/notifications/broadcast
Authorization: Bearer <admin_or_partner_jwt>
Content-Type: application/json

{
  "targetRoles": ["PARENT", "NANNY"],
  "type": "PARTNER_OFFER",
  "title": "Offer Test",
  "message": "Broadcast test for parent and nanny",
  "iconType": "GIFT",
  "actionText": "View Offer",
  "actionUrl": "/offers/test"
}
```

Expected:

- notifications created only for target roles
- parent/nanny realtime sockets receive `notification:new`
- parent/nanny mobile devices receive push

## Socket Test

Namespace:

```text
/notifications
```

Socket auth:

```json
{
  "token": "<user_jwt>",
  "language": "ar"
}
```

### Required client events

On connect, send:

```json
event: register_user
payload: {
  "userId": "<same_user_id_as_jwt>",
  "language": "ar"
}
```

When language tab changes, send:

```json
event: setLanguage
payload: {
  "language": "en"
}
```

### Expected incoming socket events

- `notification:new`
- `notification:unread_count`
- `notification:read`
- `notification:read_all`
- `notification:deleted`

## Language Test

### Realtime language test

1. Connect `parent_user` socket with language `ar`
2. Send test notification from admin
3. Confirm `notification:new.title` and `notification:new.message` arrive in Arabic

Then:

1. Send `setLanguage` with `en`
2. Send another test notification
3. Confirm next realtime notification arrives in English

### REST language test

Call:

```http
GET /api/v1/notifications
Authorization: Bearer <target_user_jwt>
x-language: ar
```

Expected:

- response wrapper fields may translate through global translation flow
- plain text notification data should appear translated where applicable

## FCM Push Pass Criteria

Push is considered working only if all are true:

1. backend logs no Firebase credential error
2. API returns success
3. physical device receives the push
4. tapping the push opens the intended route in app

## Failure Checklist

If push does not arrive:

1. verify `FIREBASE_PROJECT_ID`
2. verify `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
3. verify the device token is real and current
4. verify Firebase project matches the app token source
5. verify mobile app notification permission is granted
6. inspect backend logs for FCM init/send error

If socket does not work:

1. confirm namespace is `/notifications`
2. confirm JWT is sent in socket auth
3. confirm `register_user.userId` matches JWT user id
4. confirm client listens for `notification:new`

## Final Pass Condition

Notification module can be treated as fully verified only when:

1. test notification works for one parent device
2. test notification works for one nanny device
3. admin broadcast works
4. partner broadcast works
5. Arabic socket notification works
6. English socket notification works after `setLanguage`
7. read/delete/read-all realtime sync works
