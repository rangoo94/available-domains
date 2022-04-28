import { promises } from 'dns';

export async function hasDnsEntry(domain: string): Promise<boolean> {
  try {
    await promises.resolve(domain);
    return true;
  } catch (error) {
    const castedError = error as Error & { code?: string };
    if (castedError.code === 'ENOTFOUND') {
      return false;
    } else if (castedError.code === 'ENODATA') {
      return true;
    }
    throw castedError;
  }
}
