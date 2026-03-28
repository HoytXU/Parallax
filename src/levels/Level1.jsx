import { useEffect, useRef } from 'react'

// ─── Level 1 · Position ── many frames in one void ────────────────────────────
// Full-window canvas.  Y increases downward.
// The player's rest frame = the surface they're standing on.
// Camera rolls (rotates) to match that frame; in air → world-level view.

const PW = 14
const PH = 12
const FOOT = 2
const WALK = 210
const JUMP = 430
const AIR_DRAG = 0.38
const CAM_LERP = 13
const LAND_DIST = 16
const LAND_VN_MAX = 95
const PLAT_HALF_H = 9
const AIR_THRUST = 340    // px/s² — free-space thruster
const MAX_AIR_SPD = 580   // px/s — top speed in air
const VIEW_ZOOM = 1.45
const TAU = Math.PI * 2

// ─── Math helpers ─────────────────────────────────────────────────────────────

function normAngle(a) {
  let x = a % TAU
  if (x > Math.PI) x -= TAU
  if (x < -Math.PI) x += TAU
  return x
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function localToWorld(lx, ly, cx, cy, th) {
  const c = Math.cos(th), s = Math.sin(th)
  return { x: cx + lx * c - ly * s, y: cy + lx * s + ly * c }
}

function worldToLocal(wx, wy, cx, cy, th) {
  const dx = wx - cx, dy = wy - cy
  const c = Math.cos(th), s = Math.sin(th)
  return { x: dx * c + dy * s, y: -dx * s + dy * c }
}

function localVecToWorld(lvx, lvy, th) {
  const c = Math.cos(th), s = Math.sin(th)
  return { x: lvx * c - lvy * s, y: lvx * s + lvy * c }
}

function velAtLocal(lx, ly, tr) {
  const { vcx, vcy, om, th } = tr
  const rx = lx * Math.cos(th) - ly * Math.sin(th)
  const ry = lx * Math.sin(th) + ly * Math.cos(th)
  return { vx: vcx - om * ry, vy: vcy + om * rx }
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay
  const ab2 = abx * abx + aby * aby || 1e-8
  let t = ((px - ax) * abx + (py - ay) * aby) / ab2
  t = clamp(t, 0, 1)
  const qx = ax + abx * t, qy = ay + aby * t
  return { d: Math.hypot(px - qx, py - qy), qx, qy, t }
}

// ─── Stars (deterministic golden-angle) ──────────────────────────────────────

const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const STARS = Array.from({ length: 280 }, (_, i) => {
  const g = i * GOLDEN
  const u = (i / 280) % 1
  const h = Math.sin(i * 12.9898) * 43758.5453
  const r = 0.3 + (h - Math.floor(h) + 1) * 0.55
  const hue = 180 + (Math.sin(i * 7.3) * 60)
  return { g, u, r, hue }
})

// ─── World bodies ─────────────────────────────────────────────────────────────
//
//  Each body has:
//    id, label, kind, w                    — identity & platform width
//    transform(t) → {cx,cy,th,vcx,vcy,om} — rigid pose + velocity at time t
//    surfaceYLocal                         — local-y of the landable top face
//    color, rim                            — platform fill / stroke

function buildBodies() {
  return [

    // ── 1 · ICE DRIFTER ──────────────────────────────────────────────────────
    // Lissajous path (irrational frequency ratio) — figure-of-8-ish, no spin.
    // Wide platform, starting point for the player.
    {
      id: 'drift',
      label: 'Ice Drifter',
      kind: 'drifter',
      w: 210,
      transform(t) {
        const Ax = 88, fx = 0.28, Ay = 50, fy = 0.43, ph = 1.1
        const cx = 510 + Ax * Math.sin(fx * t)
        const cy = 350 + Ay * Math.sin(fy * t + ph)
        return {
          cx, cy, th: 0,
          vcx: Ax * fx * Math.cos(fx * t),
          vcy: Ay * fy * Math.cos(fy * t + ph),
          om: 0,
        }
      },
      surfaceYLocal: -PLAT_HALF_H,
      color: 'rgba(170, 230, 255, 0.94)',
      rim:   'rgba(220, 250, 255, 0.9)',
    },

    // ── 2 · PULSAR ────────────────────────────────────────────────────────────
    // Fixed position, extreme spin (om = 3.6 rad/s).
    // The platform is a narrow beam that sweeps almost too fast to see.
    {
      id: 'pulsar',
      label: 'Pulsar',
      kind: 'pulsar',
      w: 84,
      transform(t) {
        return { cx: 660, cy: 230, th: 3.6 * t, vcx: 0, vcy: 0, om: 3.6 }
      },
      surfaceYLocal: -PLAT_HALF_H,
      color: 'rgba(255, 255, 230, 0.98)',
      rim:   'rgba(255, 245, 160, 1.0)',
    },

    // ── 3 · COMET ─────────────────────────────────────────────────────────────
    // Eccentric elliptical orbit, tilted -18°.  Surface stays world-level (th=0).
    // Fastest near periapsis (small-y end of the tilt).
    {
      id: 'comet',
      label: 'Comet',
      kind: 'comet',
      w: 138,
      _o: { ocx: 790, ocy: 380, rx: 170, ry: 58, tilt: -0.32, wo: 0.30 },
      transform(t) {
        const { ocx, ocy, rx, ry, tilt, wo } = this._o
        const angle = wo * t
        const cosT = Math.cos(tilt), sinT = Math.sin(tilt)
        const ex = rx * Math.cos(angle), ey = ry * Math.sin(angle)
        const dex = -rx * wo * Math.sin(angle), dey = ry * wo * Math.cos(angle)
        return {
          cx: ocx + ex * cosT - ey * sinT,
          cy: ocy + ex * sinT + ey * cosT,
          th: 0,
          vcx: dex * cosT - dey * sinT,
          vcy: dex * sinT + dey * cosT,
          om: 0,
        }
      },
      surfaceYLocal: -PLAT_HALF_H,
      color: 'rgba(200, 248, 235, 0.92)',
      rim:   'rgba(150, 240, 210, 0.8)',
    },

    // ── 4 · BINARY-α ─────────────────────────────────────────────────────────
    // Orbits a common barycentre with Binary-β.  Pro-grade spin (same direction
    // as orbit) — standing on it you feel the world counter-rotate rapidly.
    {
      id: 'binaryA',
      label: 'Binary-α',
      kind: 'binary',
      w: 118,
      _b: { bcx: 970, bcy: 310, R: 70, wo: 1.28, sp: 1.0, ph: 0 },
      transform(t) {
        const { bcx, bcy, R, wo, sp, ph } = this._b
        const angle = wo * t + ph
        return {
          cx: bcx + R * Math.cos(angle),
          cy: bcy + R * Math.sin(angle),
          th: (wo + sp) * t + ph,
          vcx: -R * wo * Math.sin(angle),
          vcy:  R * wo * Math.cos(angle),
          om: wo + sp,
        }
      },
      surfaceYLocal: -PLAT_HALF_H,
      color: 'rgba(255, 195, 115, 0.94)',
      rim:   'rgba(255, 155, 55, 0.9)',
    },

    // ── 5 · BINARY-β ─────────────────────────────────────────────────────────
    // Opposite side of barycentre; retro spin — world appears to spin the
    // other way when you jump across from Binary-α.
    {
      id: 'binaryB',
      label: 'Binary-β',
      kind: 'binary',
      w: 96,
      _b: { bcx: 970, bcy: 310, R: 70, wo: 1.28, sp: -1.45, ph: Math.PI },
      transform(t) {
        const { bcx, bcy, R, wo, sp, ph } = this._b
        const angle = wo * t + ph
        return {
          cx: bcx + R * Math.cos(angle),
          cy: bcy + R * Math.sin(angle),
          th: (wo + sp) * t + ph,
          vcx: -R * wo * Math.sin(angle),
          vcy:  R * wo * Math.cos(angle),
          om: wo + sp,
        }
      },
      surfaceYLocal: -PLAT_HALF_H,
      color: 'rgba(185, 155, 255, 0.94)',
      rim:   'rgba(215, 185, 255, 0.9)',
    },

    // ── 6 · MOON (tidally locked) ─────────────────────────────────────────────
    // Orbits a gas giant.  Tidally locked: th = orbit-angle + π/2, so the
    // platform face always points away from the gas giant.
    // The rest frame here rotates slowly with orbital period — sky drifts serenely.
    {
      id: 'moon',
      label: 'Moon',
      kind: 'moon',
      w: 168,
      _m: { gcx: 810, gcy: 195, R: 122, wo: 0.25 },
      transform(t) {
        const { gcx, gcy, R, wo } = this._m
        const angle = wo * t
        return {
          cx: gcx + R * Math.cos(angle),
          cy: gcy + R * Math.sin(angle),
          th: angle + Math.PI / 2,   // tidally locked
          vcx: -R * wo * Math.sin(angle),
          vcy:  R * wo * Math.cos(angle),
          om: wo,
        }
      },
      surfaceYLocal: -PLAT_HALF_H,
      color: 'rgba(215, 210, 200, 0.95)',
      rim:   'rgba(245, 240, 230, 0.8)',
    },

    // ── 7 · TUMBLER ───────────────────────────────────────────────────────────
    // A tumbling asteroid: fast retrograde spin + slow figure-of-8 drift.
    // Very disorienting rest frame — the sky spins 2.3 rad/s backward.
    {
      id: 'tumbler',
      label: 'Tumbler',
      kind: 'tumbler',
      w: 106,
      transform(t) {
        const cx = 385 + 108 * Math.sin(0.22 * t)
        const cy = 495 + 62 * Math.sin(0.44 * t + 0.9)
        const om = -2.3
        return {
          cx, cy, th: om * t,
          vcx: 108 * 0.22 * Math.cos(0.22 * t),
          vcy:  62 * 0.44 * Math.cos(0.44 * t + 0.9),
          om,
        }
      },
      surfaceYLocal: -PLAT_HALF_H,
      color: 'rgba(200, 178, 142, 0.92)',
      rim:   'rgba(225, 205, 168, 0.8)',
    },

    // ── 8 · RING BELT ─────────────────────────────────────────────────────────
    // A large spinning ring. The platform rides the outer edge: th = ω·t + π/2
    // so its "up" face always points radially away from the ring centre.
    // From the rest frame, the whole universe revolves around the ring axis.
    {
      id: 'ringBelt',
      label: 'Ring Belt',
      kind: 'ringBelt',
      w: 90,
      _r: { rcx: 640, rcy: 490, R: 100, om: 0.68 },
      transform(t) {
        const { rcx, rcy, R, om } = this._r
        const angle = om * t
        return {
          cx:  rcx + R * Math.cos(angle),
          cy:  rcy + R * Math.sin(angle),
          th:  angle + Math.PI / 2,   // surface always faces outward
          vcx: -R * om * Math.sin(angle),
          vcy:  R * om * Math.cos(angle),
          om,
        }
      },
      surfaceYLocal: -PLAT_HALF_H,
      color: 'rgba(255, 200, 100, 0.96)',
      rim:   'rgba(255, 160, 40, 1.0)',
    },
  ]
}

function bodyTransform(body, t) { return body.transform(t) }

function surfaceGeometry(body, t) {
  const tr = bodyTransform(body, t)
  const { cx, cy, th } = tr
  const { w } = body
  const y0 = body.surfaceYLocal
  const p0 = localToWorld(-w / 2, y0, cx, cy, th)
  const p1 = localToWorld( w / 2, y0, cx, cy, th)
  const n = localVecToWorld(0, -1, th)
  const len = Math.hypot(n.x, n.y) || 1
  n.x /= len; n.y /= len
  return { tr, p0, p1, n, tangent: { x: Math.cos(th), y: Math.sin(th) }, w }
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────

function rrPath(ctx, x, y, rw, rh, rad) {
  const r = Math.min(rad, rw / 2, rh / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + rw, y,      x + rw, y + rh, r)
  ctx.arcTo(x + rw, y + rh, x,      y + rh, r)
  ctx.arcTo(x,      y + rh, x,      y,      r)
  ctx.arcTo(x,      y,      x + rw, y,      r)
  ctx.closePath()
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function drawStars(ctx, W, H, camX, camY, viewAngle, now, zoom) {
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-viewAngle)
  ctx.scale(zoom, zoom)
  ctx.translate(-camX, -camY)
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i]
    const rad = Math.min(W, H) * (0.38 + s.u * 0.85)
    const x = W * 0.5 + Math.cos(s.g) * rad + Math.sin(s.g * 3.1) * 38
    const y = H * 0.5 + Math.sin(s.g * 1.07) * rad * 0.82 + Math.cos(s.g * 2.2) * 32
    const tw = 0.55 + 0.45 * Math.sin(now * 0.0009 + i * 0.31)
    ctx.fillStyle = `hsla(${s.hue},65%,88%,${0.1 + tw * 0.22})`
    ctx.beginPath()
    ctx.arc(x, y, s.r, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

// ─── Background decorations (orbit paths, central bodies) ─────────────────────
// Drawn BEFORE platforms so they appear behind everything.

function drawBodyDecorsBg(ctx, bodies, t, now) {
  for (const b of bodies) {

    // ── Ice Drifter: faint Lissajous sample ──────────────────────────────────
    if (b.kind === 'drifter') {
      ctx.save()
      const N = 60
      for (let i = 0; i < N; i++) {
        const tt = t - 5 + i * (10 / N)
        const tr = b.transform(tt)
        const frac = i / N
        ctx.fillStyle = `rgba(170,230,255,${frac * 0.06})`
        ctx.beginPath()
        ctx.arc(tr.cx, tr.cy, 14, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }

    // ── Pulsar: expanding beacon rings ────────────────────────────────────────
    if (b.kind === 'pulsar') {
      const tr = b.transform(t)
      ctx.save()
      // Outer corona
      const corona = ctx.createRadialGradient(tr.cx, tr.cy, 0, tr.cx, tr.cy, 80)
      corona.addColorStop(0,   'rgba(255,255,200,0.60)')
      corona.addColorStop(0.2, 'rgba(255,255,140,0.20)')
      corona.addColorStop(0.6, 'rgba(255,240,80,0.06)')
      corona.addColorStop(1,   'transparent')
      ctx.fillStyle = corona
      ctx.beginPath(); ctx.arc(tr.cx, tr.cy, 80, 0, TAU); ctx.fill()
      // Pulsing rings
      for (let ring = 0; ring < 5; ring++) {
        const phase = ((now * 0.0022 + ring * 0.20) % 1)
        const r = 18 + phase * 110
        const a = (1 - phase) * 0.5
        ctx.strokeStyle = `rgba(255,255,180,${a})`
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(tr.cx, tr.cy, r, 0, TAU); ctx.stroke()
      }
      ctx.restore()
    }

    // ── Comet: tilted orbit ellipse ───────────────────────────────────────────
    if (b.kind === 'comet') {
      const { ocx, ocy, rx, ry, tilt } = b._o
      ctx.save()
      ctx.translate(ocx, ocy)
      ctx.rotate(tilt)
      ctx.strokeStyle = 'rgba(150,245,220,0.16)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([8, 14])
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke()
      ctx.setLineDash([])
      // Periapsis marker
      ctx.fillStyle = 'rgba(160,255,220,0.3)'
      ctx.beginPath(); ctx.arc(rx, 0, 5, 0, TAU); ctx.fill()
      ctx.restore()
      // Comet tail (last 12 positions)
      ctx.save()
      ctx.lineCap = 'round'
      for (let i = 1; i <= 12; i++) {
        const tr0 = b.transform(t - i * 0.20)
        const tr1 = b.transform(t - (i - 1) * 0.20)
        const a = 0.30 * (1 - i / 13)
        const lw = 14 * (1 - i / 14)
        ctx.strokeStyle = `rgba(190,255,235,${a})`
        ctx.lineWidth = lw
        ctx.beginPath()
        ctx.moveTo(tr0.cx, tr0.cy)
        ctx.lineTo(tr1.cx, tr1.cy)
        ctx.stroke()
      }
      ctx.restore()
    }

    // ── Binary pair: barycentre star + orbit circles ──────────────────────────
    if (b.kind === 'binary' && b.id === 'binaryA') {
      const { bcx, bcy, R } = b._b
      ctx.save()
      // Star corona at barycentre
      const grd = ctx.createRadialGradient(bcx - 14, bcy - 14, 0, bcx, bcy, 52)
      grd.addColorStop(0,   'rgba(255,220,140,0.95)')
      grd.addColorStop(0.3, 'rgba(255,170,60,0.50)')
      grd.addColorStop(0.7, 'rgba(255,120,20,0.12)')
      grd.addColorStop(1,   'transparent')
      ctx.fillStyle = grd
      ctx.beginPath(); ctx.arc(bcx, bcy, 52, 0, TAU); ctx.fill()
      // Star body
      ctx.fillStyle = 'rgba(255,240,190,0.92)'
      ctx.beginPath(); ctx.arc(bcx, bcy, 14, 0, TAU); ctx.fill()
      // Orbit ring (same for both)
      ctx.strokeStyle = 'rgba(255,180,80,0.20)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 10])
      ctx.beginPath(); ctx.arc(bcx, bcy, R, 0, TAU); ctx.stroke()
      ctx.setLineDash([])
      // Tether between the two platforms
      const trA = b.transform(t)
      const bodyB = bodies.find(x => x.id === 'binaryB')
      if (bodyB) {
        const trB = bodyB.transform(t)
        ctx.strokeStyle = 'rgba(255,200,120,0.18)'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 8])
        ctx.beginPath()
        ctx.moveTo(trA.cx, trA.cy)
        ctx.lineTo(trB.cx, trB.cy)
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.restore()
    }

    // ── Moon: gas giant + ring system + orbit guide ───────────────────────────
    if (b.kind === 'moon') {
      const { gcx, gcy, R } = b._m
      ctx.save()
      // Planet corona
      const grd = ctx.createRadialGradient(gcx - 22, gcy - 22, 0, gcx, gcy, 90)
      grd.addColorStop(0,   'rgba(255,215,155,0.88)')
      grd.addColorStop(0.4, 'rgba(210,155,75,0.55)')
      grd.addColorStop(0.8, 'rgba(150,90,30,0.18)')
      grd.addColorStop(1,   'transparent')
      ctx.fillStyle = grd
      ctx.beginPath(); ctx.arc(gcx, gcy, 90, 0, TAU); ctx.fill()
      // Planet disc
      const disc = ctx.createRadialGradient(gcx - 16, gcy - 16, 2, gcx, gcy, 42)
      disc.addColorStop(0,    'rgba(255,225,170,0.95)')
      disc.addColorStop(0.45, 'rgba(210,155,75,0.88)')
      disc.addColorStop(1,    'rgba(130,75,25,0.80)')
      ctx.fillStyle = disc
      ctx.beginPath(); ctx.arc(gcx, gcy, 42, 0, TAU); ctx.fill()
      // Bands
      for (let bnd = 0; bnd < 4; bnd++) {
        const by = gcy - 16 + bnd * 10
        ctx.save()
        ctx.beginPath(); ctx.arc(gcx, gcy, 42, 0, TAU); ctx.clip()
        ctx.strokeStyle = `rgba(160,100,40,${0.25 - bnd * 0.04})`
        ctx.lineWidth = 5 - bnd
        ctx.beginPath(); ctx.moveTo(gcx - 42, by); ctx.lineTo(gcx + 42, by); ctx.stroke()
        ctx.restore()
      }
      // Ring system (flattened ellipse)
      ctx.save()
      ctx.translate(gcx, gcy); ctx.scale(1, 0.30)
      for (let ri = 0; ri < 3; ri++) {
        const rr = 58 + ri * 14
        const ra = [0.5, 0.30, 0.18][ri]
        const rc = [`rgba(255,210,150,${ra})`, `rgba(220,175,110,${ra})`, `rgba(180,140,80,${ra})`][ri]
        ctx.strokeStyle = rc; ctx.lineWidth = [12, 7, 4][ri]
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke()
      }
      ctx.restore()
      // Orbit guide
      ctx.strokeStyle = 'rgba(200,195,190,0.18)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 12])
      ctx.beginPath(); ctx.arc(gcx, gcy, R, 0, TAU); ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }

    // ── Ring Belt: spinning hoop + evenly-spaced nodes ───────────────────────
    if (b.kind === 'ringBelt') {
      const { rcx, rcy, R, om } = b._r
      ctx.save()
      // Outer glow halo
      const halo = ctx.createRadialGradient(rcx, rcy, R - 18, rcx, rcy, R + 18)
      halo.addColorStop(0,   'rgba(255,185,60,0.0)')
      halo.addColorStop(0.4, 'rgba(255,185,60,0.28)')
      halo.addColorStop(0.6, 'rgba(255,185,60,0.28)')
      halo.addColorStop(1,   'rgba(255,185,60,0.0)')
      ctx.fillStyle = halo
      ctx.beginPath(); ctx.arc(rcx, rcy, R + 18, 0, TAU); ctx.fill()
      ctx.beginPath(); ctx.arc(rcx, rcy, R - 18, 0, TAU)
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fill(); ctx.restore()

      // Main ring stroke (two concentric lines for a band look)
      ctx.strokeStyle = 'rgba(255, 195, 70, 0.90)'; ctx.lineWidth = 6
      ctx.beginPath(); ctx.arc(rcx, rcy, R, 0, TAU); ctx.stroke()
      ctx.strokeStyle = 'rgba(255, 230, 160, 0.40)'; ctx.lineWidth = 14
      ctx.beginPath(); ctx.arc(rcx, rcy, R, 0, TAU); ctx.stroke()
      ctx.strokeStyle = 'rgba(200, 130, 30, 0.55)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(rcx, rcy, R - 8, 0, TAU); ctx.stroke()
      ctx.beginPath(); ctx.arc(rcx, rcy, R + 8, 0, TAU); ctx.stroke()

      // Evenly-spaced nodes rotating with the ring
      const NODES = 12
      for (let i = 0; i < NODES; i++) {
        const angle = om * t + (i / NODES) * TAU
        const nx = rcx + R * Math.cos(angle)
        const ny = rcy + R * Math.sin(angle)
        const isPlat = i === 0  // node 0 is under the platform
        ctx.fillStyle = isPlat ? 'rgba(255,230,120,0.95)' : 'rgba(255,190,80,0.65)'
        ctx.beginPath(); ctx.arc(nx, ny, isPlat ? 5.5 : 3.5, 0, TAU); ctx.fill()
        if (isPlat) {
          ctx.strokeStyle = 'rgba(255,255,200,0.7)'; ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      // Centre hub
      const hub = ctx.createRadialGradient(rcx, rcy, 0, rcx, rcy, 16)
      hub.addColorStop(0,   'rgba(255,220,140,0.55)')
      hub.addColorStop(0.6, 'rgba(200,140,40,0.20)')
      hub.addColorStop(1,   'transparent')
      ctx.fillStyle = hub
      ctx.beginPath(); ctx.arc(rcx, rcy, 16, 0, TAU); ctx.fill()

      // Spokes (4 rotating with the ring)
      ctx.strokeStyle = 'rgba(255,185,60,0.22)'; ctx.lineWidth = 1.5
      for (let s = 0; s < 4; s++) {
        const sa = om * t + (s / 4) * TAU
        ctx.beginPath()
        ctx.moveTo(rcx + 8 * Math.cos(sa), rcy + 8 * Math.sin(sa))
        ctx.lineTo(rcx + (R - 6) * Math.cos(sa), rcy + (R - 6) * Math.sin(sa))
        ctx.stroke()
      }
      ctx.restore()
    }

    // ── Tumbler: rocky silhouette ─────────────────────────────────────────────
    if (b.kind === 'tumbler') {
      const tr = b.transform(t)
      // Faint drift trail
      ctx.save()
      for (let i = 1; i <= 10; i++) {
        const ptr = b.transform(t - i * 0.14)
        ctx.fillStyle = `rgba(200,178,140,${0.07 * (1 - i / 11)})`
        ctx.beginPath(); ctx.arc(ptr.cx, ptr.cy, 22 - i * 1.5, 0, TAU); ctx.fill()
      }
      // Rocky body (irregular polygon, spins slower than platform slab)
      ctx.translate(tr.cx, tr.cy)
      ctx.rotate(tr.th * 0.35)
      const verts = [
        [ 0, -36], [20, -24], [38,  -8], [32, 16],
        [14,  34], [-8, 38], [-30, 26], [-38,  2],
        [-30, -18], [-14, -34],
      ]
      ctx.fillStyle = 'rgba(155,135,105,0.35)'
      ctx.strokeStyle = 'rgba(210,190,158,0.45)'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(verts[0][0], verts[0][1])
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i][0], verts[i][1])
      ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.restore()
    }
  }
}

// ─── Foreground decorations (glow pulses, labels) ────────────────────────────
// Drawn AFTER platforms so they appear on top.

function drawBodyDecorsFg(ctx, bodies, t, now) {
  for (const b of bodies) {

    // Pulsar beacon flash
    if (b.kind === 'pulsar') {
      const tr = b.transform(t)
      const ph = (now * 0.0018) % 1
      const a = ph < 0.12 ? ph / 0.12 : ph < 0.42 ? 1 - (ph - 0.12) / 0.30 : 0
      if (a > 0.01) {
        ctx.save()
        const g = ctx.createRadialGradient(tr.cx, tr.cy, 0, tr.cx, tr.cy, 130)
        g.addColorStop(0, `rgba(255,255,240,${a * 0.55})`)
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(tr.cx, tr.cy, 130, 0, TAU); ctx.fill()
        ctx.restore()
      }
    }

    // Platform label floating above each body
    const tr = b.transform(t)
    const th = tr.th
    const lx = 0, ly = -PLAT_HALF_H - 18
    const lw = localToWorld(lx, ly, tr.cx, tr.cy, th)
    ctx.save()
    ctx.translate(lw.x, lw.y)
    ctx.rotate(th)
    ctx.fillStyle = 'rgba(200,220,255,0.55)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(b.label, 0, 0)
    ctx.restore()
  }
}

// ─── Platform slab ────────────────────────────────────────────────────────────

function drawPlat(ctx, body, t) {
  const { cx, cy, th } = bodyTransform(body, t)
  const hw = body.w / 2, hh = PLAT_HALF_H
  ctx.save()
  ctx.translate(cx, cy); ctx.rotate(th)
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5
  ctx.fillStyle = body.color
  rrPath(ctx, -hw, -hh, body.w, hh * 2, 6); ctx.fill()
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.strokeStyle = body.rim; ctx.lineWidth = 3
  rrPath(ctx, -hw, -hh, body.w, hh * 2, 6); ctx.stroke()
  // Highlight strip
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  rrPath(ctx, -hw + 4, -hh + 2, body.w - 8, 5, 2); ctx.fill()
  // Shadow strip
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(-hw, hh - 4, body.w, 4)
  ctx.restore()
}

// ─── Thruster exhaust glow ────────────────────────────────────────────────────

function drawThrustFX(ctx, px, py, tax, tay, now) {
  const mag = Math.hypot(tax, tay)
  if (mag < 1) return
  // Exhaust exits in the direction OPPOSITE to thrust
  const nx = tax / mag, ny = tay / mag
  const ex = px - nx * 10, ey = py - ny * 10
  ctx.save()
  // Core plume
  const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 22)
  g.addColorStop(0,   'rgba(200, 235, 255, 0.95)')
  g.addColorStop(0.3, 'rgba(100, 185, 255, 0.50)')
  g.addColorStop(1,   'transparent')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(ex, ey, 22, 0, TAU); ctx.fill()
  // Particle streaks fading further back
  for (let i = 1; i <= 6; i++) {
    const wobble = Math.sin(now * 0.014 + i * 1.9) * 3
    const sx = ex - nx * (i * 6) + (-ny) * wobble
    const sy = ey - ny * (i * 6) +   nx  * wobble
    const a  = 0.22 * (1 - i / 7)
    ctx.fillStyle = `rgba(140, 210, 255, ${a})`
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.5, 5 - i * 0.7), 0, TAU); ctx.fill()
  }
  ctx.restore()
}

// ─── Player box ───────────────────────────────────────────────────────────────

function drawPlayer(ctx, wx, wy, thPlayer) {
  ctx.save()
  ctx.translate(wx, wy); ctx.rotate(thPlayer)
  ctx.shadowColor = 'rgba(255,255,255,0.30)'; ctx.shadowBlur = 10
  ctx.fillStyle = 'rgba(252, 244, 232, 1)'
  rrPath(ctx, -PW / 2, -PH / 2, PW, PH, 3); ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(35,30,25,0.92)'; ctx.lineWidth = 2
  rrPath(ctx, -PW / 2, -PH / 2, PW, PH, 3); ctx.stroke()
  ctx.fillStyle = 'rgba(50,40,30,0.9)'
  ctx.fillRect(-3,  -PH / 2 + 3, 2, 3)
  ctx.fillRect( 1,  -PH / 2 + 3, 2, 3)
  ctx.restore()
}

// ─── Frame HUD ────────────────────────────────────────────────────────────────

function drawFrameHud(ctx, W, H, viewAngle, vxLoc, vyLoc, speed, bodyLabel, attached) {
  const px = 18, py = H - 134, pw = 172, ph = 120
  ctx.save()
  ctx.fillStyle = 'rgba(5,9,20,0.90)'
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 11); ctx.fill()
  ctx.strokeStyle = 'rgba(110,165,255,0.38)'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 11); ctx.stroke()

  ctx.fillStyle = 'rgba(165,200,255,0.80)'
  ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left'
  ctx.fillText('YOUR FRAME', px + 12, py + 16)
  ctx.strokeStyle = 'rgba(95,135,215,0.22)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(px + 10, py + 22); ctx.lineTo(px + pw - 10, py + 22); ctx.stroke()

  const cx0 = px + pw / 2, cy0 = py + 57, axLen = 36
  ctx.translate(cx0, cy0)
  ctx.rotate(-viewAngle)
  // X axis
  ctx.strokeStyle = 'rgba(255,110,110,0.92)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(axLen, 0); ctx.stroke()
  ctx.fillStyle = 'rgba(255,130,130,0.95)'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left'
  ctx.fillText('x', axLen + 3, 4)
  // Y axis
  ctx.strokeStyle = 'rgba(110,195,255,0.92)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, axLen); ctx.stroke()
  ctx.fillStyle = 'rgba(130,205,255,0.95)'; ctx.textAlign = 'left'
  ctx.fillText('y', 4, axLen + 10)
  // Velocity arrow
  ctx.rotate(viewAngle)
  const mag = Math.min(1, speed / 400)
  if (mag > 0.04) {
    const ang = Math.atan2(vyLoc, vxLoc), arr = 32 * mag
    ctx.strokeStyle = `rgba(255,230,140,${0.5 + mag * 0.45})`; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * arr, Math.sin(ang) * arr); ctx.stroke()
    ctx.fillStyle = 'rgba(255,240,200,0.95)'
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill()
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill()
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = 'rgba(155,178,210,0.88)'; ctx.font = '9px monospace'; ctx.textAlign = 'left'
  ctx.fillText(`|v| ≈ ${speed.toFixed(0)} px/s`, px + 12, py + ph - 28)
  ctx.fillStyle = 'rgba(125,148,178,0.68)'; ctx.font = '8px monospace'
  ctx.fillText(attached ? `on · ${bodyLabel}` : 'inertial (air)', px + 12, py + ph - 12)
  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Level1() {
  const canvasRef = useRef(null)
  const keysRef   = useRef(new Set())

  useEffect(() => {
    const down = (e) => {
      keysRef.current.add(e.code)
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault()
    }
    const up = (e) => keysRef.current.delete(e.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const bodies = buildBodies()
    const bodyById = Object.fromEntries(bodies.map(b => [b.id, b]))

    const t0 = performance.now() / 1000
    const tr0 = bodyById.drift.transform(t0)
    const startCLY = bodyById.drift.surfaceYLocal - PH - FOOT

    const state = {
      px: localToWorld(0, startCLY, tr0.cx, tr0.cy, tr0.th).x,
      py: localToWorld(0, startCLY, tr0.cx, tr0.cy, tr0.th).y,
      vx: tr0.vcx, vy: tr0.vcy,
      attachedId: 'drift',
      lx: 0,
      viewAngle: tr0.th,
      jumpLatch: false,
    }

    let raf = 0, last = performance.now()

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const tick = (now) => {
      const W = canvas.width, H = canvas.height
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const t = now / 1000

      const k = keysRef.current
      const left    = k.has('ArrowLeft')  || k.has('KeyA')
      const right   = k.has('ArrowRight') || k.has('KeyD')
      const jumpKey = k.has('Space')      || k.has('ArrowUp') || k.has('KeyW')

      let targetView = 0, vxLoc = 0, vyLoc = 0, speed = 0, hudLabel = '—'
      let thrustX = 0, thrustY = 0

      if (state.attachedId) {
        const body = bodyById[state.attachedId]
        const geom = surfaceGeometry(body, t)
        const tr   = geom.tr
        hudLabel    = body.label || body.id
        targetView  = tr.th

        const footLY   = body.surfaceYLocal - FOOT
        const centerLY = body.surfaceYLocal - PH - FOOT
        const vSurf    = velAtLocal(state.lx, footLY, tr)

        let along = 0
        if (left)  along -= WALK
        if (right) along += WALK
        state.lx = clamp(state.lx + along * dt, -body.w / 2 + PW / 2 + 2, body.w / 2 - PW / 2 - 2)

        state.vx = vSurf.vx + geom.tangent.x * along
        state.vy = vSurf.vy + geom.tangent.y * along
        state.px = localToWorld(state.lx, centerLY, tr.cx, tr.cy, tr.th).x
        state.py = localToWorld(state.lx, centerLY, tr.cx, tr.cy, tr.th).y

        const c = Math.cos(-tr.th), s = Math.sin(-tr.th)
        vxLoc = state.vx * c - state.vy * s
        vyLoc = state.vx * s + state.vy * c
        speed = Math.hypot(state.vx, state.vy)

        if (jumpKey && !state.jumpLatch) {
          const jw = localVecToWorld(0, -1, tr.th)
          state.vx = vSurf.vx + jw.x * JUMP
          state.vy = vSurf.vy + jw.y * JUMP
          state.attachedId = null
        }
      } else {
        // ── Directional air thrust (all 4 directions in world space) ──────────
        const tax = (right ? AIR_THRUST : 0) - (left ? AIR_THRUST : 0)
        const tay = (k.has('KeyS') || k.has('ArrowDown') ? AIR_THRUST : 0)
                  - (k.has('KeyW') || k.has('ArrowUp')   ? AIR_THRUST : 0)
        state.vx += tax * dt
        state.vy += tay * dt
        // Hard speed cap
        const rawSpd = Math.hypot(state.vx, state.vy)
        if (rawSpd > MAX_AIR_SPD) {
          state.vx = state.vx / rawSpd * MAX_AIR_SPD
          state.vy = state.vy / rawSpd * MAX_AIR_SPD
        }
        thrustX = tax; thrustY = tay
        // Passive drag
        state.vx *= Math.exp(-AIR_DRAG * dt)
        state.vy *= Math.exp(-AIR_DRAG * dt)
        state.px += state.vx * dt
        state.py += state.vy * dt
        vxLoc = state.vx; vyLoc = state.vy
        speed = Math.hypot(state.vx, state.vy)

        const footX = state.px, footY = state.py + PH / 2 + FOOT
        let best = null
        for (const b of bodies) {
          const g = surfaceGeometry(b, t)
          const hit = distToSegment(footX, footY, g.p0.x, g.p0.y, g.p1.x, g.p1.y)
          if (hit.t < 0.03 || hit.t > 0.97) continue
          const locQ  = worldToLocal(hit.qx, hit.qy, g.tr.cx, g.tr.cy, g.tr.th)
          const vPlat = velAtLocal(locQ.x, locQ.y, g.tr)
          const vn    = (state.vx - vPlat.vx) * g.n.x + (state.vy - vPlat.vy) * g.n.y
          const side  = (footX - hit.qx) * g.n.x + (footY - hit.qy) * g.n.y
          if (hit.d < LAND_DIST && vn < LAND_VN_MAX && side >= -2) {
            if (!best || hit.d < best.d) best = { d: hit.d, b, g }
          }
        }
        if (best) {
          const { b, g } = best
          const loc  = worldToLocal(state.px, state.py, g.tr.cx, g.tr.cy, g.tr.th)
          state.lx   = clamp(loc.x, -b.w / 2 + PW / 2 + 2, b.w / 2 - PW / 2 - 2)
          state.attachedId = b.id
          const footLY   = b.surfaceYLocal - FOOT
          const centerLY = b.surfaceYLocal - PH - FOOT
          const vSurf = velAtLocal(state.lx, footLY, g.tr)
          const tang  = state.vx * g.tangent.x + state.vy * g.tangent.y
          state.vx = vSurf.vx + g.tangent.x * tang
          state.vy = vSurf.vy + g.tangent.y * tang
          state.px = localToWorld(state.lx, centerLY, g.tr.cx, g.tr.cy, g.tr.th).x
          state.py = localToWorld(state.lx, centerLY, g.tr.cx, g.tr.cy, g.tr.th).y
          targetView = g.tr.th; hudLabel = b.label || b.id
          const c = Math.cos(-g.tr.th), s = Math.sin(-g.tr.th)
          vxLoc = state.vx * c - state.vy * s
          vyLoc = state.vx * s + state.vy * c
          speed = Math.hypot(state.vx, state.vy)
        }
      }

      state.jumpLatch  = jumpKey
      state.viewAngle += normAngle(targetView - state.viewAngle) * Math.min(1, CAM_LERP * dt)

      // ── Render ──
      const camX = state.px, camY = state.py

      const bg = ctx.createRadialGradient(W * 0.5, H * 0.44, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.78)
      bg.addColorStop(0, '#0c1228'); bg.addColorStop(0.4, '#060912'); bg.addColorStop(1, '#020408')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

      drawStars(ctx, W, H, camX, camY, state.viewAngle, now, VIEW_ZOOM)

      ctx.save()
      ctx.translate(W / 2, H / 2)
      ctx.rotate(-state.viewAngle)
      ctx.scale(VIEW_ZOOM, VIEW_ZOOM)
      ctx.translate(-camX, -camY)

      drawBodyDecorsBg(ctx, bodies, t, now)
      for (const b of bodies) drawPlat(ctx, b, t)

      if (!state.attachedId) drawThrustFX(ctx, state.px, state.py, thrustX, thrustY, now)
      const thDraw = state.attachedId ? bodyTransform(bodyById[state.attachedId], t).th : 0
      drawPlayer(ctx, state.px, state.py, thDraw)

      drawBodyDecorsFg(ctx, bodies, t, now)
      ctx.restore()

      drawFrameHud(ctx, W, H, state.viewAngle, vxLoc, vyLoc, speed, hudLabel, Boolean(state.attachedId))

      ctx.fillStyle = 'rgba(195,210,230,0.50)'
      ctx.font = '10px monospace'; ctx.textAlign = 'right'
      ctx.fillText('A D · walk on surface   Space · jump   WASD / ↑↓←→ · steer in air', W - 16, 24)

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full block bg-[#020408]" />
}
