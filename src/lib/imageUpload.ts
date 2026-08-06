/**
 * Client-side raw byte ceiling for any image sent as a base64 JSON body
 * (assistant chat attachments, statement screenshots, receipt photos).
 *
 * Base64 inflates size by ~4/3, and Vercel serverless functions cap request
 * bodies at ~4.5MB — a photo anywhere near that raw size fails at the
 * platform level with an opaque network error before our own validation, or
 * even the AI call, ever runs. That's indistinguishable from "uploads are
 * broken" to a user staring at a generic error. Staying well under the
 * ceiling turns a silent platform rejection into a clear "too big, try a
 * smaller one" message instead.
 */
export const MAX_UPLOAD_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB raw ≈ 4.2MB base64 + JSON overhead
