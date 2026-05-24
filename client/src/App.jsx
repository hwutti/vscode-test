import React, { useEffect, useMemo, useState } from 'react'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Down' },
  { id: 'unknown', label: 'Unknown' },
  { id: 'disabled', label: 'Paused' },
]

const STATUS_META = {
  up: { label: 'Up', color: '#1f9d74' },
  down: { label: 'Down', color: '#d4503f' },
  unknown: { label: 'Unknown', color: '#8e97a8' },
  disabled: { label: 'Paused', color: '#84705f' },
}

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
  return new URL(candidate).href
}

function getServiceHost(url) {
  try {
    return new URL(url).host
  } catch (err) {
    return url
  }
}

function parseResponseMs(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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
  const ms = parseResponseMs(value)
  if (ms === null) return 'No response'
  return `${ms} ms`
}

function percentage(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function StatusDonut({ counts }) {
  const segments = [
    { id: 'up', value: counts.up },
    { id: 'down', value: counts.down },
    { id: 'unknown', value: counts.unknown },
    { id: 'disabled', value: counts.disabled },
  ]
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const size = 190
  const radius = 64
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Service health distribution">
        <circle
          className="donut-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth="18"
          fill="none"
        />
        {segments.map((segment) => {
          if (!total || segment.value === 0) return null
          const arcLength = (segment.value / total) * circumference
          const circle = (
            <circle
              key={segment.id}
              className="donut-segment"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth="18"
              fill="none"
              stroke={STATUS_META[segment.id].color}
              strokeDasharray={`${arcLength} ${circumference - arcLength}`}
              strokeDashoffset={-offset}
            />
          )
          offset += arcLength
          return circle
        })}
      </svg>
      <div className="donut-center">
        <strong>{counts.total}</strong>
        <span>Services</span>
      </div>
    </div>
  )
}

function ResponseBars({ services }) {
  const samples = services
    .map((service) => ({
      id: service.id,
      name: service.name,
      host: getServiceHost(service.url),
      response: parseResponseMs(service.latest_response_ms ?? service.responseMs),
      state: getServiceState(service),
    }))
    .filter((service) => service.response !== null && service.state !== 'disabled')
    .sort((a, b) => b.response - a.response)
    .slice(0, 6)

  if (samples.length === 0) {
    return <p className="panel-hint">No response samples yet. Add services and wait for checks.</p>
  }

  const maxResponse = Math.max(...samples.map((sample) => sample.response))
  const scale = maxResponse > 0 ? maxResponse : 1

  return (
    <ol className="latency-list">
      {samples.map((sample) => (
        <li key={sample.id} className="latency-row">
          <div className="latency-info">
            <strong>{sample.name}</strong>
            <span>{sample.host}</span>
          </div>
          <div className="latency-bar">
            <span style={{ width: `${Math.max(8, Math.round((sample.response / scale) * 100))}%` }} />
          </div>
          <em>{sample.response} ms</em>
        </li>
      ))}
    </ol>
  )
}

function ServiceTile({ service, onDelete, onToggle, busy }) {
  const state = getServiceState(service)
  const enabled = isEnabled(service)
  const statusText = STATUS_META[state]?.label || 'Unknown'
  const responseMs = parseResponseMs(service.latest_response_ms ?? service.responseMs)
  const responseWidth = responseMs === null ? 6 : Math.max(6, Math.min(100, Math.round((responseMs / 2500) * 100)))

  return (
    <article className={`service-card is-${state}`}>
      <header className="service-card__head">
        <div>
          <p className="service-card__state">{statusText}</p>
          <h3>{service.name}</h3>
        </div>
        <span className="status-dot" aria-label={`Status ${statusText}`} />
      </header>

      <p className="service-host">{getServiceHost(service.url)}</p>
      <a className="service-url" href={service.url} target="_blank" rel="noreferrer">
        {service.url}
      </a>

      <div className="service-latency">
        <div className="service-latency__label">
          <span>Response</span>
          <strong>{formatResponseTime(responseMs)}</strong>
        </div>
        <div className="service-latency__track">
          <span style={{ width: `${responseWidth}%` }} />
        </div>
      </div>

      <dl className="service-meta">
        <div>
          <dt>Last check</dt>
          <dd>{formatCheckedAt(service.last_checked_at)}</dd>
        </div>
      </dl>

      <div className="service-actions">
        <button
          className="button button-ghost"
          type="button"
          onClick={() => onToggle(service)}
          disabled={busy}
          title={enabled ? 'Pause checks' : 'Resume checks'}
        >
          <span aria-hidden>{enabled ? 'II' : '>'}</span>
          {enabled ? 'Pause' : 'Resume'}
        </button>
        <button
          className="button button-danger"
          type="button"
          onClick={() => onDelete(service)}
          disabled={busy}
          title="Delete service"
        >
          <span aria-hidden>x</span>
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

  const activeCount = counts.total - counts.disabled
  const availability = activeCount > 0 ? percentage(counts.up, activeCount) : 0

  const latestCheckAt = useMemo(() => {
    return services.reduce((latest, service) => {
      if (!service.last_checked_at) return latest
      if (!latest) return service.last_checked_at
      return service.last_checked_at > latest ? service.last_checked_at : latest
    }, '')
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
      <div className="bg-layer" aria-hidden />
      <header className="topbar">
        <div>
          <p className="eyebrow">Ops dashboard</p>
          <h1>WebDashboard</h1>
        </div>
        <div className="topbar__meta">
          <div className={`connection is-${realtimeState}`}>
            <span />
            {realtimeState}
          </div>
          <p className="last-check">
            Last refresh
            <strong>{formatCheckedAt(latestCheckAt)}</strong>
          </p>
        </div>
      </header>

      <main className="page">
        <section className="insights">
          <article className="panel panel-summary">
            <h2>Availability</h2>
            <p className="availability-number">{availability}%</p>
            <p className="panel-subtitle">
              {counts.up} of {activeCount} active services are up
            </p>
            <div className="summary-grid">
              <div>
                <span>Total</span>
                <strong>{counts.total}</strong>
              </div>
              <div>
                <span>Down</span>
                <strong>{counts.down}</strong>
              </div>
              <div>
                <span>Unknown</span>
                <strong>{counts.unknown}</strong>
              </div>
              <div>
                <span>Paused</span>
                <strong>{counts.disabled}</strong>
              </div>
            </div>
          </article>

          <article className="panel panel-chart">
            <h2>Status mix</h2>
            <StatusDonut counts={counts} />
            <ul className="legend">
              {Object.entries(STATUS_META).map(([key, config]) => (
                <li key={key}>
                  <span style={{ backgroundColor: config.color }} />
                  {config.label}
                  <strong>{counts[key]}</strong>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel panel-latency">
            <h2>Slowest responses</h2>
            <ResponseBars services={services} />
          </article>
        </section>

        <section className="workspace">
          <aside className="panel panel-form">
            <h2>Add service</h2>
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
                <span aria-hidden>+</span>
                {saving ? 'Adding...' : 'Add service'}
              </button>
            </form>
          </aside>

          <section className="panel panel-services" aria-label="Services">
            <div className="toolbar">
              <div className="search">
                <label htmlFor="service-search">Search</label>
                <input
                  id="service-search"
                  placeholder="Filter by name or URL"
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
