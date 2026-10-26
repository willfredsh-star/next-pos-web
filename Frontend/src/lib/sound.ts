/*
 * Small synthesized UI sounds (Web Audio, no audio files).
 * Built for a cashier tapping fast: every sound is a few tens of
 * milliseconds, quiet, low in harsh high frequencies, and rate-limited so a
 * burst of taps never stacks into noise. The payment "ching" is the one
 * deliberately brighter sound and always plays.
 */

const MUTE_KEY = "nextpos.sound.muted"

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = readMuted()
let lastTick = 0
let active = 0

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1"
  } catch {
    return false
  }
}

export function isMuted() {
  return muted
}

export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0")
  } catch {
    /* storage blocked: applies for this visit only */
  }
}

function audio() {
  if (muted || typeof window === "undefined") return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.9
    // gentle low-pass keeps repeated clicks from sounding sharp
    const soften = ctx.createBiquadFilter()
    soften.type = "lowpass"
    soften.frequency.value = 5200
    master.connect(soften)
    soften.connect(ctx.destination)
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

type Voice = { freq: number; end?: number; at?: number; length: number; peak: number; type?: OscillatorType }

function play(voices: Voice[]) {
  const c = audio()
  if (!c || !master) return
  const now = c.currentTime
  for (const voice of voices) {
    const start = now + (voice.at ?? 0)
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = voice.type ?? "sine"
    osc.frequency.setValueAtTime(voice.freq, start)
    if (voice.end) {
      osc.frequency.exponentialRampToValueAtTime(voice.end, start + voice.length)
    }
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(voice.peak, start + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + voice.length)
    osc.connect(gain)
    gain.connect(master)
    active++
    osc.onended = () => {
      active--
    }
    osc.start(start)
    osc.stop(start + voice.length + 0.02)
  }
}

/** Ignore taps that come faster than ~14 per second, and never stack voices. */
function allowed() {
  const now = performance.now()
  if (now - lastTick < 70 || active > 4) return false
  lastTick = now
  return true
}

// tiny pitch variation so rapid taps feel alive instead of machine-gun identical
const wobble = () => 1 + (Math.random() - 0.5) * 0.06

export type UiSound = "tap" | "add" | "remove" | "open" | "success" | "error"

export function playSound(kind: UiSound) {
  if (muted || !allowed()) return
  const w = wobble()
  switch (kind) {
    case "tap":
      play([{ freq: 520 * w, end: 380 * w, length: 0.05, peak: 0.05 }])
      break
    case "add":
      play([
        { freq: 620 * w, end: 760 * w, length: 0.07, peak: 0.06 },
        { freq: 930 * w, at: 0.03, length: 0.06, peak: 0.025 },
      ])
      break
    case "remove":
      play([{ freq: 420 * w, end: 280 * w, length: 0.07, peak: 0.05 }])
      break
    case "open":
      play([{ freq: 380 * w, end: 560 * w, length: 0.09, peak: 0.04 }])
      break
    case "success":
      play([
        { freq: 523, length: 0.12, peak: 0.05 },
        { freq: 659, at: 0.08, length: 0.14, peak: 0.05 },
      ])
      break
    case "error":
      play([{ freq: 200, end: 150, length: 0.14, peak: 0.05, type: "triangle" }])
      break
  }
}

/** Cash-register style bell: bright strike plus two inharmonic partials that ring out. */
export function playChing() {
  if (muted) return
  lastTick = performance.now()
  play([
    { freq: 1568, length: 0.9, peak: 0.12 }, // G6 strike
    { freq: 2349, length: 0.7, peak: 0.07 }, // D7 shimmer
    { freq: 3136, length: 0.45, peak: 0.035 },
    { freq: 1175, at: 0.0, length: 0.12, peak: 0.07, type: "triangle" }, // soft body
    { freq: 2093, at: 0.11, length: 0.8, peak: 0.08 }, // second bell hit, a little higher
  ])
}

/** Pick a sound for a pressed button from its markup. Opt out with data-sound="none". */
export function soundForTarget(target: Element | null): UiSound | "none" | null {
  const button = target?.closest("button, [role='button'], .category, a")
  if (!button || (button as HTMLButtonElement).disabled) return null
  const explicit = button.getAttribute("data-sound")
  if (explicit) return explicit as UiSound | "none"
  if (button.closest(".product-image")) return "add"
  if (button.closest(".logout-button") || button.classList.contains("logout-button")) return "open"
  if (button.classList.contains("delete-button")) return "remove"
  return "tap"
}
