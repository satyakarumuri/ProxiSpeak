/**
 * demo/app.js
 * Interactive Spatial Audio Playground for ProxiSpeak
 */

import { SpatialAudioEngine } from '../src/audio/SpatialAudioEngine.js';

// Setup Spatial Engine
const spatialEngine = new SpatialAudioEngine({
  minDistance: 60,
  maxDistance: 320,
  panSpan: 280,
});

// Canvas Setup
const canvas = document.getElementById('officeCanvas');
const ctx = canvas.getContext('2d');

// Avatars
const avatars = {
  listener: {
    id: 'local',
    label: 'You (Sarthak)',
    x: 400,
    y: 260,
    radius: 22,
    color: '#38bdf8', // Sky blue
    glowColor: '#38bdf8',
    isSpeaking: false,
  },
  speaker: {
    id: 'peer_1',
    label: 'Teammate A (Speaker)',
    x: 230,
    y: 190,
    radius: 22,
    color: '#22c55e', // Green
    glowColor: '#22c55e',
    isSpeaking: false,
  },
};

// Simulation Audio State
let simAudioCtx = null;
let simOscillator = null;
let isAudioSimPlaying = false;
let micStream = null;
let isMicActive = false;

// Dragging State
let draggedAvatar = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// UI Elements
const btnAudioToggle = document.getElementById('btnAudioToggle');
const audioToggleText = document.getElementById('audioToggleText');
const btnMicTest = document.getElementById('btnMicTest');
const micStatus = document.getElementById('micStatus');
const statListenerPos = document.getElementById('statListenerPos');
const statDistance = document.getElementById('statDistance');
const statGainPct = document.getElementById('statGainPct');
const statGainBar = document.getElementById('statGainBar');
const statPanVal = document.getElementById('statPanVal');
const statPanIndicator = document.getElementById('statPanIndicator');
const statMicLevel = document.getElementById('statMicLevel');
const statMicBar = document.getElementById('statMicBar');
const sliderMinDist = document.getElementById('sliderMinDist');
const sliderMaxDist = document.getElementById('sliderMaxDist');
const valMinDist = document.getElementById('valMinDist');
const valMaxDist = document.getElementById('valMaxDist');

/**
 * Creates a synthesized musical loop as a MediaStream for testing
 */
function createSynthesizedMediaStream() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  simAudioCtx = new AudioContextClass();

  const dest = simAudioCtx.createMediaStreamDestination();

  // Create melodic ping-pong tone generator
  const chords = [261.63, 329.63, 392.0, 523.25]; // C, E, G, C
  let chordIndex = 0;

  function scheduleBeats() {
    if (!isAudioSimPlaying) return;

    const osc = simAudioCtx.createOscillator();
    const gain = simAudioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(chords[chordIndex % chords.length], simAudioCtx.currentTime);
    chordIndex++;

    gain.gain.setValueAtTime(0.3, simAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, simAudioCtx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(dest);

    osc.start();
    osc.stop(simAudioCtx.currentTime + 0.36);

    setTimeout(scheduleBeats, 400);
  }

  scheduleBeats();
  return dest.stream;
}

/**
 * Toggle Test Audio Simulation
 */
btnAudioToggle.addEventListener('click', async () => {
  await spatialEngine.ensureAudioContext();

  if (!isAudioSimPlaying) {
    isAudioSimPlaying = true;
    const testStream = createSynthesizedMediaStream();
    spatialEngine.addPeerStream(avatars.speaker.id, testStream);

    btnAudioToggle.classList.add('active');
    btnAudioToggle.querySelector('.btn-icon').textContent = '⏹';
    audioToggleText.textContent = 'Stop Audio Simulation';
  } else {
    isAudioSimPlaying = false;
    spatialEngine.removePeer(avatars.speaker.id);
    if (simAudioCtx) {
      simAudioCtx.close();
      simAudioCtx = null;
    }
    btnAudioToggle.classList.remove('active');
    btnAudioToggle.querySelector('.btn-icon').textContent = '▶';
    audioToggleText.textContent = 'Start Audio Simulation';
  }
});

/**
 * Toggle Microphone Test
 */
btnMicTest.addEventListener('click', async () => {
  if (!isMicActive) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      spatialEngine.setLocalStream(micStream);
      isMicActive = true;
      btnMicTest.classList.add('active');
      btnMicTest.innerHTML = '<span class="btn-icon">⏹</span> Stop Microphone';
      micStatus.textContent = 'Active (Listening)';
      micStatus.classList.add('live');
    } catch (err) {
      alert('Microphone access denied or not available: ' + err.message);
    }
  } else {
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      micStream = null;
    }
    isMicActive = false;
    btnMicTest.classList.remove('active');
    btnMicTest.innerHTML = '<span class="btn-icon">🎙</span> Test Microphone';
    micStatus.textContent = 'Inactive';
    micStatus.classList.remove('live');
  }
});

/**
 * Slider Listeners
 */
sliderMinDist.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  spatialEngine.minDistance = val;
  valMinDist.textContent = `${val} px`;
});

sliderMaxDist.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  spatialEngine.maxDistance = val;
  valMaxDist.textContent = `${val} px`;
});

/**
 * Mouse Drag-and-Drop Interaction
 */
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  for (const key of ['listener', 'speaker']) {
    const a = avatars[key];
    const dist = Math.hypot(mouseX - a.x, mouseY - a.y);
    if (dist <= a.radius + 8) {
      draggedAvatar = a;
      dragOffsetX = mouseX - a.x;
      dragOffsetY = mouseY - a.y;
      break;
    }
  }
});

window.addEventListener('mousemove', (e) => {
  if (!draggedAvatar) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  draggedAvatar.x = Math.max(30, Math.min(canvas.width - 30, mouseX - dragOffsetX));
  draggedAvatar.y = Math.max(30, Math.min(canvas.height - 30, mouseY - dragOffsetY));
});

window.addEventListener('mouseup', () => {
  draggedAvatar = null;
});

/**
 * Keyboard Movement Controls (WASD & Arrow Keys)
 */
const keysPressed = {};
window.addEventListener('keydown', (e) => {
  keysPressed[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
  keysPressed[e.key.toLowerCase()] = false;
});

function handleKeyboardMovement() {
  const speed = 4;
  const me = avatars.listener;

  if (keysPressed['arrowup'] || keysPressed['w']) me.y = Math.max(30, me.y - speed);
  if (keysPressed['arrowdown'] || keysPressed['s']) me.y = Math.min(canvas.height - 30, me.y + speed);
  if (keysPressed['arrowleft'] || keysPressed['a']) me.x = Math.max(30, me.x - speed);
  if (keysPressed['arrowright'] || keysPressed['d']) me.x = Math.min(canvas.width - 30, me.x + speed);
}

/**
 * Drawing Helpers
 */
function drawOfficeBackground() {
  // Clear
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw simulated meeting zones / desks
  ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
  ctx.lineWidth = 1.5;

  // Meeting Room A
  ctx.beginPath();
  ctx.roundRect(40, 40, 240, 160, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#64748b';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText('Meeting Zone Alpha', 55, 65);

  // Lounge Room B
  ctx.beginPath();
  ctx.roundRect(520, 320, 240, 160, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#64748b';
  ctx.fillText('Coffee Lounge', 535, 345);
}

function drawProximityCircles(listener) {
  // Max Distance boundary (cutoff)
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([6, 6]);
  ctx.arc(listener.x, listener.y, spatialEngine.maxDistance, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Min Distance boundary (100% volume)
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.arc(listener.x, listener.y, spatialEngine.minDistance, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawConnectionLine(a, b, stats) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);

  if (stats && stats.inRange) {
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.2 + stats.gain * 0.6})`;
    ctx.lineWidth = 2;
  } else {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
  }
  ctx.stroke();

  // Distance tag at midpoint
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dist = Math.round(Math.hypot(b.x - a.x, b.y - a.y));

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(midX - 30, midY - 12, 60, 22, 6);
  ctx.fill();

  ctx.fillStyle = stats && stats.inRange ? '#38bdf8' : '#94a3b8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${dist}px`, midX, midY);
  ctx.restore();
}

function drawAvatar(avatar, isSpeaking) {
  ctx.save();

  // Speaking indicator ring (glowing pulsing border)
  if (isSpeaking) {
    ctx.beginPath();
    ctx.arc(avatar.x, avatar.y, avatar.radius + 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 12;
    ctx.stroke();
  }

  // Base circle
  ctx.beginPath();
  ctx.arc(avatar.x, avatar.y, avatar.radius, 0, Math.PI * 2);
  ctx.fillStyle = avatar.color;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 8;
  ctx.fill();

  // Border
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Center initials / icon
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(avatar.id === 'local' ? 'ME' : 'SPK', avatar.x, avatar.y);

  // Label tag below
  ctx.font = '12px Inter, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(avatar.label, avatar.x, avatar.y + avatar.radius + 16);

  ctx.restore();
}

/**
 * Main Animation & Audio Update Loop
 */
function updateLoop() {
  handleKeyboardMovement();

  // Update Spatial Proximity Audio
  const stats = spatialEngine.updatePeerProximity(
    avatars.speaker.id,
    { x: avatars.listener.x, y: avatars.listener.y },
    { x: avatars.speaker.x, y: avatars.speaker.y }
  );

  // Calculate speaking levels
  const localMicLevel = spatialEngine.getSpeakingLevel('local');
  const speakerAudioLevel = spatialEngine.getSpeakingLevel(avatars.speaker.id);

  // Render Canvas
  drawOfficeBackground();
  drawProximityCircles(avatars.listener);
  drawConnectionLine(avatars.listener, avatars.speaker, stats);
  drawAvatar(avatars.listener, localMicLevel > 0.08);
  drawAvatar(avatars.speaker, isAudioSimPlaying && stats && stats.inRange);

  // Update HUD Stats
  statListenerPos.textContent = `x: ${Math.round(avatars.listener.x)}, y: ${Math.round(avatars.listener.y)}`;

  if (stats) {
    statDistance.textContent = `${stats.distance} px`;
    const pct = Math.round(stats.gain * 100);
    statGainPct.textContent = `${pct}%`;
    statGainBar.style.width = `${pct}%`;

    const panVal = stats.pan;
    statPanVal.textContent =
      panVal === 0
        ? '0.00 (Center)'
        : panVal < 0
        ? `${panVal} (Left)`
        : `+${panVal} (Right)`;

    // Map -1..+1 to 0%..100%
    const panPct = ((panVal + 1) / 2) * 100;
    statPanIndicator.style.left = `${panPct}%`;
  }

  // Update Mic HUD
  const micPct = Math.round(localMicLevel * 100);
  statMicLevel.textContent = `${micPct}%`;
  statMicBar.style.width = `${micPct}%`;

  requestAnimationFrame(updateLoop);
}

// Start loop
requestAnimationFrame(updateLoop);
