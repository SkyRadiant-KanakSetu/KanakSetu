import { query } from './db.js';

export async function logAudit(event, req, meta = {}){
  try{
    const uid = req?.user?.id || null;
    const ip = (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '') + '';
    await query('INSERT INTO audit_logs (event, user_id, ip, meta_json) VALUES ($1,$2,$3,$4)', [event, uid, ip, JSON.stringify(meta)]);
  }catch(e){
    console.error('[audit]', e.message);
  }
}
