import React, { useEffect, useState } from 'react'

function ServiceTile({ s }) {
  return (
    <div className={`tile ${s.last_status === 'up' ? 'up' : 'down'}`}>
      <h3>{s.name}</h3>
      <p>{s.url}</p>
      <p>Status: <strong>{s.last_status || 'unknown'}</strong></p>
    </div>
  )
}

export default function App() {
  const [services, setServices] = useState([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(setServices)

    const es = new EventSource('/api/events')
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.type === 'service:created' || data.type === 'service:updated') {
          // reload list
          fetch('/api/services').then(r => r.json()).then(setServices)
        }
        if (data.type === 'check') {
          setServices(prev => prev.map(s => s.id === data.serviceId ? { ...s, last_status: data.status, last_checked_at: data.checked_at } : s))
        }
      } catch (e) {}
    }
    return () => es.close()
  }, [])

  async function addService(e) {
    e.preventDefault()
    const res = await fetch('/api/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, url, enabled: true }) })
    if (res.ok) {
      setName('')
      setUrl('')
      const svc = await res.json()
      setServices(prev => [svc, ...prev])
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>WebDashboard</h1>
      </header>
      <main className="container">
        <section className="controls">
          <form onSubmit={addService} className="add-form">
            <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
            <input placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} required />
            <button type="submit">Add Service</button>
          </form>
        </section>

        <section className="grid">
          {services.map(s => <ServiceTile key={s.id} s={s} />)}
        </section>
      </main>
    </div>
  )
}
