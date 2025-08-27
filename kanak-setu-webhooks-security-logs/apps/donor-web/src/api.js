const API = '/api';

export async function getInstitutions(){
  const res = await fetch(`${API}/institutions`);
  return res.json();
}

export async function createDonation(payload){
  const res = await fetch(`${API}/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

export async function createOrder(payload){
  const res = await fetch(`${API}/payments/create-order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}
export async function simulatePaymentSuccess(orderId){
  const res = await fetch(`${API}/payments/${orderId}/simulate-success`, { method: 'POST' });
  return res.json();
}

export async function getConfig(){
  const res = await fetch(`${API}/config`);
  return res.json();
}
