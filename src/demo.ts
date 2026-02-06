// ─── Demo: CLI example showing how to use the service ─────────────────
// This file demonstrates usage without needing a real API key.
// It's meant to show the API surface; in production, you would have
// real credentials configured via environment variables.

import { RateRequest, RateShoppingService, CarrierRegistry, UpsCarrier } from './index';

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        Cybership Carrier Integration Service - Demo              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Example rate request
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
        dimensions: {
          length: 12,
          width: 8,
          height: 6,
          unit: 'IN',
        },
        weight: {
          value: 5.5,
          unit: 'LBS',
        },
        packagingType: 'CUSTOM',
      },
    ],
  };

  console.log('📦 Rate Request:');
  console.log(JSON.stringify(request, null, 2));
  console.log('\n');

  // Note: In production, you would use createRateShoppingService() which
  // reads credentials from environment variables. Here we're just showing
  // the structure since we don't have real API credentials.

  console.log('ℹ️  Without valid UPS API credentials, we cannot make live API calls.');
  console.log('   In production, configure your .env file with:');
  console.log('   - UPS_CLIENT_ID');
  console.log('   - UPS_CLIENT_SECRET');
  console.log('   - UPS_ACCOUNT_NUMBER');
  console.log('\n');

  console.log('📊 What would happen with valid credentials:');
  console.log('   1. Service validates the request (origin, destination, packages)');
  console.log('   2. Maps domain types to UPS API format');
  console.log('   3. Acquires OAuth token (client credentials flow)');
  console.log('   4. Calls UPS Rating API (Shop for all services)');
  console.log('   5. Parses and normalizes the response');
  console.log('   6. Returns sorted RateQuote[] with all available services');
  console.log('\n');

  console.log('🔧 Sample code to get rates:');
  console.log(`
    import { createRateShoppingService, RateRequest } from 'cybership-cis';
    
    const service = createRateShoppingService();
    const response = await service.getQuotes(request);
    
    console.log(\`Found \${response.quotes.length} rate quotes\`);
    for (const quote of response.quotes) {
      console.log(\`\${quote.serviceName}: \$\${quote.totalCharges.amount}\`);
    }
  `);

  console.log('\n✅ Demo complete! See tests/ for integration test examples.');
}

main().catch(console.error);
