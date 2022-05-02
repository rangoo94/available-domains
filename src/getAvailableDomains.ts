import { DomainProcessor, DomainProcessorOptions } from './DomainProcessor';

const noop = () => {};

export interface GetAvailableDomainsOptions extends DomainProcessorOptions {
  // Alternative callback to get information immediately about each domain
  onStatus: (domain: string, available: boolean, finishedCount: number) => void;
  // Alternative callback to get error information immediately
  onError: (domain: string, error: Error, finishedCount: number) => void;
}

export async function getAvailableDomains(domains: string[], options?: Partial<GetAvailableDomainsOptions>): Promise<string[]> {
  // Configure
  const onStatus = options?.onStatus ?? noop;
  const onError = options?.onError ?? noop;

  // Set-up results
  const availableDomains: string[] = [];

  // Set-up processor
  return new Promise((resolve) => {
    const processor = new DomainProcessor(options);

    processor.on('next', (domain, available) => {
      if (available) {
        availableDomains.push(domain);
      }
      onStatus(domain, available, processor.finished + processor.duplicated);
    });

    processor.on('failed', (domain, error) => {
      onError(domain, error, processor.finished + processor.duplicated);
    });

    processor.on('end', () => {
      resolve(availableDomains);
    });

    for (const domain of domains) {
      processor.add(domain);
    }

    processor.end();
  });
}
