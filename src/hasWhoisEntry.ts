// @ts-ignore: no type definitions
import whois = require('whois');
import { RateLimitExceededError } from './RateLimitExceededError';

export interface HasWhoisEntryOptions {
  // SOCKS proxy, "<IP>:<PORT>" default: none
  proxy: string | null;
  // Connection timeout, default: 3000
  timeout: number;
  // Maximum number of retries, default: 2
  maxRetries: number;
  // Time to retry, when rate limit hit, default: 3000
  retryTime: number;
}

export function hasWhoisEntry(domain: string, options?: Partial<HasWhoisEntryOptions>): Promise<boolean> {
  // Configure
  const proxy = options?.proxy ?? null;
  const timeout = options?.timeout ?? 3000;
  const retryTime = options?.retryTime ?? 3000;
  const maxRetries = options?.maxRetries ?? 2;
  const retryOptions = { ...options, maxRetries: maxRetries - 1 };

  // Get information
  return new Promise((resolve, reject) => {
    whois.lookup(domain, { timeout, proxy, follow: 0, verbose: true }, (error: any, items: any) => {
      // Extract WHOIS response
      const data = (items?.[0]?.data || '').toLowerCase();

      // Determine domain state
      if (data.includes('domain name:')) {
        resolve(true);
      } else if (data.includes('rate limit')) {
        if (data.includes('try again') && maxRetries > 0) {
          setTimeout(() => resolve(hasWhoisEntry(domain, retryOptions)), retryTime);
        } else {
          reject(new RateLimitExceededError('Rate limit exceeded.'));
        }
      } else if (error) {
        // It could be just small connection problem
        if (maxRetries > 0) {
          resolve(hasWhoisEntry(domain, retryOptions));
        } else {
          reject(error);
        }
      } else {
        resolve(false);
      }
    });
  });
}
