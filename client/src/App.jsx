import React, { useEffect, useMemo, useState } from 'react'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Down' },
  { id: 'unknown', label: 'Unknown' },
  { id: 'disabled', label: 'Paused' },
]

function isEnabled(service) {
  return service.enabled === 1 || service.enabled === '1' || service.enabled === true
}

function getServiceState(service) {
  if (!isEnabled(service)) return 'disabled'
  return service.last_status || 'unknown'
}

function normalizeUrl(value) {
  const trimmed = value.trim()
  const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`
  const parsed = new URL(candidate)
  return parsed.href
}

function formatCheckedAt(value) {
  if (!value) return 'Never checked'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never checked'

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 10) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatResponseTime(value) {
  if (value === null || value === undefined) return 'No response'
  return `${value} ms`
}

function ServiceTile({ service, onDelete, onToggle, busy }) {
  const state = getServiceState(service)
  const enabled = isEnabled(service)
  const statusText = state === 'disabled' ? 'Paused' : state

  return (
    <article className={`service-card is-${state}`}>
      <div className="service-card__top">
        <div>
          <p className="eyebrow">{statusText}</p>
          <h3>{service.name}</h3>
        </div>
        <span className="status-dot" aria-label={`Status ${statusText}`} />
      </div>

      <a className="service-url" href={service.url} target="_blank" rel="noreferrer">
        {service.url}
      </a>

      <dl className="service-meta">
        <div>
          <dt>Last check</dt>
          <dd>{formatCheckedAt(service.last_checked_at)}</dd>
        </div>
        <div>
          <dt>Response</dt>
          <dd>{formatResponseTime(service.latest_response_ms ?? service.responseMs)}</dd>
        </div>
      </dl>

      <div className="service-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => onToggle(service)}
          disabled={busy}
        >
          {enabled ? 'Pause' : 'Resume'}
        </button>
        <button
          className="button button-danger"
          type="button"
          onClick={() => onDelete(service)}
          disabled={busy}
        >
          Delete
        </button>
      </div>
    </article>
  )
}

export default function App() {
  const [services, setServices] = useState([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [realtimeState, setRealtimeState] = useState('connecting')

  useEffect(() => {
    let cancelled = false

    async function loadServices() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/services')
        if (!res.ok) throw new Error('Services could not be loaded.')
        const data = await res.json()
        if (!cancelled) setServices(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadServices()

    const es = new EventSource('/api/events')
    es.onopen = () => setRealtimeState('connected')
    es.onerror = () => setRealtimeState('reconnecting')
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)

        if (data.type === 'service:created') {
          setServices((prev) => [data.service, ...prev.filter((service) => service.id !== data.service.id)])
        }

        if (data.type === 'service:updated') {
          setServices((prev) => prev.map((service) => (service.id === data.service.id ? data.service : service)))
        }

        if (data.type === 'service:deleted') {
          setServices((prev) => prev.filter((service) => service.id !== data.id))
        }

        if (data.type === 'check') {
          setServices((prev) =>
            prev.map((service) =>
              service.id === data.serviceId
                ? {
                    ...service,
                    last_status: data.status,
                    last_checked_at: data.checked_at,
                    latest_response_ms: data.responseMs,
                  }
                : service,
            ),
          )
        }
      } catch (err) {
        setError('Realtime update could not be read.')
      }
    }

    return () => {
      cancelled = true
      es.close()
    }
  }, [])

  const counts = useMemo(() => {
    return services.reduce(
      (acc, service) => {
        const state = getServiceState(service)
        acc.total += 1
        acc[state] += 1
        return acc
      },
      { total: 0, up: 0, down: 0, unknown: 0, disabled: 0 },
    )
  }, [services])

  const filteredServices = useMemo(() => {
    const term = query.trim().toLowerCase()

    return services.filter((service) => {
      const state = getServiceState(service)
      const matchesFilter = filter === 'all' || filter === state
      const matchesQuery =
        !term ||
        service.name.toLowerCase().includes(term) ||
        service.url.toLowerCase().includes(term)

      return matchesFilter && matchesQuery
    })
  }, [filter, query, services])

  async function addService(e) {
    e.preventDefault()
    setFormError('')

    let normalizedUrl = ''
    try {
      normalizedUrl = normalizeUrl(url)
    } catch (err) {
      setFormError('Enter a valid URL.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), url: normalizedUrl, enabled: true }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Service could not be added.')

      setName('')
      setUrl('')
      setServices((prev) => [payload, ...prev.filter((service) => service.id !== payload.id)])
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateService(service, patch) {
    const next = { ...service, ...patch }
    setBusyId(service.id)
    setError('')

    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: next.name,
          url: next.url,
          enabled: isEnabled(next),
        }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Service could not be updated.')
      setServices((prev) => prev.map((item) => (item.id === payload.id ? payload : item)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function deleteService(service) {
    if (!window.confirm(`Delete ${service.name}?`)) return

    setBusyId(service.id)
    setError('')

    try {
      const res = await fetch(`/api/services/${service.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Service could not be deleted.')
      setServices((prev) => prev.filter((item) => item.id !== service.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Live status</p>
          <h1>WebDashboard</h1>
        </div>
        <div className={`connection is-${realtimeState}`}>
          <span />
          {realtimeState}
        </div>
      </header>

      <main className="page">
        <section className="overview" aria-label="Service overview">
          <div className="metric">
            <span>Total</span>
            <strong>{counts.total}</strong>
          </div>
          <div className="metric metric-up">
            <span>Up</span>
            <strong>{counts.up}</strong>
          </div>
          <div className="metric metric-down">
            <span>Down</span>
            <strong>{counts.down}</strong>
          </div>
          <div className="metric metric-unknown">
            <span>Unknown</span>
            <strong>{counts.unknown}</strong>
          </div>
          <div className="metric metric-paused">
            <span>Paused</span>
            <strong>{counts.disabled}</strong>
          </div>
        </section>

        <section className="workspace">
          <aside className="panel">
            <form onSubmit={addService} className="add-form">
              <div className="field">
                <label htmlFor="service-name">Name</label>
                <input
                  id="service-name"
                  placeholder="Homepage"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="service-url">URL</label>
                <input
                  id="service-url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              {formError && <p className="notice notice-error">{formError}</p>}
              <button className="button button-primary" type="submit" disabled={saving}>
                {saving ? 'Adding...' : 'Add service'}
              </button>
            </form>
          </aside>

          <section className="service-board" aria-label="Services">
            <div className="toolbar">
              <div className="search">
                <label htmlFor="service-search">Search</label>
                <input
                  id="service-search"
                  placeholder="Filter services"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="segmented" aria-label="Status filter">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={filter === item.id ? 'is-active' : ''}
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="notice notice-error">{error}</p>}

            {loading ? (
              <div className="empty-state">Loading services...</div>
            ) : filteredServices.length > 0 ? (
              <div className="grid">
                {filteredServices.map((service) => (
                  <ServiceTile
                    key={service.id}
                    service={service}
                    onDelete={deleteService}
                    onToggle={(item) => updateService(item, { enabled: !isEnabled(item) })}
                    busy={busyId === service.id}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">No services found.</div>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}
