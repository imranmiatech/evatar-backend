# Today Module

Backend APIs for the Today setup, day plan, activity proof, and bedtime story flow. The public route prefix is `/today`.

## File Map

- `today.controller.ts` - HTTP routes for parent setup, manual/guided day plans, nanny proof, and story playback.
- `today.service.ts` - business rules, Prisma queries, child/nanny permissions, AI-result persistence handoff, and recording metadata.
- `today.module.ts` - Nest module registration.
- `dto/` - request DTOs split by screen or workflow.
- `types/` - local module-only TypeScript types.

## Main Flow

1. Parent creates or updates child profile.
2. Parent starts guided setup or manual build.
3. AI developer posts generated activities/story into `ai-result`; this module only stores the result.
4. Nanny opens assigned child Today plan and updates activity proof/status.
5. Parent records bedtime story audio; nanny can play the story/recording when permitted.

