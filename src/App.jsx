import { useState } from 'react'
import Level1 from './levels/Level1.jsx'
import Level4 from './levels/Level4.jsx'

const LEVELS = [
  { id: 1, title: 'Position', subtitle: 'Frame of Reference', component: Level1 },
  { id: 2, title: 'Velocity', subtitle: 'Coming Soon', component: null },
  { id: 3, title: 'Time', subtitle: 'Coming Soon', component: null },
  { id: 4, title: 'Moral', subtitle: 'Point of View', component: Level4 },
]

export default function App() {
  const [activeLevel, setActiveLevel] = useState(null)

  if (activeLevel) {
    const level = LEVELS.find((l) => l.id === activeLevel)
    const Component = level?.component
    if (Component) {
      return (
        <div>
          <button
            onClick={() => setActiveLevel(null)}
            className="fixed top-4 left-4 z-50 px-3 py-1.5 rounded-xl bg-white/90 border border-neutral-200 text-sm text-neutral-700 hover:bg-white shadow-sm"
          >
            ← Back
          </button>
          <Component />
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-8 font-sans">
      <div className="max-w-xl w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Interactive Essay</div>
          <h1 className="text-5xl font-bold tracking-tight">Parallax</h1>
          <p className="text-neutral-400 text-sm mt-3 leading-6">
            Four chapters on how perspective shapes physics, velocity, time, and meaning.
          </p>
        </div>

        <div className="space-y-3">
          {LEVELS.map((level) => {
            const available = level.component !== null
            return (
              <button
                key={level.id}
                onClick={() => available && setActiveLevel(level.id)}
                disabled={!available}
                className={`w-full flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition ${
                  available
                    ? 'border-neutral-700 bg-neutral-900 hover:border-neutral-400 hover:bg-neutral-800 cursor-pointer'
                    : 'border-neutral-800 bg-neutral-900/40 cursor-not-allowed opacity-40'
                }`}
              >
                <div className="text-2xl font-mono text-neutral-500 w-6 shrink-0">{level.id}</div>
                <div>
                  <div className="font-semibold text-neutral-100">{level.title}</div>
                  <div className="text-sm text-neutral-500 mt-0.5">{level.subtitle}</div>
                </div>
                {available && (
                  <div className="ml-auto text-xs px-2 py-1 rounded-full bg-neutral-700 text-neutral-300">Play</div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
