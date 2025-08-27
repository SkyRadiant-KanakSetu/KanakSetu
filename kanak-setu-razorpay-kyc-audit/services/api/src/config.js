import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  dbUrl: process.env.DATABASE_URL,
  provider: process.env.PROVIDER || 'MOCK',
  providerKey: process.env.PROVIDER_API_KEY || '',
  goldRateINR: Number(process.env.GOLD_RATE_INR || 7000),
};


export const mmtc = {
  baseUrl: process.env.MMTCPAMP_BASE_URL || '',
  apiKey: process.env.MMTCPAMP_API_KEY || '',
  partnerId: process.env.MMTCPAMP_PARTNER_ID || '',
  dryRun: (process.env.MMTCPAMP_DRY_RUN || 'true').toLowerCase() === 'true',
};
