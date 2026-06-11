import { PostHog } from 'posthog-node';
import 'server-only';

let posthogClient: PostHog | null = null;

/**
 * Server-side PostHog client (singleton). Use for capturing events from API routes,
 * server actions, and webhooks. Flushes immediately in dev for visibility.
 */
export function getPostHogServer(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      flushAt: process.env.NODE_ENV === 'development' ? 1 : 20,
      flushInterval: 10000,
    });
  }

  return posthogClient;
}
