
export function getToken(){
  return localStorage.getItem('ks_token') || ''
}
function authHeaders(){
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {}
}
const API = '/api';

export async function getInstitutions(){
  const res = await fetch(`${API}/institutions`, { headers: { ...authHeaders() } });
  return res.json();
}

export async function createDonation(payload){
  const res = await fetch(`${API}/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function getInstitutionDonations(id){
  const res = await fetch(`${API}/institutions/${id}/donations`);
  return res.json();
}

export async function getDonation(id){
  const res = await fetch(`${API}/donations/${id}`);
  return res.json();
}

export async function listUsers(){
  const res = await fetch(`/api/admin/users`, { headers: { ...authHeaders() } });
  return res.json();
}
export async function createUser(payload){
  const res = await fetch(`/api/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) });
  return res.json();
}
export async function assignInstitutionAdmin(instId, userId){
  const res = await fetch(`/api/admin/institutions/${instId}/admins`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ userId }) });
  return res.json();
}
export async function listKYC(entityType, entityRef){
  const res = await fetch(`/api/kyc/${entityType}/${entityRef}`, { headers: { ...authHeaders() } });
  return res.json();
}
export async function approveKYC(id){
  const res = await fetch(`/api/kyc/${id}/approve`, { method: 'POST', headers: { ...authHeaders() } });
  return res.json();
}
export async function rejectKYC(id){
  const res = await fetch(`/api/kyc/${id}/reject`, { method: 'POST', headers: { ...authHeaders() } });
  return res.json();
}
