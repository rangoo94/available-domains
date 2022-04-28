import pMap = require('p-map');
import { isDomainAvailable, IsDomainAvailableOptions } from './isDomainAvailable';

const noop = () => {};

export interface GetAvailableDomainsOptions extends IsDomainAvailableOptions {
  // How many checks may be performed in parallel, default: 30
  concurrency: number;
  // Alternative callback to get information immediately about each domain
  onStatus: (domain: string, available: boolean, finishedCount: number) => void;
  // Alternative callback to get error information immediately
  onError: (domain: string, error: Error, finishedCount: number) => void;
}

export async function getAvailableDomains(domains: string[], options?: Partial<GetAvailableDomainsOptions>): Promise<string[]> {
  // Configure
  const concurrency = options?.concurrency ?? 30;
  const onStatus = options?.onStatus ?? noop;
  const onError = options?.onError ?? noop;

  // Set-up results
  const availableDomains: string[] = [];
  let finishedCount = 0;

  // Set-up procedure
  async function run(domain: string): Promise<void> {
    try {
      const available = await isDomainAvailable(domain, options);
      finishedCount++;
      if (available) {
        availableDomains.push(domain);
      }
      onStatus(domain, available, finishedCount);
    } catch (error) {
      finishedCount++;
      onError(domain, error as Error, finishedCount);
    }
  }

  // Run for each domain
  await pMap(domains, run, { concurrency });

  // Expose final data
  return availableDomains;
}
