/**
 * Yellowstone gRPC streaming belongs here (separate from Vercel).
 *
 * Typical stack:
 * - `@triton-one/yellowstone-grpc` client subscribed to Meteora LBCLMM program / pool accounts
 * - Push swap events into the same evaluation pipeline as the polling worker
 *
 * This repo ships a polling MVP so you can validate DLMM quotes end-to-end before investing in gRPC plumbing.
 */

export const STREAMING_NOTE =
  'Wire Yellowstone/Triton gRPC in this package on a dedicated host; Vercel cannot hold long-lived streams.'
