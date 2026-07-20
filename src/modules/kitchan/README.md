# Kitchan Module

Backend APIs for the Kitchen/Groceries flow shown in Figma. The public route prefix is `/kitchen`.

## File Map

- `kitchan.controller.ts` - HTTP routes grouped by recipe, inventory, shopping list, voucher, order, and payment flow.
- `kitchan.service.ts` - business rules, Prisma queries, permission checks, audit logs, and Stripe Checkout session creation.
- `kitchan.module.ts` - Nest module registration.
- `constants/` - shared enum option arrays used by DTO validation and Swagger docs.
- `dto/` - request DTOs split by feature area.
- `types/` - local module-only TypeScript types.

## Main Flow

1. Parent or nanny views recipes and recipe details.
2. App checks missing ingredients against child inventory.
3. Nanny/parent adds missing items to shopping list.
4. Nanny creates voucher and sends it to parent/store.
5. Parent confirms payment or creates a Stripe Checkout session.
6. Parent/nanny tracks and confirms grocery delivery.

