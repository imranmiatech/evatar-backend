<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Cloudinary Uploads

Support attachments and profile images are uploaded through `CloudinaryService`.
The application requires these environment variables:

```bash
CLOUD_NAME=
CLOUD_API_KEY=
CLOUD_API_SECRET=
```

If `/api/v1/support/upload` fails with:

```text
Cloudinary Upload Error: Server returned unexpected status code - 403
InternalServerErrorException: Failed to upload file to Cloudinary
```

check these items first:

- Confirm the cloud name, API key, and API secret were copied from the same Cloudinary account.
- Rotate the API secret if it has been committed, shared in logs, or used in local test files.
- Confirm the Cloudinary account is active and API uploads are allowed.
- If `cloudinary.api.ping()` succeeds but a signed upload still returns `403`, check Cloudinary account upload restrictions, API key permissions, billing/account state, or contact Cloudinary support.
- A raw Cloudinary response like `Request forbidden due to missing permissions (actions=["create"])` means the selected product environment/API key does not have permission to create assets.
- Restart the Nest process after changing `.env`; values are read when `CloudinaryService` starts.
- Run a signed upload test with the same environment values to isolate Cloudinary auth from the Nest endpoint.

The Cloudinary provider intentionally does not log API keys or API secrets. Startup only logs the configured cloud name.

## Translation

The backend can automatically translate JSON API responses for these supported
languages:

- `en` English
- `ar` Arabic
- `fil` Filipino
- `si` Sinhala

Recommended production provider: Google Cloud Translation API.

Set this environment variable in the backend:

```bash
GOOGLE_TRANSLATE_API_KEY=
```

Language selection order for each request:

- `x-language` header
- authenticated user's `preferredLanguage`
- default `en`

Notes:

- Default language remains English.
- The backend now uses `GOOGLE_TRANSLATE_API_KEY` as the official translation
  provider path.
- If `GOOGLE_TRANSLATE_API_KEY` is missing, translation is skipped and the
  original text is returned.

## Notifications

For real FCM push notifications, configure one of these official Firebase Admin
credential paths:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_PROJECT_ID=
```

Or:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
FIREBASE_PROJECT_ID=
```

Notes:

- Socket connections for `/notifications` now require a valid JWT token.
- Socket clients can send their selected language during connection and later
  update it with a `setLanguage` socket event.
- Invalid FCM device tokens are automatically removed after push failures.

## Messages

Parent, nanny, and family member chat is handled by the separate `MessageModule`.

REST endpoints:

- `GET /api/v1/messages/contacts`
- `GET /api/v1/messages/conversations`
- `POST /api/v1/messages/conversations`
- `GET /api/v1/messages/conversations/:conversationId/messages`
- `POST /api/v1/messages/conversations/:conversationId/messages`
- `PATCH /api/v1/messages/conversations/:conversationId/read`

Use `POST /api/v1/messages/conversations/:conversationId/messages` as the primary send endpoint. It accepts JSON for text-only messages and `multipart/form-data` for text with image/file:

- `message`: optional text
- `file`: optional image/file, up to 10MB

Allowed attachment types include common images, PDF, text, DOC, and DOCX.

Socket.IO namespace: `/messages`

Events:

- `joinUser` with `{ "userId": "..." }`
- `joinConversation` with `{ "conversationId": "...", "userId": "..." }`
- `sendMessage` with `{ "conversationId": "...", "senderId": "...", "message": "..." }`
- listen for `receiveMessage`

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
