# Carrier Integration Service

>A carrier integration service that wraps the UPS Rating API to
> fetch live shipping rates. Built in TypeScript with a pluggable architecture
> so additional carriers (FedEx, USPS, DHL) and operations (labels, tracking)
> can be added without modifying existing code.
>
> **Repository:** [github.com/lalitkumarjangid/Carrier-Integration-Service](https://github.com/lalitkumarjangid/Carrier-Integration-Service)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Architecture & Design Decisions](#architecture--design-decisions)
4. [How It Works](#how-it-works)
5. [UPS Rating API Integration](#ups-rating-api-integration)
6. [Configuration](#configuration)
7. [Running Tests](#running-tests)
8. [Usage Example](#usage-example)
9. [Error Handling](#error-handling)
10. [Extensibility](#extensibility)
11. [Testing Strategy](#testing-strategy)
12. [What I Would Improve](#what-i-would-improve)
13. [Tech Stack](#tech-stack)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run all tests (no API key required — uses stubbed responses)
npm test

# 3. Type-check the project
npm run typecheck

# 4. Run the demo
npm run demo
```

Or use the included helper script:

```bash
chmod +x run.sh
./run.sh
```

---

## Project Structure

```
carrier-integration-service/
├── src/
│   ├── carriers/                        # Carrier implementations
│   │   ├── carrier.interface.ts         # CarrierProvider contract
│   │   ├── registry.ts                  # Pluggable carrier registry
│   │   └── ups/                         # UPS implementation
│   │       ├── auth.ts                  # OAuth 2.0 client-credentials flow
│   │       ├── client.ts               # HTTP client (auth injection, retry, error classification)
│   │       ├── index.ts                # UpsCarrier (implements CarrierProvider)
│   │       └── rating/                 # Rating operation
│   │           ├── types.ts            # UPS-specific API types (internal)
│   │           ├── mapper.ts           # Domain ↔ UPS bidirectional mapping
│   │           ├── operation.ts        # Rating API call orchestration
│   │           └── index.ts            # Barrel export
│   ├── config/
│   │   └── index.ts                    # Env config loaded & validated via Zod
│   ├── errors/
│   │   └── index.ts                    # CarrierError class + typed factory functions
│   ├── services/
│   │   └── rate-shopping.ts            # Top-level rate shopping orchestration
│   ├── types/
│   │   ├── address.ts                  # Address model
│   │   ├── package.ts                  # Package / dimensions / weight models
│   │   ├── rate.ts                     # RateRequest, RateQuote, RateResponse
│   │   ├── common.ts                   # Shared enums / types
│   │   └── index.ts                    # Barrel export
│   ├── validation/
│   │   └── schemas.ts                  # Zod schemas for runtime input validation
│   ├── index.ts                        # Public entry point + factory function
│   └── demo.ts                         # CLI demo
├── tests/
│   ├── fixtures/
│   │   └── ups-responses.ts            # Realistic stubbed UPS API payloads
│   └── integration/
│       ├── ups-auth.test.ts            # 10 tests — OAuth token lifecycle
│       ├── ups-rating.test.ts          # 6 tests  — request/response mapping
│       ├── error-handling.test.ts      # 10 tests — error classification
│       ├── validation.test.ts          # 21 tests — input validation
│       └── rate-shopping.test.ts       # 7 tests  — service orchestration
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── .gitignore
├── run.sh                              # One-command test runner
└── README.md
```

---

## Architecture & Design Decisions

### 1. Carrier Abstraction — `CarrierProvider` Interface

Every carrier implements a common `CarrierProvider` interface:

```typescript
interface CarrierProvider {
  readonly carrierId: string;
  readonly carrierName: string;
  readonly supportedOperations: string[];
  getRates(request: RateRequest): Promise<RateQuote[]>;
}
```

**Why?** Adding FedEx means creating a new class that implements `CarrierProvider` and
registering it with the `CarrierRegistry`. Zero changes to UPS code or the rate shopping
service.

### 2. Carrier Registry — Pluggable Discovery

`CarrierRegistry` is a runtime container for carrier providers. The rate shopping service
queries it to discover which carriers are available — there is no hard-coded list.

```
RateShoppingService ──queries──▶ CarrierRegistry ──returns──▶ [UpsCarrier, FedExCarrier, …]
```

### 3. Separation of Concerns

| Layer | Responsibility |
|---|---|
| **Domain types** (`src/types/`) | Carrier-agnostic models. Callers never see UPS-specific formats. |
| **Mappers** (`src/carriers/ups/rating/mapper.ts`) | Bidirectional UPS ↔ domain translation. Service code tables maintained here. |
| **HTTP client** (`src/carriers/ups/client.ts`) | Auth header injection, automatic 401 retry with fresh token, error classification. |
| **Service layer** (`src/services/`) | Validates input, fans out to carriers in parallel, normalizes & sorts results. |

### 4. Operation-Based Extension

Each carrier capability (rate, label, tracking) is its own class. Adding a new operation to
UPS means adding a new `operation.ts` file — the existing rating code is never touched.

### 5. OAuth 2.0 Token Lifecycle

`UpsAuthManager` handles the full token lifecycle:

- **Acquire** — POST to `/security/v1/oauth/token` with client credentials
- **Cache** — Tokens are stored in memory and reused until 60 s before expiry
- **Refresh** — Transparent re-acquisition; callers never see token mechanics
- **Concurrency** — Multiple simultaneous requests share a single in-flight token fetch (no thundering herd)
- **Retry** — On HTTP 401 the client automatically invalidates the token and retries once with a fresh one

### 6. Structured Errors

All failures produce a typed `CarrierError` with:

- `errorCode` — machine-readable category (AUTH_ERROR, NETWORK_ERROR, TIMEOUT, RATE_LIMIT, CARRIER_API_ERROR, etc.)
- `httpStatus` — upstream HTTP status when available
- `carrierCode` — carrier-specific error code
- `retryable` — whether the caller should retry
- `details` — additional context for debugging

Factory functions (`authError()`, `networkError()`, `timeoutError()`, `rateLimitError()`,
`carrierApiError()`, `malformedResponseError()`, `configurationError()`) enforce consistent
construction.

---

## How It Works

```
Caller
  │
  ▼
RateShoppingService.getQuotes(request)
  │
  ├── 1. Validate input (Zod schemas)
  │
  ├── 2. Query CarrierRegistry for matching carriers
  │
  ├── 3. Fan out getRates() to each carrier in parallel
  │       │
  │       └── UpsCarrier.getRates()
  │             ├── Map domain request → UPS API format (mapper)
  │             ├── POST /api/rating/v2409/Shop (via UpsHttpClient)
  │             │     └── UpsHttpClient injects OAuth bearer token
  │             └── Map UPS response → domain RateQuote[] (mapper)
  │
  ├── 4. Collect results, sort by price ascending
  │
  └── 5. Return RateResponse { quotes, errors, metadata }
```

---

## UPS Rating API Integration

### Endpoint

```
POST {baseUrl}/api/rating/{version}/Shop
```

- **baseUrl**: `https://onlinetools.ups.com` (production) or `https://wwwcie.ups.com` (sandbox)
- **version**: `v2409` (configurable)
- **Action**: `Shop` returns rates for all available UPS services

### Authentication

UPS uses **OAuth 2.0 Client Credentials** flow:

1. **Token Request** — `POST /security/v1/oauth/token` with `grant_type=client_credentials`
   and Basic auth header (`base64(client_id:client_secret)`)
2. **Response** — `{ "access_token": "...", "token_type": "Bearer", "expires_in": 14399 }`
3. **Usage** — All subsequent requests include `Authorization: Bearer <token>`

### Request Mapping

The mapper translates carrier-agnostic domain types into UPS-specific request format:

| Domain Field | UPS API Field |
|---|---|
| `origin.addressLines` | `RateRequest.Shipment.Shipper.Address.AddressLine` |
| `origin.city` | `...Shipper.Address.City` |
| `origin.stateCode` | `...Shipper.Address.StateProvinceCode` |
| `origin.postalCode` | `...Shipper.Address.PostalCode` |
| `origin.countryCode` | `...Shipper.Address.CountryCode` |
| `destination.isResidential` | `...ShipTo.Address.ResidentialAddressIndicator` |
| `packages[].weight` | `...Package.PackageWeight.Weight` + `UnitOfMeasurement.Code` |
| `packages[].dimensions` | `...Package.Dimensions.Length/Width/Height` + `UnitOfMeasurement.Code` |

### Response Mapping

UPS multi-rate responses are normalized into flat `RateQuote[]`:

| UPS Response Field | Domain Field |
|---|---|
| `RatedShipment.Service.Code` | `serviceCode` + `serviceName` (via lookup table) |
| `RatedShipment.TotalCharges.MonetaryValue` | `totalCharges.amount` |
| `RatedShipment.TotalCharges.CurrencyCode` | `totalCharges.currency` |
| `RatedShipment.GuaranteedDelivery.BusinessDaysInTransit` | `transitDays` |
| `RatedShipment.GuaranteedDelivery` | `guaranteed` (boolean) |

### UPS Service Codes

| Code | Service Name |
|---|---|
| 01 | UPS Next Day Air |
| 02 | UPS 2nd Day Air |
| 03 | UPS Ground |
| 12 | UPS 3 Day Select |
| 13 | UPS Next Day Air Saver |
| 14 | UPS Next Day Air Early |
| 59 | UPS 2nd Day Air A.M. |
| 65 | UPS Saver |

---

## Configuration

All configuration is loaded from environment variables and validated with Zod at startup.

| Variable | Required | Default | Description |
|---|---|---|---|
| `UPS_CLIENT_ID` | Yes | — | UPS OAuth client ID |
| `UPS_CLIENT_SECRET` | Yes | — | UPS OAuth client secret |
| `UPS_ACCOUNT_NUMBER` | Yes | — | UPS shipper account number |
| `UPS_BASE_URL` | No | `https://onlinetools.ups.com` | UPS API base URL |
| `UPS_RATING_API_VERSION` | No | `v2409` | Rating API version path segment |
| `HTTP_TIMEOUT` | No | `10000` | HTTP request timeout in ms |

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

> **Note**: Tests do NOT require real credentials. They use stubbed HTTP responses.

---

## Running Tests

### All Tests

```bash
npm test
```

This runs **54 integration tests** across 5 test suites using [Vitest](https://vitest.dev/).
All tests use stubbed responses — **no API key required**.

### Individual Commands

| Command | Description |
|---|---|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run demo` | Run CLI demo |
| `npm run build` | Compile TypeScript to `dist/` |

### Using run.sh

```bash
chmod +x run.sh
./run.sh
```

The `run.sh` script installs dependencies, runs the type checker, and executes all tests in
sequence. It exits with a non-zero code if any step fails.

---

## Usage Example

```typescript
import { createRateShoppingService, RateRequest } from 'cybership-cis';

const service = createRateShoppingService();

const request: RateRequest = {
  origin: {
    name: 'Cybership Fulfillment',
    addressLines: ['1234 Tech Drive'],
    city: 'San Francisco',
    stateCode: 'CA',
    postalCode: '94105',
    countryCode: 'US',
  },
  destination: {
    name: 'Customer Name',
    addressLines: ['5678 Oak Street'],
    city: 'New York',
    stateCode: 'NY',
    postalCode: '10001',
    countryCode: 'US',
    isResidential: true,
  },
  packages: [
    {
      dimensions: { length: 12, width: 8, height: 6, unit: 'IN' },
      weight: { value: 5.5, unit: 'LBS' },
    },
  ],
};

const response = await service.getQuotes(request);

for (const quote of response.quotes) {
  console.log(`${quote.serviceName}: $${quote.totalCharges.amount}`);
  console.log(`  Transit: ${quote.transitDays} days`);
  console.log(`  Guaranteed: ${quote.guaranteed}`);
}
```

---

## Error Handling

Errors are categorized and surfaced consistently:

| Error Code | When | Retryable |
|---|---|---|
| `AUTH_ERROR` | Invalid credentials or token acquisition failure | No |
| `NETWORK_ERROR` | DNS resolution failure, connection refused | Yes |
| `TIMEOUT` | Request exceeded `HTTP_TIMEOUT` | Yes |
| `RATE_LIMIT` | HTTP 429 from carrier API | Yes |
| `CARRIER_API_ERROR` | 4xx/5xx from carrier with error body | Depends |
| `MALFORMED_RESPONSE` | Unparseable carrier response | No |
| `CONFIGURATION_ERROR` | Missing or invalid env vars | No |
| `VALIDATION_ERROR` | Invalid input (caught before API call) | No |

```typescript
try {
  const response = await service.getQuotes(request);
} catch (error) {
  if (error instanceof CarrierError) {
    console.log(error.errorCode);   // 'TIMEOUT'
    console.log(error.retryable);   // true
    console.log(error.httpStatus);  // 408
    console.log(error.carrierCode); // carrier-specific code
  }
}
```

---

## Extensibility

### Adding a New Carrier (e.g., FedEx)

```
src/carriers/fedex/
├── auth.ts          # FedEx OAuth implementation
├── client.ts        # HTTP client
├── rating/
│   ├── types.ts     # FedEx-specific API types
│   ├── mapper.ts    # Domain ↔ FedEx mapping
│   └── operation.ts # Rating API call
└── index.ts         # FedExCarrier implements CarrierProvider
```

Register in the factory:

```typescript
registry.register(new FedExCarrier(fedexConfig));
```

**That's it.** The rate shopping service automatically discovers and queries it.

### Adding a New Operation (e.g., Label Purchase)

1. Define `LabelRequest` and `LabelResponse` domain types
2. Add `purchaseLabel?()` to `CarrierProvider` interface
3. Create `src/carriers/ups/label/` with types, mapper, operation
4. Implement in `UpsCarrier`
5. Add service method to expose it

Existing code remains untouched.

---

## Testing Strategy

### Test Distribution (54 tests total)

| Suite | Tests | What It Covers |
|---|---|---|
| `ups-auth.test.ts` | 10 | Token acquisition, caching, expiry, refresh, concurrent dedup, invalidation |
| `ups-rating.test.ts` | 6 | Request building, response parsing, multi-rate shop, single service mapping |
| `error-handling.test.ts` | 10 | HTTP 400/401/429/500, timeouts, network errors, malformed JSON, unknown errors |
| `validation.test.ts` | 21 | Address validation, package validation, weight/dimension ranges, required fields |
| `rate-shopping.test.ts` | 7 | Service orchestration, carrier filtering, result sorting, empty results, multi-carrier |

### Approach

- **Stubbed responses** — All tests mock HTTP calls with realistic UPS API payloads from
  `tests/fixtures/ups-responses.ts`. No real credentials or network calls needed.
- **Integration-level** — Tests exercise the full flow from service entry point through
  validation, mapping, error handling, and response normalization.
- **Deterministic** — No flaky tests. No external dependencies. Runs in ~200ms.

---

## What I Would Improve

Given more time, these are the areas I would focus on:

1. **Exponential Backoff & Retry** — Configurable retry policy with jitter for transient failures (5xx, timeouts, rate limits)
2. **Response Caching** — In-memory or Redis cache with TTL for rate quotes to reduce API calls and latency
3. **Structured Logging** — Pino or Winston with request correlation IDs and configurable log levels
4. **Observability** — Track API latency percentiles, error rates by category, cache hit ratios
5. **Circuit Breaker** — Prevent cascading failures when a carrier API is degraded; fail fast and return partial results
6. **Client-side Rate Limiting** — Token bucket to stay within UPS API quotas proactively
7. **Address Validation** — Pre-validate addresses via UPS Address Validation API before requesting rates
8. **Multi-piece Shipment Handling** — Better support for shipments with many packages of different sizes
9. **International Shipping** — Customs declarations, duties estimation, HS code mapping
10. **REST API Layer** — Express/Fastify HTTP server exposing the service as a REST API with OpenAPI docs
11. **Docker** — Dockerfile + docker-compose for containerized deployment
12. **CI/CD** — GitHub Actions workflow for lint, typecheck, test, build on every push

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| TypeScript | ^5.8.0 | Type-safe development with strict mode |
| Node.js | 18+ | Runtime |
| Vitest | ^3.2.2 | Fast, TypeScript-native test runner |
| Axios | ^1.7.9 | HTTP client for UPS API calls |
| Zod | ^3.24.1 | Runtime schema validation for input and config |
| dotenv | ^16.4.7 | Environment variable loading |
| ts-node | ^10.9.2 | Direct TypeScript execution for dev/demo |

---

## License

MIT
# Carrier-Integration-Service
