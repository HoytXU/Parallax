import React, { useEffect, useRef, useState } from "react";

// ─────── Frame Axes Gizmo ───────
// Shows a 3D coordinate axes widget reflecting the current anchor frame's
// orientation. Axes rotate when anchored to a spinning/swinging object.
function FrameGizmo({ angle, vx, vy }) {
  const S = 76, C = 38, L = 24;
  const spd = Math.round(Math.sqrt((vx ?? 0) ** 2 + (vy ?? 0) ** 2));

  // X axis: points right in world, rotated by current frame angle
  // Y axis: points up in world (screen-y is inverted, so base = (0,-1)), rotated
  // Z axis: points out of screen — shown as short dashed diagonal, doesn't rotate in XY
  const xe = { x: C + Math.cos(angle) * L, y: C + Math.sin(angle) * L };
  const ye = { x: C + Math.sin(angle) * L, y: C - Math.cos(angle) * L };
  const ze = { x: C - L * 0.52, y: C - L * 0.52 };

  const arrowTip = (tip, color, sz = 5) => {
    const dx = tip.x - C, dy = tip.y - C;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / d, ny = dy / d, px = -ny, py = nx;
    const pts = [
      `${tip.x - nx * sz + px * sz * 0.42},${tip.y - ny * sz + py * sz * 0.42}`,
      `${tip.x},${tip.y}`,
      `${tip.x - nx * sz - px * sz * 0.42},${tip.y - ny * sz - py * sz * 0.42}`,
    ].join(" ");
    return <polygon points={pts} fill={color} />;
  };

  return (
    <div className="absolute bottom-4 left-4 rounded-xl bg-black/55 backdrop-blur-sm p-1.5 pointer-events-none select-none">
      <svg width={S} height={S}>
        {/* Z — dashed, going into depth */}
        <line x1={C} y1={C} x2={ze.x} y2={ze.y} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="3,2.5" />
        <circle cx={ze.x} cy={ze.y} r="2.5" fill="#60a5fa" />
        <text x={ze.x - 9} y={ze.y + 1} fill="#60a5fa" fontSize="8" fontFamily="monospace">Z</text>
        {/* Y — green, up */}
        <line x1={C} y1={C} x2={ye.x} y2={ye.y} stroke="#4ade80" strokeWidth="2" />
        {arrowTip(ye, "#4ade80")}
        <text
          x={ye.x + (ye.x > C ? 3 : -12)}
          y={ye.y + (ye.y < C ? -3 : 10)}
          fill="#4ade80" fontSize="8" fontFamily="monospace"
        >Y</text>
        {/* X — red, right */}
        <line x1={C} y1={C} x2={xe.x} y2={xe.y} stroke="#f87171" strokeWidth="2" />
        {arrowTip(xe, "#f87171")}
        <text
          x={xe.x + (xe.x > C ? 3 : -12)}
          y={xe.y + (xe.y > C ? 10 : -3)}
          fill="#f87171" fontSize="8" fontFamily="monospace"
        >X</text>
        {/* Origin */}
        <circle cx={C} cy={C} r="3" fill="white" />
      </svg>
      <div className="text-[9px] text-white/55 text-center font-mono leading-none mt-0.5">
        {spd > 3 ? `${spd} px/s` : "still"}
      </div>
    </div>
  );
}

// ─────── Main Component ───────
export default function FrameShiftDemo() {
  const WORLD_W = 1280;
  const WORLD_H = 460;
  const PLAYER_W = 26;
  const PLAYER_H = 34;
  const GRAVITY = 1700;
  const MOVE_SPEED = 240;
  const JUMP_SPEED = 620;
  const FIXED_DT = 1 / 60;
  const VIEWPORT_W = 1180;
  const VIEWPORT_H = 660;
  const VIEW_SCALE = 0.8;
  const VIEW_LERP = 0.14;

  const rectsOverlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const anchorLabel = (id) =>
    ({ left: "Ground", train: "Train", boxA: "Box A", boxB: "Box B",
       pendulum: "Pendulum", elevator: "Elevator", ring: "Ring", player: "Player" }[id] ?? id);

  // ── Level layout ──────────────────────────────────────────────────────────
  // Start: Ground (bottom-left). Exit: high up at top-right.
  // Horizontal danger zone: Train (y≈285). Cross it by anchoring to the Train.
  // Oscillating boxes bridge gaps in the mid section.
  // Pendulum swings from ceiling left-center — anchor to it for a tilting frame.
  // Elevator (center-right) is the only way to reach the elevated exit.
  // Ring orbits upper-right for optional alternate access.
  const initialObjects = () => [
    // ─ static terrain ─
    { id: "left",     type: "ground",   x: 20,   y: 340, w: 160, h: 28, label: "Ground",   dangerous: false, solid: true },
    { id: "right",    type: "ground",   x: 1110, y: 80,  w: 140, h: 28, label: "Exit",     dangerous: false, solid: true },
    { id: "shelf",    type: "ground",   x: 960,  y: 225, w: 100, h: 20, label: "Shelf",    dangerous: false, solid: true },
    // ─ oscillating horizontal platforms ─
    { id: "boxA",     type: "mover",    x: 285,  y: 210, baseX: 285, w: 100, h: 20, label: "Box A",
      range: 105, speed: 62, dangerous: false, solid: true },
    { id: "boxB",     type: "mover",    x: 555,  y: 252, baseX: 555, w: 100, h: 20, label: "Box B",
      range: 78, speed: 44, dangerous: false, solid: true },
    // ─ dangerous train ─
    { id: "train",    type: "train",    x: 240,  y: 285, w: 240, h: 28, label: "Train",
      minX: 240, maxX: 800, speed: 245, dangerous: true, solid: true },
    // ─ pendulum (swings from ceiling, creates tilting frame) ─
    { id: "pendulum", type: "pendulum",
      anchorX: 435, anchorY: 0, length: 155, thetaMax: 0.64, omega: 1.28,
      x: 435, y: 155, w: 78, h: 18, label: "Pendulum", dangerous: false, solid: true, angle: 0 },
    // ─ elevator (vertical translation frame, only path to exit) ─
    { id: "elevator", type: "elevator",
      x: 718, minY: 76, maxY: 308, w: 90, h: 22, y: 76, label: "Elevator",
      dangerous: false, solid: true, speed: 0.70 },
    // ─ ring (circular orbit, rotates the frame) ─
    { id: "ring",     type: "ring",
      x: 890, y: 150, cx: 958, cy: 178, radius: 76, angleSpeed: 1.1,
      w: 70, h: 70, label: "Ring", dangerous: false, solid: true, angle: 0 },
  ];

  const initialPlayer = () => ({
    x: 90, y: 340 - PLAYER_H,
    w: PLAYER_W, h: PLAYER_H,
    vx: 0, vy: 0,
    onGround: false, standingOn: "left", facing: 1,
  });

  // ── Physics update ────────────────────────────────────────────────────────
  const updateObjects = (baseObjects, time) => {
    const prevTime = time - FIXED_DT;
    return baseObjects.map((obj) => {
      if (obj.type === "mover") {
        const x = obj.baseX + Math.sin((time * obj.speed) / 100) * obj.range;
        const prevX = obj.baseX + Math.sin((prevTime * obj.speed) / 100) * obj.range;
        return { ...obj, x, vx: (x - prevX) / FIXED_DT, vy: 0 };
      }
      if (obj.type === "train") {
        const path = obj.maxX - obj.minX;
        const travel = (time * obj.speed) % (2 * path);
        const prevTravel = (((prevTime * obj.speed) % (2 * path)) + 2 * path) % (2 * path);
        const x = travel <= path ? obj.minX + travel : obj.maxX - (travel - path);
        const prevX = prevTravel <= path ? obj.minX + prevTravel : obj.maxX - (prevTravel - path);
        return { ...obj, x, vx: (x - prevX) / FIXED_DT, vy: 0 };
      }
      if (obj.type === "ring") {
        const angle = time * obj.angleSpeed;
        const prevAngle = prevTime * obj.angleSpeed;
        const x = obj.cx + Math.cos(angle) * obj.radius;
        const y = obj.cy + Math.sin(angle) * obj.radius;
        const prevX = obj.cx + Math.cos(prevAngle) * obj.radius;
        const prevY = obj.cy + Math.sin(prevAngle) * obj.radius;
        return { ...obj, x, y, vx: (x - prevX) / FIXED_DT, vy: (y - prevY) / FIXED_DT, angle };
      }
      if (obj.type === "pendulum") {
        const theta = obj.thetaMax * Math.sin(obj.omega * time);
        const prevTheta = obj.thetaMax * Math.sin(obj.omega * prevTime);
        // Top-left of bob: anchor + pendulum vector - half-width
        const x = obj.anchorX + Math.sin(theta) * obj.length - obj.w / 2;
        const y = obj.anchorY + Math.cos(theta) * obj.length;
        const prevX = obj.anchorX + Math.sin(prevTheta) * obj.length - obj.w / 2;
        const prevY = obj.anchorY + Math.cos(prevTheta) * obj.length;
        // angle = theta: when anchored to pendulum, the world tilts by -theta
        return { ...obj, x, y, vx: (x - prevX) / FIXED_DT, vy: (y - prevY) / FIXED_DT, angle: theta };
      }
      if (obj.type === "elevator") {
        const range = obj.maxY - obj.minY;
        const y = obj.minY + (range * (1 - Math.cos(obj.speed * time))) / 2;
        const prevY = obj.minY + (range * (1 - Math.cos(obj.speed * prevTime))) / 2;
        return { ...obj, y, vx: 0, vy: (y - prevY) / FIXED_DT };
      }
      return { ...obj, vx: 0, vy: 0 };
    });
  };

  // ── Game state factory ────────────────────────────────────────────────────
  const createGame = (text = "Anchor to a moving object to reinterpret the gap.") => ({
    time: 0,
    baseObjects: initialObjects(),
    player: initialPlayer(),
    anchorId: "player",
    message: text,
    won: false,
    attempts: 0,
  });

  const getAnchorFromWorld = (game, worldObjects) => {
    if (game.anchorId === "player") {
      return { id: "player", x: game.player.x, y: game.player.y,
               w: game.player.w, h: game.player.h, label: "Player", angle: 0, vx: 0, vy: 0 };
    }
    const found = worldObjects.find((o) => o.id === game.anchorId) ?? worldObjects[0];
    return { ...found, angle: found.angle ?? 0 };
  };

  // ── Refs ──────────────────────────────────────────────────────────────────
  const gameRef = useRef(createGame());
  const pressed = useRef(new Set());
  const rafRef = useRef(null);
  const accRef = useRef(0);
  const lastRef = useRef(null);
  const resetRef = useRef(null);
  const viewAnchorRef = useRef({ x: 90, y: 340 - PLAYER_H, angle: 0 });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  const [, setVersion] = useState(0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const renderNow = () => setVersion((v) => v + 1);

  const resetGame = (text = "Reset.") => {
    const prevAttempts = gameRef.current.attempts;
    const fresh = { ...createGame(text), attempts: prevAttempts + 1 };
    gameRef.current = fresh;
    viewAnchorRef.current = { x: fresh.player.x, y: fresh.player.y, angle: 0 };
    setPanOffset({ x: 0, y: 0 });
    renderNow();
  };
  resetRef.current = resetGame;

  const setAnchor = (id) => {
    if (gameRef.current.anchorId !== id) {
      gameRef.current.anchorId = id;
      gameRef.current.message = `Anchored to ${anchorLabel(id)}.`;
      setPanOffset({ x: 0, y: 0 });
      renderNow();
    }
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const keyMap = {
      "1": "left", "2": "train", "3": "boxA", "4": "boxB",
      "5": "player", "6": "pendulum", "7": "elevator", "8": "ring",
    };
    const down = (e) => {
      const key = e.key.toLowerCase();
      pressed.current.add(key);
      if ([...Object.keys(keyMap), "r"].includes(key)) e.preventDefault();
      if (keyMap[e.key]) setAnchor(keyMap[e.key]);
      if (key === "r") resetRef.current?.("Reset.");
    };
    const up = (e) => pressed.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = (ts) => {
      if (lastRef.current == null) lastRef.current = ts;
      const frame = Math.min(0.03, (ts - lastRef.current) / 1000);
      lastRef.current = ts;
      accRef.current += frame;

      let changed = false;

      while (accRef.current >= FIXED_DT) {
        const game = gameRef.current;
        if (!game.won) {
          game.time += FIXED_DT;
          const refreshedObjects = updateObjects(game.baseObjects, game.time);
          const anchor = getAnchorFromWorld(game, refreshedObjects);
          const relObjects = refreshedObjects
            .filter((o) => o.solid !== false)
            .map((o) => ({ x: o.x - anchor.x, y: o.y - anchor.y, w: o.w, h: o.h,
                           id: o.id, dangerous: o.dangerous, vx: o.vx, vy: o.vy }));

          const prev = game.player;
          const next = { ...prev };
          const keys = pressed.current;
          let move = 0;
          if (keys.has("arrowleft") || keys.has("a")) move -= 1;
          if (keys.has("arrowright") || keys.has("d")) move += 1;
          next.vx = move * MOVE_SPEED;
          if (move !== 0) next.facing = move;

          const jumpPressed = keys.has(" ") || keys.has("arrowup") || keys.has("w");
          const standingWorldObj = prev.onGround
            ? refreshedObjects.find((o) => o.id === prev.standingOn && o.solid !== false)
            : null;

          let carriedX = prev.x;
          let carriedY = prev.y;
          if (standingWorldObj && !jumpPressed) {
            carriedX += standingWorldObj.vx * FIXED_DT;
            carriedY += standingWorldObj.vy * FIXED_DT;
          }

          if (jumpPressed && prev.onGround) {
            next.vy = -JUMP_SPEED;
            next.onGround = false;
            next.standingOn = null;
          } else {
            next.vy = prev.vy + GRAVITY * FIXED_DT;
          }

          const relPlayer = {
            x: carriedX - anchor.x, y: carriedY - anchor.y,
            w: prev.w, h: prev.h, vx: next.vx, vy: next.vy,
            onGround: false, standingOn: null,
          };

          relPlayer.x += relPlayer.vx * FIXED_DT;
          for (const obj of relObjects) {
            if (rectsOverlap(relPlayer, obj)) {
              if (relPlayer.vx > 0) relPlayer.x = obj.x - relPlayer.w;
              if (relPlayer.vx < 0) relPlayer.x = obj.x + obj.w;
            }
          }

          relPlayer.y += relPlayer.vy * FIXED_DT;
          for (const obj of relObjects) {
            if (rectsOverlap(relPlayer, obj)) {
              const prevBottom = relPlayer.y + relPlayer.h - relPlayer.vy * FIXED_DT;
              const prevTop = relPlayer.y - relPlayer.vy * FIXED_DT;
              if (relPlayer.vy >= 0 && prevBottom <= obj.y + 2) {
                relPlayer.y = obj.y - relPlayer.h;
                relPlayer.vy = 0;
                relPlayer.onGround = true;
                relPlayer.standingOn = obj.id;
              } else if (relPlayer.vy < 0 && prevTop >= obj.y + obj.h - 2) {
                relPlayer.y = obj.y + obj.h;
                relPlayer.vy = 0;
              }
            }
          }

          const worldX = relPlayer.x + anchor.x;
          const worldY = relPlayer.y + anchor.y;
          game.player = {
            ...prev, x: worldX, y: worldY, vx: next.vx, vy: relPlayer.vy,
            onGround: relPlayer.onGround, standingOn: relPlayer.standingOn, facing: next.facing,
          };

          const standingObj = refreshedObjects.find((o) => o.id === relPlayer.standingOn);
          if (standingObj?.id === "right") {
            game.won = true;
            game.message = "You reached the exit by shifting the frame, not the world.";
          } else if (worldY > WORLD_H || worldX < -160 || worldX > WORLD_W + 160) {
            resetRef.current?.("You fell. Try a different frame.");
            accRef.current = 0; lastRef.current = ts;
            rafRef.current = requestAnimationFrame(tick);
            return;
          } else {
            const hazard = refreshedObjects.find(
              (o) => o.dangerous && rectsOverlap({ x: worldX, y: worldY, w: PLAYER_W, h: PLAYER_H }, o)
            );
            if (hazard && game.anchorId !== hazard.id) {
              resetRef.current?.("Still dangerous in that frame. Try anchoring to the Train.");
              accRef.current = 0; lastRef.current = ts;
              rafRef.current = requestAnimationFrame(tick);
              return;
            }
          }
          changed = true;
        }
        accRef.current -= FIXED_DT;
      }

      // Smooth camera lerp
      const latestWorld = updateObjects(gameRef.current.baseObjects, gameRef.current.time);
      const latestAnchor = getAnchorFromWorld(gameRef.current, latestWorld);
      const view = viewAnchorRef.current;
      const dx = latestAnchor.x - view.x;
      const dy = latestAnchor.y - view.y;
      const da = latestAnchor.angle - view.angle;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(da) > 0.001) {
        view.x += dx * VIEW_LERP;
        view.y += dy * VIEW_LERP;
        view.angle += da * VIEW_LERP;
        changed = true;
      } else {
        view.x = latestAnchor.x;
        view.y = latestAnchor.y;
        view.angle = latestAnchor.angle;
      }

      if (changed) renderNow();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Render state ──────────────────────────────────────────────────────────
  const game = gameRef.current;
  const worldObjects = updateObjects(game.baseObjects, game.time);
  const logicAnchor = getAnchorFromWorld(game, worldObjects);
  const viewAnchor = viewAnchorRef.current;
  const ax = viewAnchor.x;
  const ay = viewAnchor.y;
  const aAngle = viewAnchor.angle;

  const worldToView = (x, y, keepStill = false) => ({
    x: keepStill ? x - logicAnchor.x : x - ax,
    y: keepStill ? y - logicAnchor.y : y - ay,
  });

  const screenObjects = worldObjects.map((o) => {
    const anchored = o.id === game.anchorId;
    const pt = worldToView(o.x, o.y, anchored);
    return { ...o, vx2: pt.x, vy2: pt.y, anchored };
  });

  const playerStill = game.anchorId === "player" ||
    (game.player.onGround && game.player.standingOn === game.anchorId);
  const playerView = worldToView(game.player.x, game.player.y, playerStill);
  const screenPlayer = { ...game.player, vx2: playerView.x, vy2: playerView.y };

  const stageLeft = VIEWPORT_W / 2 + panOffset.x;
  const stageTop  = VIEWPORT_H / 2 + panOffset.y;

  // ── Styling helpers ───────────────────────────────────────────────────────
  const buttonClass = (id) =>
    `px-3 py-2 rounded-2xl border text-sm transition ${
      game.anchorId === id
        ? "bg-black text-white border-black"
        : "bg-white text-black border-gray-300 hover:border-black"
    }`;

  const objectColor = (obj) => {
    if (obj.type === "train")     return "bg-amber-500 border-amber-700";
    if (obj.type === "ground")    return "bg-neutral-800 border-neutral-900";
    if (obj.type === "ring")      return "bg-violet-500 border-violet-700";
    if (obj.type === "pendulum")  return "bg-orange-500 border-orange-700";
    if (obj.type === "elevator")  return "bg-teal-500 border-teal-700";
    return "bg-sky-500 border-sky-700"; // mover default
  };

  // ── Pointer drag ──────────────────────────────────────────────────────────
  const handlePointerDown = (e) => {
    if (e.target.closest("button")) return;
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startPanX: panOffset.x, startPanY: panOffset.y };
  };
  const handlePointerMove = (e) => {
    if (!dragRef.current.active) return;
    setPanOffset({ x: dragRef.current.startPanX + e.clientX - dragRef.current.startX,
                   y: dragRef.current.startPanY + e.clientY - dragRef.current.startY });
  };
  const handlePointerUp = () => { dragRef.current.active = false; };

  // ── Exit zone in view coords ──────────────────────────────────────────────
  const exitView = worldToView(1110, 80);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 p-5 md:p-7 font-sans">
      <div className="max-w-[1600px] mx-auto grid xl:grid-cols-[320px_1fr] gap-6">

        {/* ── Sidebar ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 p-5 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-2">Level 1 · Position</div>
            <h1 className="text-2xl font-semibold">Frame Shift</h1>
            <p className="text-sm text-neutral-600 mt-2 leading-6">
              Reach the elevated exit by choosing which object defines "still."
              The world stays fixed — only the frame of reference changes.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Controls</div>
            <div className="text-sm text-neutral-600 leading-6">
              Move: <span className="font-mono">A D</span> or <span className="font-mono">← →</span><br />
              Jump: <span className="font-mono">W</span>, <span className="font-mono">↑</span>, or <span className="font-mono">Space</span><br />
              Switch frame: click object in scene, or press <span className="font-mono">1 – 8</span><br />
              Pan view: drag background &nbsp;·&nbsp; Reset: <span className="font-mono">R</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Anchor Frame</div>
            <div className="grid grid-cols-2 gap-2">
              <button className={buttonClass("left")}      onClick={() => setAnchor("left")}>1 · Ground</button>
              <button className={buttonClass("train")}     onClick={() => setAnchor("train")}>2 · Train</button>
              <button className={buttonClass("boxA")}      onClick={() => setAnchor("boxA")}>3 · Box A</button>
              <button className={buttonClass("boxB")}      onClick={() => setAnchor("boxB")}>4 · Box B</button>
              <button className={buttonClass("player")}    onClick={() => setAnchor("player")}>5 · Player</button>
              <button className={buttonClass("pendulum")}  onClick={() => setAnchor("pendulum")}>6 · Pendulum</button>
              <button className={buttonClass("elevator")}  onClick={() => setAnchor("elevator")}>7 · Elevator</button>
              <button className={buttonClass("ring")}      onClick={() => setAnchor("ring")}>8 · Ring</button>
            </div>
          </div>

          <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-4 space-y-2">
            <div className="text-sm font-medium">Frame info</div>
            <div className="text-sm text-neutral-600 space-y-1">
              <div>Current: <span className="font-medium text-neutral-900">{logicAnchor?.label}</span></div>
              <div>Speed: <span className="font-medium text-neutral-900">
                {Math.round(Math.sqrt((logicAnchor?.vx ?? 0) ** 2 + (logicAnchor?.vy ?? 0) ** 2))} px/s
              </span></div>
              {Math.abs(logicAnchor?.angle ?? 0) > 0.01 && (
                <div>Tilt: <span className="font-medium text-neutral-900">
                  {(((logicAnchor?.angle ?? 0) * 180) / Math.PI).toFixed(1)}°
                </span></div>
              )}
            </div>
            <div className="text-sm text-neutral-600 pt-1">Attempts: <span className="font-medium text-neutral-900">{game.attempts}</span></div>
            <div className="text-sm text-neutral-600 italic">{game.message}</div>
          </div>

          <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-4 space-y-2 text-sm text-neutral-600 leading-6">
            <div className="font-medium text-neutral-900">Frame types</div>
            <div><span className="font-mono text-amber-600">Train</span> — translating, dangerous. Safe from inside its frame.</div>
            <div><span className="font-mono text-sky-600">Boxes</span> — oscillating platforms. Steady stepping stones when anchored.</div>
            <div><span className="font-mono text-orange-600">Pendulum</span> — swinging. The whole world <em>tilts</em> when anchored.</div>
            <div><span className="font-mono text-teal-600">Elevator</span> — vertical. The only route to the elevated exit.</div>
            <div><span className="font-mono text-violet-600">Ring</span> — circular orbit. The world spins around you.</div>
          </div>
        </div>

        {/* ── Viewport ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 p-4">
          <div
            className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-b from-sky-100 to-stone-100 select-none"
            style={{ height: VIEWPORT_H, cursor: dragRef.current.active ? "grabbing" : "grab" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Viewport decorations */}
            <div className="absolute inset-x-0 top-0 h-10 bg-neutral-200/50" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-stone-300/70" />
            <div className="absolute inset-x-0 bottom-24 h-px bg-neutral-300" />

            {/* Stage */}
            <div
              className="absolute"
              style={{ width: WORLD_W, height: WORLD_H, left: stageLeft, top: stageTop,
                       transform: `scale(${VIEW_SCALE})`, transformOrigin: "0 0" }}
            >
              {/* World rotation for frames with angular velocity (ring, pendulum) */}
              <div
                className="absolute inset-0"
                style={{
                  transform: Math.abs(aAngle) > 0.002 ? `rotate(${-aAngle}rad)` : "none",
                  transformOrigin: "0px 0px",
                }}
              >
                {screenObjects.map((obj) => {
                  const isAnchor = obj.id === game.anchorId;
                  const isClickable = !["right", "shelf"].includes(obj.id);

                  // ── Pendulum rope ──────────────────────────────────
                  const pendRope = obj.type === "pendulum" ? (() => {
                    const ropeFrom = worldToView(obj.anchorX, obj.anchorY, obj.id === game.anchorId);
                    const ropeTo = { x: obj.vx2 + obj.w / 2, y: obj.vy2 };
                    const dx = ropeTo.x - ropeFrom.x, dy = ropeTo.y - ropeFrom.y;
                    const ropeLen = Math.sqrt(dx * dx + dy * dy);
                    const ropeAngle = Math.atan2(dy, dx);
                    return (
                      <div key={`${obj.id}-rope`}
                        className="absolute pointer-events-none bg-stone-500"
                        style={{ left: ropeFrom.x, top: ropeFrom.y - 1,
                                 width: ropeLen, height: 2.5,
                                 transform: `rotate(${ropeAngle}rad)`, transformOrigin: "0 50%",
                                 borderRadius: 2 }}
                      />
                    );
                  })() : null;

                  // ── Elevator rails ─────────────────────────────────
                  const elevRails = obj.type === "elevator" ? (() => {
                    const isElevAnchor = obj.id === game.anchorId;
                    const railTopY = worldToView(obj.x, obj.minY, isElevAnchor).y;
                    const railBotY = worldToView(obj.x, obj.maxY, isElevAnchor).y;
                    const railH = Math.abs(railBotY - railTopY);
                    const railTopActual = Math.min(railTopY, railBotY);
                    return (
                      <React.Fragment key={`${obj.id}-rails`}>
                        <div className="absolute pointer-events-none bg-stone-400/50 rounded-full"
                          style={{ left: obj.vx2 + 6, top: railTopActual, width: 3, height: railH }} />
                        <div className="absolute pointer-events-none bg-stone-400/50 rounded-full"
                          style={{ left: obj.vx2 + obj.w - 9, top: railTopActual, width: 3, height: railH }} />
                      </React.Fragment>
                    );
                  })() : null;

                  // ── Ring orbit path ────────────────────────────────
                  const ringOrbit = obj.type === "ring" ? (() => {
                    const orbitCenter = worldToView(obj.cx, obj.cy, obj.id === game.anchorId);
                    return (
                      <div key={`${obj.id}-orbit`}
                        className="absolute pointer-events-none border border-violet-300/40 rounded-full"
                        style={{ left: orbitCenter.x - obj.radius, top: orbitCenter.y - obj.radius,
                                 width: obj.radius * 2, height: obj.radius * 2 }}
                      />
                    );
                  })() : null;

                  const isRound = obj.type === "ring";
                  const bobEl = isClickable ? (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => setAnchor(obj.id)}
                      className={`absolute border cursor-pointer focus:outline-none focus:ring-4 focus:ring-fuchsia-300
                        ${objectColor(obj)} ${isRound ? "rounded-full" : "rounded-md"}
                        ${isAnchor ? "ring-4 ring-fuchsia-300" : "hover:brightness-110"}`}
                      style={{ left: obj.vx2, top: obj.vy2, width: obj.w, height: obj.h,
                               boxShadow: obj.type === "ring" ? "inset -8px -8px 0 rgba(255,255,255,0.15)" : undefined }}
                    >
                      {obj.type === "ring" && <div className="absolute inset-[12px] rounded-full border-[5px] border-white/60" />}
                    </button>
                  ) : (
                    <div
                      key={obj.id}
                      className={`absolute rounded-md border ${objectColor(obj)}`}
                      style={{ left: obj.vx2, top: obj.vy2, width: obj.w, height: obj.h }}
                    />
                  );

                  const labelEl = isClickable ? (
                    <button
                      key={`${obj.id}-lbl`}
                      type="button"
                      onClick={() => setAnchor(obj.id)}
                      className="absolute text-xs px-2 py-0.5 rounded-full bg-white/90 border border-neutral-200 text-neutral-700 hover:bg-white cursor-pointer"
                      style={{ left: obj.vx2, top: obj.vy2 - 22 }}
                    >{obj.label}</button>
                  ) : (
                    <div
                      key={`${obj.id}-lbl`}
                      className="absolute text-xs px-2 py-0.5 rounded-full bg-white/90 border border-neutral-200 text-neutral-700"
                      style={{ left: obj.vx2, top: obj.vy2 - 22 }}
                    >{obj.label}</div>
                  );

                  return (
                    <React.Fragment key={obj.id}>
                      {ringOrbit}
                      {elevRails}
                      {pendRope}
                      {bobEl}
                      {labelEl}
                    </React.Fragment>
                  );
                })}

                {/* ── Player ── */}
                <button
                  type="button"
                  onClick={() => setAnchor("player")}
                  className={`absolute rounded-lg border border-rose-700 bg-rose-500 cursor-pointer
                    focus:outline-none focus:ring-4 focus:ring-fuchsia-300
                    ${game.anchorId === "player" ? "ring-4 ring-fuchsia-300" : "hover:brightness-110"}`}
                  style={{ left: screenPlayer.vx2, top: screenPlayer.vy2, width: PLAYER_W, height: PLAYER_H }}
                >
                  <div className="absolute left-1/2 -translate-x-1/2 -top-5 text-[11px] px-2 py-0.5 rounded-full bg-white border border-neutral-200 whitespace-nowrap">
                    Player
                  </div>
                </button>

                {/* ── Exit goal ring ── */}
                <div
                  className="absolute border-2 border-emerald-500 rounded-xl pointer-events-none"
                  style={{ left: exitView.x - 6, top: exitView.y - 6, width: 152, height: 40 }}
                />
              </div>
            </div>

            {/* ── Frame Gizmo ── */}
            <FrameGizmo
              angle={aAngle}
              vx={logicAnchor?.vx ?? 0}
              vy={logicAnchor?.vy ?? 0}
            />

            {/* ── HUD ── */}
            <div className="absolute top-3 right-3 px-3 py-2 rounded-2xl bg-white/90 border border-neutral-200 text-sm shadow-sm">
              Frame: <span className="font-medium">{logicAnchor?.label}</span>
            </div>
            {game.won && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="px-6 py-4 rounded-2xl bg-emerald-500/90 text-white text-lg font-semibold shadow-xl">
                  Level Complete
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
