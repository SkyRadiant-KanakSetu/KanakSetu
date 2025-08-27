import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const [email, setEmail] = useState('admin@kanaksetu.local')
  const [password, setPassword] = useState('Admin@12345')
  const [err, setErr] = useState('')
  const nav = useNavigate()

  const submit = async (e)=>{
    e.preventDefault()
    setErr('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if(data?.token){
      localStorage.setItem('ks_token', data.token)
      nav('/institutions')
    }else{
      setErr(data?.error || 'Login failed')
    }
  }

  return (
    <div className="container">
      <h1>Admin Login</h1>
      <form className="card" onSubmit={submit}>
        {err && <div className="card" style={{borderColor:'red'}}>{err}</div>}
        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <div style={{marginTop:12}}>
          <button className="button" type="submit">Login</button>
        </div>
      </form>
    </div>
  )
}
