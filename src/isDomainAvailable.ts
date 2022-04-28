import isValidDomain = require('is-valid-domain');
import { hasWhoisEntry, HasWhoisEntryOptions } from './hasWhoisEntry';
import { hasDnsEntry } from './hasDnsEntry';

export interface IsDomainAvailableOptions extends HasWhoisEntryOptions {
  // Should it trust ENOTFOUND from DNS, default: false
  trustDns: boolean;
}

export async function isDomainAvailable(domain: string, options?: Partial<IsDomainAvailableOptions>): Promise<boolean> {
  // Verify if it's valid domain
  if (!isValidDomain(domain)) {
    return false;
  }

  // Verify via DNS lookup, as it's faster
  const dnsStatus = await hasDnsEntry(domain).catch<null>(() => null);
  if (dnsStatus === true || (options?.trustDns && dnsStatus === false)) {
    return !dnsStatus;
  }

  // Verify via WHOIS query
  return !(await hasWhoisEntry(domain, options));
}
