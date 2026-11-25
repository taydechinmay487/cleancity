import { useEffect, useMemo, useRef } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'

export default function PhotoPicker({ files, onChange, max = 6, label = 'Photographs', hint }) {
  const inputRef = useRef(null)
  const cameraRef = useRef(null)

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  )

  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  const addFiles = (list) => {
    const incoming = Array.from(list || []).filter((f) => f.type.startsWith('image/'))
    if (!incoming.length) return
    onChange([...files, ...incoming].slice(0, max))
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label mb-0">{label}</span>
        <span className="text-xs text-slate-400">
          {files.length}/{max}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {previews.map(({ file, url }, index) => (
          <div key={`${file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img src={url} alt={file.name} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, i) => i !== index))}
              className="absolute top-1 right-1 rounded-full bg-slate-900/70 p-1 text-white opacity-90 transition hover:bg-red-600"
              aria-label={`Remove ${file.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {files.length < max ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-[11px] font-medium">Add photo</span>
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 sm:hidden"
            >
              <Camera className="h-5 w-5" />
              <span className="text-[11px] font-medium">Camera</span>
            </button>
          </>
        ) : null}
      </div>

      {hint ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
