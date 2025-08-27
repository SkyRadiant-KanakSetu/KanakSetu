import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate, useSearchParams } from 'react-router-dom'
import './app.css'
import { getInstitutions, createDonation, getDonation } from './api'
import { createOrder, simulatePaymentSuccess } from './api'

function Home(){
  const [institutions, setInstitutions] = useState([])
  useEffect(()=>{ getInstitutions().then(setInstitutions) }, [])
  return (
    <div className="container">
      <h1>Kanak Setu – Donate Digital Gold</h1>
      <p>Select an institution and donate in ₹. Your donation is converted to gold and credited **directly** to the institution’s vault.</p>
      <div className="card">
        <h3>Institutions</h3>
        {institutions.map(i=>(
          <div key={i.id} className="card">
            <strong>{i.name}</strong>
            <div style={{marginTop:8}}>
              <Link className="button" to={`/donate?institutionId=${i.id}&name=${encodeURIComponent(i.name)}`}>Donate</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Donate(){
  const [sp] = useSearchParams()
  const institutionId = Number(sp.get('institutionId'))
  const instName = sp.get('name') || ''
  const [amountINR, setAmount] = useState('')
  const [donorName, setDonor] = useState('')
  const [donorEmail, setEmail] = useState('')
  const nav = useNavigate()

  const submit = async (e)=>{
    e.preventDefault()
    const payload = { institutionId, donorName, donorEmail, amountINR: Number(amountINR) }
    const order = await createOrder(payload);
    if(order?.order?.order_id){
      const url = `/mock-pay/${order.order.order_id}?name=${encodeURIComponent(instName)}&amount=${encodeURIComponent(amountINR)}`;
      window.location.href = url;
    }else{
      alert('Order failed: ' + (order?.error || 'unknown'))
    }
  }

  return (
    <div className="container">
      <h2>Donate to {instName}</h2>
      <form onSubmit={submit} className="card">
        <label>Donor Name</label>
        <input value={donorName} onChange={e=>setDonor(e.target.value)} placeholder="Your Name" required />
        <label>Email (optional)</label>
        <input value={donorEmail} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
        <label>Amount (₹)</label>
        <input type="number" value={amountINR} onChange={e=>setAmount(e.target.value)} placeholder="1000" min="1" required />
        <div style={{marginTop:12}}>
          <button className="button" type="submit">Donate</button>
        </div>
      </form>
      <div className="card">
        <Link to="/">← Back</Link>
      </div>
    </div>
  )
}

function Success(){
  const [sp] = useSearchParams()
  const id = sp.get('id')
  const grams = sp.get('grams')
  const [donation, setDonation] = useState(null)
  useEffect(()=>{ if(id) getDonation(id).then(setDonation) }, [id])
  return (
    <div className="container">
      <h2>Donation Successful 🎉</h2>
      <div className="card success">
        <p><strong>Receipt ID:</strong> {donation?.id}</p>
        <p><strong>Institution ID:</strong> {donation?.institution_id}</p>
        <p><strong>Donor:</strong> {donation?.donor_name || 'Anonymous'}</p>
        <p><strong>Amount:</strong> ₹{donation?.amount_inr}</p>
        <p><strong>Gold Credited:</strong> {grams || donation?.grams} g</p>
        <p><strong>Provider Ref:</strong> {donation?.provider_ref}</p>
        {donation?.id && <p><a className="button" href={`/api/donations/${donation.id}/receipt.pdf`} target="_blank" rel="noreferrer">Download Receipt (PDF)</a></p>}
        <p><em>A receipt email/SMS can be added here.</em></p>
      </div>
      <Link to="/">Donate again</Link>
    </div>
  )
}

export default function App(){
  return (
    <>
      <nav><img src="/logo.svg" alt="Kanak Setu"/><span className="spacer"/></nav>
      <nav className="container">
        <Link to="/">Home</Link>
        <a href="/temple" target="_blank" rel="noreferrer">Temple Dashboard</a>
        <a href="/admin" target="_blank" rel="noreferrer">Admin</a>
      </nav>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/donate" element={<Donate/>} />
        <Route path="/mock-pay/:orderId" element={<MockPay/>} />
        <Route path="/success" element={<Success/>} />
      </Routes>
    </>
  )
}


function MockPay(){
  const params = new URLSearchParams(window.location.search);
  const orderId = window.location.pathname.split('/').pop();
  const instName = params.get('name') || '';
  const amount = params.get('amount') || '';

  const pay = async ()=>{
    const res = await simulatePaymentSuccess(orderId);
    if(res?.donation?.id){
      window.location.href = `/success?id=${res.donation.id}&grams=${res.donation.grams}`;
    }else{
      alert('Payment simulation failed');
    }
  }

  return (
    <div className="container">
      <h2>Mock Payment</h2>
      <div className="card">
        <p>Order: <strong>{orderId}</strong></p>
        <p>Institution: {instName}</p>
        <p>Amount: ₹{amount}</p>
        <button className="button" onClick={pay}>Simulate UPI Success</button>
      </div>
      <div className="card"><a href="/">Cancel</a></div>
    </div>
  )
}
