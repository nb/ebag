import type { Config, Session } from './types';
import { requestEbag } from './client';

export function getLoginInstructions() {
  return [
    '1) Log in to https://www.ebag.bg in your browser.',
    '2) Open DevTools > Network and click any request to https://www.ebag.bg (not a static asset).',
    '3) In the request headers, copy the full Cookie header value (semicolon-separated).',
    '4) Run: ebag login --cookie "<cookie>"',
  ].join('\n');
}

export async function validateSession(config: Config, session: Session) {
  const result = await requestEbag(config, session, '/user/json');
  return result.data;
}
