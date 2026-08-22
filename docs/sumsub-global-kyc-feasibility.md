# Sumsub Global KYC Feasibility

Last reviewed: August 22, 2026

## Sources

- Sumsub Get started with WebSDK: https://docs.sumsub.com/docs/get-started-with-web-sdk
- Sumsub Web and Mobile SDK customization: https://docs.sumsub.com/docs/sdk-customization
- Sumsub About WebSDK: https://docs.sumsub.com/docs/about-web-sdk
- Sumsub About MobileSDK: https://docs.sumsub.com/docs/about-mobile-sdk
- Sumsub Create applicant: https://docs.sumsub.com/reference/create-applicant
- Sumsub Add verification documents: https://docs.sumsub.com/reference/add-verification-documents
- Sumsub Request applicant check: https://docs.sumsub.com/reference/request-applicant-check
- Sumsub Get status of verification steps: https://docs.sumsub.com/reference/get-status-of-verification-steps
- Sumsub Webhook manager: https://docs.sumsub.com/docs/webhook-manager
- Sumsub User verification webhooks: https://docs.sumsub.com/docs/user-verification-webhooks
- Sumsub Supported documents and countries: https://docs.sumsub.com/docs/supported-documents-and-countries
- Sumsub FAQ: https://docs.sumsub.com/page/faq
- Sumsub Create applicant action: https://docs.sumsub.com/reference/create-applicant-action
- Sumsub Non-Doc Identity Verification: https://docs.sumsub.com/docs/non-doc-identity-verification

## Feasibility Table

| Requirement | Fully Custom UI Possible? | REST API | WebSDK Required? | Mobile SDK Required? | Notes |
| --- | --- | --- | --- | --- | --- |
| Country selection | Yes | No direct public capability-discovery endpoint found | No | No | Merchant UI can collect ISO alpha-3 country codes. Actual acceptance depends on Sumsub supported documents and verification-level configuration. |
| Document selection | Mostly | Partial | No | No | Merchant UI can present categories. Exact country-specific support is configured in Sumsub levels and supported-docs settings, not fully exposed by a public runtime endpoint in the docs reviewed. |
| Passport | Yes | Yes | No | No | Can be uploaded through `POST /resources/applicants/{applicantId}/info/idDoc`. |
| National ID | Yes | Yes | No | No | Use REST upload with front/back where required. |
| ID Card | Yes | Yes | No | No | Same REST upload path as other identity documents. |
| Driver's License | Yes | Yes | No | No | Supported through REST document upload using Sumsub document metadata. |
| Residence Permit | Yes | Yes | No | No | Supported through REST document upload when enabled in the level. |
| Document upload | Yes | Yes | No | No | Merchant can fully own upload UI and send files through backend to Sumsub. |
| Document camera | Mostly | Backend receives file only | No | No | Merchant can build the camera UI, but Sumsub only receives the resulting file payload via REST. |
| OCR | No | Processed by Sumsub after upload | No | No | OCR is Sumsub-side processing, not a merchant-side custom implementation. |
| Document authenticity | No | Processed by Sumsub after upload | No | No | Authenticity checks happen inside Sumsub after submission. |
| Selfie capture | No | Not documented as a fully custom biometric REST replacement | Yes | Mobile SDK if native app | Official biometric capture is SDK-driven. |
| Liveness | No | No documented REST-only replacement found | Yes | Mobile SDK if native app | Sumsub docs position liveness inside WebSDK/MobileSDK or applicant actions. |
| Face Match | No | No documented REST-only replacement found | Yes | Mobile SDK if native app | Sumsub performs the biometric comparison, but capture and orchestration require SDK/action flow. |
| Verification result | Yes | Yes | No | No | Merchant UI can fully own pending/success/reject screens using status endpoints and webhooks. |
| Webhook | Yes | Yes | No | No | Merchant backend handles webhook receipt and signature validation with `x-payload-digest` and raw body. |

## Practical Conclusion

The maximum-custom approach supported by the reviewed official docs is:

1. Use your own UI for country selection, document selection, instructions, document capture/upload, preview, retry, progress, pending, success, and rejection states.
2. Use your backend plus Sumsub REST API for applicant creation, access-token generation, document upload, requesting review, polling status, and webhook synchronization.
3. Use Sumsub WebSDK 2.0 or MobileSDK only for liveness and face-match steps, typically through an applicant action flow when you want to keep document upload custom.

## Non-Doc Identity Verification

Sumsub documents a separate Non-Doc Identity Verification product. It is not a generic replacement for documentary KYC across all countries. Availability, input fields, and whether API or manual flow is supported vary by market and product. Treat it as an optional market-specific extension, not the default global identity flow.
