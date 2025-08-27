import { config } from './config.js';

// Provider adapter. Replace MOCK with real MMTC-PAMP integration.
export async function buyGoldForInstitution({ institutionWalletId, amountINR }) {
  if (config.provider === 'MOCK') {
    // Simulate external provider call & compute grams by mock rate
    const grams = amountINR / config.goldRateINR;
    const providerRef = `MOCK-${Date.now()}`;
    return { ok: true, grams, providerRef };
  }

  // Example skeleton for MMTC-PAMP
  if (config.provider === 'MMTCPAMP') {
    // DRY-RUN MODE: simulate allocation using GOLD_RATE_INR while wiring structure like the real thing.
    // Toggle via env: MMTCPAMP_DRY_RUN=true|false
    const { mmtc } = await import('./config.js');
    if (mmtc.dryRun) {
      const grams = amountINR / config.goldRateINR;
      const providerRef = `MMTCPAMP-DRYRUN-${Date.now()}`;
      return { ok: true, grams, providerRef };
    }
    // TODO: Implement real HTTP calls here:
    // Example sketch (replace with real endpoints & payloads agreed with provider):
    // const resp = await fetch(`${mmtc.baseUrl}/v1/allocate`, {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${mmtc.apiKey}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ partner_id: mmtc.partnerId, wallet_id: institutionWalletId, amount_inr: amountINR })
    // });
    // if(!resp.ok) throw new Error(`MMTCPAMP error ${resp.status}`);
    // const data = await resp.json();
    // return { ok: true, grams: data.grams, providerRef: data.txn_id };
    throw new Error('MMTC-PAMP live integration not configured. Set MMTCPAMP_DRY_RUN=true for pilot.');
  }

  throw new Error('Unsupported provider.');
}
