import Login from './Login.jsx'
import React, { useEffect, useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import './app.css'
import Users from './Users.jsx'
import { getInstitutions } from './api'

async function addInstitution(payload){
  const res = await fetch('/api/institutions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return res.json()
}

function Institutions(){
  const token = localStorage.getItem('ks_token');
  if(!token){ return (<div className='container'><h1>Admin – Institutions</h1><div className='card'>Please <a href='/admin/login'>login</a> to continue.</div></div>) }

  const [list, setList] = useState([])
  const [form, setForm] = useState({ name:'', pan:'', bank_account:'', gold_wallet_id:'' })
  const reload = ()=> getInstitutions().then(setList)
  useEffect(reload, [])

  const submit = async (e)=>{
    e.preventDefault()
    const res = await addInstitution(form)
    if(res?.id){
      setForm({ name:'', pan:'', bank_account:'', gold_wallet_id:'' })
      reload()
    }else{
      alert('Failed: ' + (res?.error || 'unknown'))
    }
  }

  return (
    <div className="container">
      <h1>Admin – Institutions</h1>
      <div className="card">
        <h3>Add Institution</h3>
        <form onSubmit={submit}>
          <label>Name*</label>
          <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
          <label>PAN</label>
          <input value={form.pan} onChange={e=>setForm({...form, pan:e.target.value})} />
          <label>Bank Account</label>
          <input value={form.bank_account} onChange={e=>setForm({...form, bank_account:e.target.value})} />
          <label>Gold Wallet ID</label>
          <input value={form.gold_wallet_id} onChange={e=>setForm({...form, gold_wallet_id:e.target.value})} />
          <div style={{marginTop:12}}>
            <button className="button" type="submit">Add</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Current Institutions</h3>
        {list.map(i=>(
          <div key={i.id} className="card">
            <strong>#{i.id} – {i.name}</strong>
            <div>PAN: {i.pan || '-'}</div>
            <div>Wallet: {i.gold_wallet_id || '-'}</div>
            <div>Bank: {i.bank_account || '-'}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <Link to="/">Home</Link>
      </div>
    </div>
  )
}

function Home(){
  return (
    <div className="container">
      <h1>Kanak Setu – Admin</h1>
      <div className="card">
        <Link className="button" to="/institutions">Manage Institutions</Link> <Link className="button" to="/users">Users & Permissions</Link>
      </div>
    </div>
  )
}

export default function App(){
  return (
    <>
      <nav><img src="/logo.svg" alt="Kanak Setu"/><span className="spacer"/></nav>
      <nav className="container">
        <Link to="/">Home</Link>
        <a href="/" target="_blank" rel="noreferrer">Donor App</a>
        <a href="/temple" target="_blank" rel="noreferrer">Temple</a>
      </nav>
      <Routes>
        <Route path="/users" element={<Users/>} />
        <Route path="/login" element={<Login/>} />
        <Route path="/" element={<Home/>} />
        <Route path="/institutions" element={<Institutions/>} />
      </Routes>
    </>
  )
}
