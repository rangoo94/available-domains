# available-domains

Node.js software to detect whether the domain name is available or already taken.

It's fast, stable and provides a simple interface to search through.

## Installation

NPM, Yarn or similar is required. Afterwards, you have to install package globally, i.e.:

```bash
npm install -g available-domains
```

## Usage

### CLI

To find a single or few domains, you may pass them as arguments:

```bash
available-domains google.com google.co.uk
```

Alternatively, you may pass whole file:

```bash
available-domains < domains-list.txt
```

Or pass a result of different command:

```bash
cat domains-list.txt | available-domains
```

The `stdout` will have only domains line by line, all errors, progress bars etc will land on `stderr`.

Thanks to that, you may simply stream the results to a different file, while still having all progress information available:

```bash
cat domains-list.txt | available-domains > free-domains-list.txt
# or:
available-domains < domains-list.txt > free-domains-list.txt
```

If you have a lot of domains, and you want to speed up at cost of false-positives,
you may use `--trust-dns` option. It will not be fully accurate, but will be faster.

```bash
Usage: available-domains [options] [domains...]

Options:
  -V, --version                                  output the version number
  -c <concurrency>, --concurrency <concurrency>  How many concurrent checks may be performed (default: 30)
  --trust-dns                                    Should it trust ENOTFOUND from DNS (default: false)
  --printTaken, --print-taken, -pt               Should it print taken domains too (with "[T]" prefix) (default: false)
  -t <timeout>, --timeout <timeout>              Timeout for WHOIS connection (ms) (default: 3000)
  -r <maxRetries>, --max-retries <maxRetries>    How many times it may retry rate limited WHOIS query (default: 2)
  -rt <retryTime>, --retry-time <retryTime>      Retry time of WHOIS query when rate limited (ms) (default: 3000)
  --proxy <proxy>, -p <proxy>                    SOCKS Proxy "<ip>:<port>"
  -h, --help                                     Show help information (default: false)
```

> **Note:**
> 
> Because of concurrency, order of results is not guaranteed.
> 
> Thanks to piping, you may perform some operations nicely though, i.e.:
> ```bash
> cat domains-list.txt | available-domains | sort # Sort alphabetically
> cat domains-list.txt | grep -x '.\{0,16\}' | available-domains # Take domains of max 16 characters
> ```

### Programmatically

There are two functions exposed:

* `isDomainAvailable` that returns `boolean` for specific domain name
* `getAvailableDomains` that returns list of available domains (`string[]`) from provided

```js
const { getAvailableDomains, isDomainAvailable } = require('available-domains');

const result = await isDomainAvailable('google.com');
const list = await getAvailableDomains([ 'google.com', 'google.co.uk' ]);
```

As the second argument you may provide optional options object.

#### `isDomainAvailable` options

| Name | Type | Description | Default |
|------|------|-------------|---------|
| `proxy` | `string`      | SOCKS Proxy "<ip>:<port>" | `null` - no proxy |
| `timeout` | `number`    | Timeout for WHOIS connection (ms) | 3000 |
| `maxRetries` | `number` | How many times it may retry rate limited WHOIS query | 2 |
| `retryTime` | `number`  | Retry time of WHOIS query when rate limited (ms) | 3000 |
| `trustDns` | `boolean`  | Should it trust `ENOTFOUND` from DNS | `false` |

#### `getAvailableDomains` options

It supports same options as `isDomainAvailable` and additionally:

| Name | Type |Description | Default |
|------|------|------------|---------|
| `concurrency` | `number`      | How many concurrent checks may be performed | 30 |
| `onStatus` | `(domain: string, available: boolean, finishedCount: number) => void` | Callback to immediately get information about each scanned domain | none |
| `onError` | `(domain: string, error: Error, finishedCount: number) => void` | Callback to immediately get information about each failed domain scan | none |

## How it works

Firstly, it's resolving DNS for the specified domain. It's cheaper, less limited, but not precise.

If there is an DNS record for that domain, it's immediately treat as taken. Otherwise, WHOIS record is obtained to check it this way.
