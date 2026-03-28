import { useState, useEffect, useRef, useCallback } from 'react'
import Level1 from './levels/Level1.jsx'
import Level4 from './levels/Level4.jsx'
import geocentricImg  from './assets/Geocentric.jpg'
import heliocentricImg from './assets/Heliocentric.jpg'
import universeImg    from './assets/Universe.jpg'
import bgmSrc from './assets/BGM.mp3'

const LEVELS = [
  { id: 1, title: 'Position', subtitle: 'Frame of Reference', component: Level1 },
  { id: 2, title: 'Velocity', subtitle: 'Coming Soon',        component: null   },
  { id: 3, title: 'Time',     subtitle: 'Coming Soon',        component: null   },
  { id: 4, title: 'Moral',    subtitle: 'Point of View',      component: Level4 },
]

// ─── shared draw helpers ─────────────────────────────────────────────────────
function drawStar(ctx, x, y, r, now) {
  const corona = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5)
  corona.addColorStop(0,    'rgba(255,248,190,0.95)')
  corona.addColorStop(0.18, 'rgba(255,215,70,0.55)')
  corona.addColorStop(0.45, 'rgba(255,150,20,0.18)')
  corona.addColorStop(0.8,  'rgba(255,100,0,0.04)')
  corona.addColorStop(1,    'transparent')
  ctx.fillStyle = corona; ctx.beginPath(); ctx.arc(x, y, r * 4.5, 0, Math.PI * 2); ctx.fill()

  ctx.save()
  ctx.globalAlpha = (0.7 + 0.3 * Math.sin(now * 0.0012)) * 0.18
  const fr = ctx.createRadialGradient(x, y, 0, x, y, r * 2.8)
  fr.addColorStop(0, '#fff8c0'); fr.addColorStop(1, 'transparent')
  ctx.fillStyle = fr; ctx.beginPath(); ctx.arc(x, y, r * 2.8, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  const core = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, 0, x, y, r)
  core.addColorStop(0,    '#ffffff')
  core.addColorStop(0.4,  '#fff8d0')
  core.addColorStop(0.85, '#ffdc50')
  core.addColorStop(1,    '#f0a010')
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

function drawEarth(ctx, x, y, r) {
  const ag = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 2.6)
  ag.addColorStop(0, 'rgba(80,160,255,0.28)'); ag.addColorStop(1, 'transparent')
  ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill()

  const pb = ctx.createRadialGradient(x - r * 0.38, y - r * 0.38, r * 0.05, x, y, r)
  pb.addColorStop(0,    '#cce8ff')
  pb.addColorStop(0.35, '#4888d0')
  pb.addColorStop(0.72, '#1a4490')
  pb.addColorStop(1,    '#080f24')
  ctx.fillStyle = pb; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()

  ctx.save()
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = 'rgba(48,128,68,0.78)'
  ctx.beginPath(); ctx.ellipse(x - r * 0.28, y + r * 0.12, r * 0.38, r * 0.25,  0.5, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(x + r * 0.34, y - r * 0.22, r * 0.28, r * 0.18, -0.3, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  ctx.strokeStyle = 'rgba(120,190,255,0.5)'; ctx.lineWidth = r * 0.22
  ctx.beginPath(); ctx.arc(x, y, r + r * 0.14, 0, Math.PI * 2); ctx.stroke()
}

// ─── Orbital canvas background ────────────────────────────────────────────────
function OrbitalBg({ dim = false, interactive = false, onBackground = null }) {
  const ref      = useRef(null)
  // p: 0 = geocentric (earth at center), 1 = heliocentric (sun at center)
  const transRef = useRef({ p: 0, target: 0 })
  const posRef   = useRef({ earth: {x:0,y:0,r:13}, sun: {x:0,y:0,r:19} })

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, lastTime = performance.now()

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const STARS = Array.from({ length: 260 }, () => ({
      rx: Math.random(), ry: Math.random(),
      r:  Math.random() * 1.3 + 0.2,
      ph: Math.random() * Math.PI * 2,
    }))

    const lerp = (a, b, t) => a + (b - a) * t

    const draw = (now) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now

      // smooth transition: p drifts toward target at ~2.5/s
      const tr = transRef.current
      tr.p += (tr.target - tr.p) * Math.min(1, dt * 2.5)

      const W = canvas.width, H = canvas.height
      ctx.fillStyle = '#03050d'; ctx.fillRect(0, 0, W, H)

      for (const s of STARS) {
        ctx.fillStyle = `rgba(190,210,255,${0.3 + 0.25 * Math.sin(now * 0.0007 + s.ph)})`
        ctx.beginPath(); ctx.arc(s.rx * W, s.ry * H, s.r, 0, Math.PI * 2); ctx.fill()
      }

      const cx = W * 0.5, cy = H * 0.56
      const sc   = Math.min(W, H) / 560
      const oa   = 220 * sc, ob = 96 * sc
      const tilt = 0.3
      const t    = now * 0.00025
      const sr   = 19 * sc, pr = 13 * sc

      // point on ellipse for the "orbiting slot"
      const ex_e = oa * Math.cos(t), ey_raw = ob * Math.sin(t)
      const orbitX = cx + ex_e * Math.cos(tilt) - ey_raw * Math.sin(tilt)
      const orbitY = cy + ex_e * Math.sin(tilt) + ey_raw * Math.cos(tilt)

      const p = tr.p
      // p=0: earth at center, sun at orbit
      // p=1: sun at center, earth at orbit
      const earthX = lerp(cx, orbitX, p)
      const earthY = lerp(cy, orbitY, p)
      const sunX   = lerp(orbitX, cx, p)
      const sunY   = lerp(orbitY, cy, p)

      posRef.current = {
        earth: { x: earthX, y: earthY, r: pr },
        sun:   { x: sunX,   y: sunY,   r: sr },
      }

      // orbit path colour blends with transition
      const oc = `rgba(${lerp(200,80,p).toFixed(0)},${lerp(160,110,p).toFixed(0)},${lerp(50,200,p).toFixed(0)},${lerp(0.14,0.13,p).toFixed(2)})`
      ctx.strokeStyle = oc; ctx.lineWidth = 1; ctx.setLineDash([5, 12])
      ctx.beginPath(); ctx.ellipse(cx, cy, oa, ob, tilt, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])

      // depth-sort: body with smaller y (further "back") drawn first
      if (earthY <= sunY) {
        drawEarth(ctx, earthX, earthY, pr)
        drawStar(ctx, sunX, sunY, sr, now)
      } else {
        drawStar(ctx, sunX, sunY, sr, now)
        drawEarth(ctx, earthX, earthY, pr)
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  const canvasCoords = (e) => {
    const canvas = ref.current
    const rect = canvas.getBoundingClientRect()
    return [
      (e.clientX - rect.left) * (canvas.width  / rect.width),
      (e.clientY - rect.top)  * (canvas.height / rect.height),
    ]
  }

  const handleClick = useCallback((e) => {
    if (!interactive) return
    const [x, y] = canvasCoords(e)
    const { earth, sun } = posRef.current
    if (Math.hypot(x - earth.x, y - earth.y) < earth.r * 3.5) {
      transRef.current.target = 0   // earth slides to center → geocentric
    } else if (Math.hypot(x - sun.x, y - sun.y) < sun.r * 3.5) {
      transRef.current.target = 1   // sun slides to center → heliocentric
    } else {
      onBackground?.()
    }
  }, [interactive, onBackground])

  const handleMouseMove = useCallback((e) => {
    if (!interactive) return
    const [x, y] = canvasCoords(e)
    const { earth, sun } = posRef.current
    const onBody = Math.hypot(x - earth.x, y - earth.y) < earth.r * 3.5
                || Math.hypot(x - sun.x,   y - sun.y)   < sun.r  * 3.5
    ref.current.style.cursor = onBody ? 'pointer' : 'default'
  }, [interactive])

  return (
    <canvas
      ref={ref}
      className="fixed inset-0 w-full h-full"
      style={{ opacity: dim ? 0.3 : 1, pointerEvents: interactive ? 'auto' : 'none' }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    />
  )
}

// ─── Pages ────────────────────────────────────────────────────────────────────
function HomePage({ onPlay }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <OrbitalBg interactive onBackground={onPlay} />
      {/* title — pointer-events-none so canvas handles background clicks */}
      <div className="absolute inset-0 flex items-start justify-center pt-14 pointer-events-none select-none z-10">
        <h1
          className="text-8xl font-bold tracking-tight text-white"
          style={{ textShadow: '0 0 120px rgba(140,180,255,0.16), 0 0 40px rgba(255,255,255,0.05)' }}
        >
          Parallax
        </h1>
      </div>
      {/* Play button */}
      <div className="absolute bottom-12 inset-x-0 flex justify-center z-10">
        <button
          onClick={onPlay}
          className="px-10 py-3 rounded-xl border border-neutral-500 text-neutral-200 text-base font-medium tracking-widest hover:border-white hover:text-white hover:bg-white/5 transition-all duration-300"
        >
          Play
        </button>
      </div>
    </div>
  )
}

const SECTIONS = [
  {
    img: geocentricImg,
    label: 'I · Geocentric',
    paragraphs: [
      { text: 'Earth was once thought to be the center of the universe.', em: 'lead' },
    ],
  },
  {
    img: heliocentricImg,
    label: 'II · Heliocentric',
    paragraphs: [
      { text: 'For centuries, this felt like a defacto truth in the human mind. Then, in the 16th century, Nicolaus Copernicus introduced the heliocentric system, which led to the Copernican Revolution and advanced the development of classical astronomy.', em: 'body' },
      { text: 'Later, modern astronomy showed that the Sun is not the center of the universe either, and that the universe may not have any universal center at all.', em: 'body' },
    ],
  },
  {
    img: universeImg,
    label: 'III · Cosmos',
    paragraphs: [
      { text: 'So here is our question: how does a change of reference system change the way we see the world, and what good can it do?', em: 'question' },
      { text: 'Perhaps, by choosing a different reference system, we are able to understand the world more clearly.', em: 'answer' },
    ],
  },
]

const pStyle = {
  lead:     'font-serif text-xl font-semibold text-neutral-100 leading-9 tracking-wide',
  body:     'font-serif text-base text-neutral-400 leading-[1.95] tracking-wide',
  question: 'font-serif text-base italic text-amber-200/80 leading-[1.95] tracking-wide border-l-2 border-amber-500/30 pl-4',
  answer:   'font-serif text-[1.05rem] font-medium text-neutral-200 leading-[1.9] tracking-wide',
}

function IntroPage({ onBack, onNext }) {
  return (
    <div className="min-h-screen bg-[#05070e] text-neutral-100 font-sans overflow-y-auto">
      {/* top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 bg-[#05070e]/80 backdrop-blur-sm border-b border-white/5">
        <button onClick={onBack} className="text-xs text-neutral-600 hover:text-neutral-400 transition">← Back</button>
        <span className="text-[10px] uppercase tracking-[0.35em] text-neutral-600">Parallax · Introduction</span>
        <button onClick={onNext} className="text-xs text-neutral-500 hover:text-neutral-200 transition">Chapters →</button>
      </div>

      {/* 3 image+text sections */}
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-28">
        {SECTIONS.map((sec, i) => (
          <div
            key={i}
            className={`flex gap-12 items-center ${i % 2 === 1 ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* image */}
            <div className="w-[46%] shrink-0">
              <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)]" style={{ aspectRatio: '4/3' }}>
                <img src={sec.img} alt={sec.label} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05070e]/70 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-5 text-[10px] uppercase tracking-[0.3em] text-neutral-400/80 font-mono">
                  {sec.label}
                </div>
              </div>
            </div>

            {/* text */}
            <div className="flex-1 space-y-6">
              <div className="text-[9px] uppercase tracking-[0.4em] text-neutral-600 font-mono mb-2">{sec.label}</div>
              {sec.paragraphs.map((p, j) => (
                <p key={j} className={pStyle[p.em]}>{p.text}</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* navigation */}
      <div className="max-w-6xl mx-auto px-6 pb-20 flex justify-end">
        <button
          onClick={onNext}
          className="px-10 py-3 rounded-full border border-neutral-600 text-neutral-300 text-sm hover:border-neutral-200 hover:text-white transition-all duration-300 font-sans"
        >
          Explore the Chapters →
        </button>
      </div>
    </div>
  )
}

function LevelsPage({ onBack, onSelect }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-8 font-sans">
      <div className="max-w-xl w-full space-y-8">
        <div className="text-center space-y-2">
          <button onClick={onBack} className="text-xs text-neutral-700 hover:text-neutral-400 transition mb-1 block mx-auto">
            ← Parallax
          </button>
          <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Chapters</div>
          <h1 className="text-3xl font-bold tracking-tight">Choose a Chapter</h1>
        </div>
        <div className="space-y-3">
          {LEVELS.map((level) => {
            const available = level.component !== null
            return (
              <button
                key={level.id}
                onClick={() => available && onSelect(level.id)}
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

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,  setPage]  = useState('home')
  const [level, setLevel] = useState(null)
  const audioRef = useRef(null)

  const startBGM = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(bgmSrc)
      audioRef.current.loop = true
      audioRef.current.volume = 0.55
    }
    audioRef.current.play().catch(() => {})
  }, [])

  const handlePlay = useCallback(() => {
    startBGM()
    setPage('intro')
  }, [startBGM])

  if (level !== null) {
    const lvl = LEVELS.find(l => l.id === level)
    const Comp = lvl?.component
    if (Comp) return (
      <div>
        <button
          onClick={() => setLevel(null)}
          className="fixed top-4 left-4 z-50 px-3 py-1.5 rounded-xl bg-white/90 border border-neutral-200 text-sm text-neutral-700 hover:bg-white shadow-sm"
        >
          ← Back
        </button>
        <Comp />
      </div>
    )
  }

  if (page === 'home')  return <HomePage  onPlay={handlePlay} />
  if (page === 'intro') return <IntroPage onBack={() => setPage('home')} onNext={() => setPage('levels')} />
  return <LevelsPage onBack={() => setPage('intro')} onSelect={(id) => setLevel(id)} />
}
