import Login from './Login.jsx'
import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useSearchParams } from 'react-router-dom'
import './app.css'
import { getInstitutions, getInstitutionDonations } from './api'

function Home(){
  const [institutions, setInstitutions] = useState([])
  useEffect(()=>{ getInstitutions().then(setInstitutions) }, [])
  return (
    <div className="container">
      <h1>Temple / NGO Dashboard</h1>
      <p>Select your institution to view donations and gold balance.</p>
      {institutions.map(i=>(
        <div key={i.id} className="card">
          <strong>{i.name}</strong>
          <div style={{marginTop:8}}>
            <Link className="button" to={`/dashboard?id=${i.id}&name=${encodeURIComponent(i.name)}`}>Open Dashboard</Link>
          </div>
        </div>
      ))}
    </div>
  )
}

function Dashboard(){
  const token = localStorage.getItem('ks_token');
  if(!token){ return (<div className='container'><div className='card'>Please <a href='/temple/login?redirect=' + window.location.pathname + window.location.search>login</a> to view dashboard.</div></div>) }

  const [sp] = useSearchParams()
  const id = Number(sp.get('id'))
  const name = sp.get('name') || ''
  const [rows, setRows] = useState([])
  useEffect(()=>{ if(id) getInstitutionDonations(id).then(setRows) }, [id])

  const totalGrams = rows.reduce((a,b)=>a + Number(b.grams||0), 0)
  const totalINR = rows.reduce((a,b)=>a + Number(b.amount_inr||0), 0)

  return (
    <div className="container">
      <h2>{name}</h2>
      <div className="card">
        <p><strong>Gold Balance (computed):</strong> {totalGrams.toFixed(6)} g</p>
        <p><strong>Total Donations:</strong> ₹{totalINR.toFixed(2)}</p>
      </div>
      <div className="card">
        <h3>Recent Donations</h3>
        {rows.length === 0 && <p>No donations yet.</p>}
        {rows.map(d=>(
          <div key={d.id} className="card">
            <div><strong>₹{d.amount_inr}</strong> → {Number(d.grams).toFixed(6)} g</div>
            <div>Donor: {d.donor_name || 'Anonymous'}</div>
            <div>Ref: {d.provider_ref}</div>
            <div><small>{new Date(d.created_at).toLocaleString()}</small></div>
          </div>
        ))}
      </div>
      <div className="card">
        <Link to="/">&larr; Back</Link>
      </div>
    </div>
  )
}

export default function App(){
  return (
    <>
      <nav><img src="/logo.svg" alt="Kanak Setu"/><span className="spacer"/></nav>
      <nav className="container">
        <Link to="/">Institutions</Link>
        <a href="/" target="_blank" rel="noreferrer">Donor App</a>
        <a href="/admin" target="_blank" rel="noreferrer">Admin</a>
      </nav>
      <Routes>
        <Route path="/login" element={<Login/>} />
        <Route path="/" element={<Home/>} />
        <Route path="/dashboard" element={<Dashboard/>} />
      </Routes>
    </>
  )
}
