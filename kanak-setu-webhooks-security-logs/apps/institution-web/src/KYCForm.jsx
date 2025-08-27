import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { submitKYC } from './api'

export default function KYCForm(){
  const [sp] = useSearchParams()
  const id = sp.get('id') || ''
  const [pan, setPan] = useState('')
  const [name, setName] = useState('')
  const [addr, setAddr] = useState('')
  const [msg, setMsg] = useState('')

  const submit = async (e)=>{
    e.preventDefault()
    const payload = { entityType: 'INSTITUTION', entityRef: String(id), pan, fullName: name, address: { line1: addr } }
    const res = await submitKYC(payload)
    if(res?.id){ setMsg('KYC submitted. Status: ' + res.status) } else { setMsg('Failed: ' + (res?.error || 'unknown')) }
  }

  return (
    <div className="container">
      <h2>Institution KYC</h2>
      {msg && <div className="card">{msg}</div>}
      <form className="card" onSubmit={submit}>
        <label>PAN</label><input value={pan} onChange={e=>setPan(e.target.value)} />
        <label>Authorized Person Name</label><input value={name} onChange={e=>setName(e.target.value)} />
        <label>Address</label><input value={addr} onChange={e=>setAddr(e.target.value)} />
        <div style={{marginTop:12}}><button className="button" type="submit">Submit KYC</button></div>
      </form>
    </div>
  )
}
