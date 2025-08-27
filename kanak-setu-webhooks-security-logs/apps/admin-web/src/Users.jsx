import React, { useEffect, useState } from 'react'
import { listUsers, createUser, assignInstitutionAdmin, getInstitutions, listKYC, approveKYC, rejectKYC } from './api'

export default function Users(){
  const [users, setUsers] = useState([])
  const [insts, setInsts] = useState([])
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'TEMPLE_ADMIN' })
  const [selected, setSelected] = useState({ instId:'', userId:'' })
  const reload = ()=> { listUsers().then(setUsers); getInstitutions().then(setInsts) }
  useEffect(reload, [])

  const add = async (e)=>{
    e.preventDefault()
    const u = await createUser(form)
    if(u?.id){ setForm({ name:'', email:'', password:'', role:'TEMPLE_ADMIN' }); reload() }
  }
  const assign = async (e)=>{
    e.preventDefault()
    if(!selected.instId || !selected.userId) return
    const ok = await assignInstitutionAdmin(selected.instId, selected.userId)
    reload()
  }

  return (
    <div className="container">
      <h1>Admin – Users & Permissions</h1>
      <div className="card">
        <h3>Create User</h3>
        <form onSubmit={add}>
          <label>Name</label><input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
          <label>Email</label><input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
          <label>Password</label><input type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
          <label>Role</label>
          <select value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
            <option value="TEMPLE_ADMIN">TEMPLE_ADMIN</option>
            <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
          </select>
          <div style={{marginTop:12}}><button className="button" type="submit">Create</button></div>
        </form>
      </div>

      <div className="card">
        <h3>Assign Institution Admin</h3>
        <form onSubmit={assign}>
          <label>Institution</label>
          <select value={selected.instId} onChange={e=>setSelected({...selected, instId:e.target.value})}>
            <option value="">-- Select --</option>
            {insts.map(i=> <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <label>User</label>
          <select value={selected.userId} onChange={e=>setSelected({...selected, userId:e.target.value})}>
            <option value="">-- Select --</option>
            {users.map(u=> <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
          </select>
          <div style={{marginTop:12}}><button className="button" type="submit">Assign</button></div>
        </form>
      </div>
    </div>
  )
}
