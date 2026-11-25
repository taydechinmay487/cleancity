import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { STATUS_META, categoryLabel, timeAgo } from '../lib/format.js'

const PIN_COLORS = {
  new: '#64748b',
  acknowledged: '#f59e0b',
  assigned: '#0ea5e9',
  in_progress: '#6366f1',
  resolved: '#16a34a',
}

function pinIcon(status) {
  return L.divIcon({
    className: 'cleancity-pin',
    html: `<div class="map-pin" style="background:${PIN_COLORS[status] || '#64748b'}"><span>•</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  })
}

export default function MapView({
  pins = [],
  center,
  zoom = 12,
  height = 360,
  selectedId = null,
  onSelect,
  interactive = true,
  className = '',
}) {
  const holder = useRef(null)
  const mapRef = useRef(null)
  const markers = useRef(new Map())
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect

  useEffect(() => {
    if (!holder.current || mapRef.current) return
    const map = L.map(holder.current, {
      zoomControl: interactive,
      scrollWheelZoom: false,
      dragging: interactive,
      attributionControl: true,
    }).setView(center || [20.5937, 78.9629], zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    mapRef.current = map
    const markerStore = markers.current

    return () => {
      map.remove()
      mapRef.current = null
      markerStore.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (center) map.setView(center, map.getZoom() < 10 ? 13 : map.getZoom())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set()

    for (const pin of pins) {
      seen.add(pin.id)
      const existing = markers.current.get(pin.id)
      if (existing) {
        existing.setLatLng([pin.lat, pin.lng])
        existing.setIcon(pinIcon(pin.status))
        continue
      }

      const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon(pin.status), title: pin.code })
      const meta = STATUS_META[pin.status] || STATUS_META.new
      const popup = document.createElement('div')
      popup.className = 'w-56 text-slate-700'
      popup.innerHTML = `
        <div class="mb-1 flex items-center justify-between gap-2">
          <strong class="text-[13px] text-slate-900">${pin.code || 'Complaint'}</strong>
          <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.chip}">${meta.label}</span>
        </div>
        <p class="text-[12px] font-medium text-slate-700">${categoryLabel(pin.category)}</p>
        <p class="mt-0.5 text-[11px] leading-snug text-slate-500">${pin.address || ''}</p>
        <p class="mt-1 text-[10px] text-slate-400">${timeAgo(pin.createdAt)}</p>
        ${pin.thumbnail ? `<img src="${pin.thumbnail}" alt="" class="mt-2 h-20 w-full rounded-lg object-cover" />` : ''}
        <button type="button" class="mt-2 w-full rounded-md bg-brand-600 px-2 py-1 text-[11px] font-semibold text-white">View details</button>
      `
      popup.querySelector('button')?.addEventListener('click', () => selectRef.current?.(pin))
      marker.bindPopup(popup)
      marker.addTo(map)
      markers.current.set(pin.id, marker)
    }

    for (const [id, marker] of markers.current.entries()) {
      if (!seen.has(id)) {
        marker.remove()
        markers.current.delete(id)
      }
    }
  }, [pins])

  useEffect(() => {
    if (!selectedId) return
    const marker = markers.current.get(selectedId)
    if (marker && mapRef.current) {
      mapRef.current.setView(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 14), { animate: true })
      marker.openPopup()
    }
  }, [selectedId])

  return (
    <div
      ref={holder}
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 ${className}`}
      style={{ height }}
    />
  )
}
