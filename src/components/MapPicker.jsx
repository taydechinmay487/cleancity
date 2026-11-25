import { useEffect, useRef } from 'react'
import L from 'leaflet'

export default function MapPicker({ value, onChange, height = 320, className = '' }) {
  const holder = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const changeRef = useRef(onChange)
  changeRef.current = onChange

  useEffect(() => {
    if (!holder.current || mapRef.current) return
    const start = value ? [value.lat, value.lng] : [20.5937, 78.9629]
    const map = L.map(holder.current, { scrollWheelZoom: false }).setView(start, value ? 15 : 5)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    map.on('click', (event) => {
      const point = { lat: event.latlng.lat, lng: event.latlng.lng }
      placeMarker(map, markerRef, point, changeRef)
    })

    mapRef.current = map
    if (value) placeMarker(map, markerRef, value, changeRef)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !value) return
    placeMarker(map, markerRef, value, changeRef)
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15), { animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng])

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 ${className}`}>
      <div ref={holder} style={{ height }} className="w-full" />
      {!value ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-900/60 px-3 py-2 text-center text-xs font-medium text-white">
          Tap the map to drop a pin on the exact spot
        </div>
      ) : null}
    </div>
  )
}

function placeMarker(map, markerRef, point, changeRef) {
  if (markerRef.current) {
    markerRef.current.setLatLng([point.lat, point.lng])
    return
  }
  const icon = L.divIcon({
    className: 'cleancity-pin',
    html: '<div class="map-pin" style="background:#16a34a"><span>•</span></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })
  const marker = L.marker([point.lat, point.lng], { draggable: true, icon })
  marker.on('dragend', () => {
    const latlng = marker.getLatLng()
    changeRef.current?.({ lat: latlng.lat, lng: latlng.lng })
  })
  marker.addTo(map)
  markerRef.current = marker
}
