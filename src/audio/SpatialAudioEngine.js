/**
 * SpatialAudioEngine.js
 * ProxiSpeak - Geospatial Proximity Audio Ecosystem
 *
 * Handles Web Audio API audio graphs, distance-based volume attenuation,
 * stereo panning (left/right ears), and speaking activity detection.
 */

export class SpatialAudioEngine {
  /**
   * @param {Object} options
   * @param {number} [options.minDistance=50] - Within this distance, volume is 100%
   * @param {number} [options.maxDistance=350] - Beyond this distance, volume is 0%
   * @param {number} [options.rolloffFactor=1] - Rate of volume decay
   * @param {number} [options.panSpan=300] - Horizontal distance for full left (-1) or right (+1) pan
   */
  constructor(options = {}) {
    this.minDistance = options.minDistance || 50;
    this.maxDistance = options.maxDistance || 350;
    this.rolloffFactor = options.rolloffFactor || 1;
    this.panSpan = options.panSpan || 300;

    // Web Audio Context (lazy initialized on user interaction)
    this.audioCtx = null;

    // Map of peerId -> PeerAudioNode
    // { sourceNode, pannerNode, gainNode, analyserNode, stream }
    this.peerNodes = new Map();

    // Local user speaking analyser
    this.localAnalyser = null;
    this.localSource = null;
  }

  /**
   * Initializes or resumes the AudioContext (required by browser autoplay policies)
   */
  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      return this.audioCtx.resume();
    }
    return Promise.resolve();
  }

  /**
   * Attaches a remote peer's MediaStream to the Spatial Audio Graph
   * @param {string} peerId
   * @param {MediaStream} stream
   */
  addPeerStream(peerId, stream) {
    this.ensureAudioContext();

    // Remove existing nodes if re-adding
    if (this.peerNodes.has(peerId)) {
      this.removePeer(peerId);
    }

    try {
      const sourceNode = this.audioCtx.createMediaStreamSource(stream);

      // Stereo Panner (Left/Right Audio)
      const pannerNode = this.audioCtx.createStereoPanner
        ? this.audioCtx.createStereoPanner()
        : null;

      // Gain Node (Volume attenuation based on distance)
      const gainNode = this.audioCtx.createGain();
      gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime); // start silent until position given

      // Analyser Node (For detecting speaking activity / sound level)
      const analyserNode = this.audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.5;

      // Connect Graph:
      // Source -> Analyser -> [Panner] -> Gain -> Destination (Speakers)
      sourceNode.connect(analyserNode);

      if (pannerNode) {
        analyserNode.connect(pannerNode);
        pannerNode.connect(gainNode);
      } else {
        analyserNode.connect(gainNode);
      }

      gainNode.connect(this.audioCtx.destination);

      this.peerNodes.set(peerId, {
        sourceNode,
        pannerNode,
        gainNode,
        analyserNode,
        stream,
        currentGain: 0,
        currentPan: 0,
        distance: 0,
      });

      return true;
    } catch (err) {
      console.error(`[SpatialAudioEngine] Error adding peer stream for ${peerId}:`, err);
      return false;
    }
  }

  /**
   * Updates proximity audio for a peer based on listener & peer 2D coordinates
   * @param {string} peerId
   * @param {{ x: number, y: number }} listenerPos - Current user position
   * @param {{ x: number, y: number }} peerPos - Remote peer position
   */
  updatePeerProximity(peerId, listenerPos, peerPos) {
    const peer = this.peerNodes.get(peerId);
    if (!peer || !this.audioCtx) return null;

    const dx = peerPos.x - listenerPos.x;
    const dy = peerPos.y - listenerPos.y;
    const distance = Math.hypot(dx, dy); // sqrt(dx^2 + dy^2)

    // Calculate Gain (Volume)
    let gainValue = 0;
    if (distance <= this.minDistance) {
      gainValue = 1;
    } else if (distance >= this.maxDistance) {
      gainValue = 0;
    } else {
      // Linear falloff between minDistance and maxDistance
      const fraction = (distance - this.minDistance) / (this.maxDistance - this.minDistance);
      gainValue = Math.max(0, Math.min(1, 1 - fraction));
    }

    // Calculate Stereo Pan (-1 = full left, 0 = center, +1 = full right)
    let panValue = 0;
    if (peer.pannerNode) {
      // Pan is relative to horizontal offset dx
      panValue = dx / this.panSpan;
      panValue = Math.max(-1, Math.min(1, panValue));
    }

    // Smooth transition to prevent audio popping/clicking
    const now = this.audioCtx.currentTime;
    peer.gainNode.gain.cancelScheduledValues(now);
    peer.gainNode.gain.linearRampToValueAtTime(gainValue, now + 0.05);

    if (peer.pannerNode) {
      peer.pannerNode.pan.cancelScheduledValues(now);
      peer.pannerNode.pan.linearRampToValueAtTime(panValue, now + 0.05);
    }

    peer.distance = distance;
    peer.currentGain = gainValue;
    peer.currentPan = panValue;

    return {
      distance: Math.round(distance),
      gain: Math.round(gainValue * 100) / 100,
      pan: Math.round(panValue * 100) / 100,
      inRange: gainValue > 0,
    };
  }

  /**
   * Sets up speaking detection for the local user microphone stream
   * @param {MediaStream} localStream
   */
  setLocalStream(localStream) {
    this.ensureAudioContext();
    try {
      if (this.localSource) {
        this.localSource.disconnect();
      }
      this.localSource = this.audioCtx.createMediaStreamSource(localStream);
      this.localAnalyser = this.audioCtx.createAnalyser();
      this.localAnalyser.fftSize = 256;
      this.localAnalyser.smoothingTimeConstant = 0.5;

      // Note: Do NOT connect local stream to destination to avoid self-echo!
      this.localSource.connect(this.localAnalyser);
    } catch (err) {
      console.error('[SpatialAudioEngine] Error attaching local stream:', err);
    }
  }

  /**
   * Returns current audio volume level (0 to 1) for a peer or 'local' user
   * Useful for speaking indicators (glowing ring around avatar)
   * @param {string} [peerId='local']
   * @returns {number} volume level between 0 and 1
   */
  getSpeakingLevel(peerId = 'local') {
    let analyser = null;
    if (peerId === 'local') {
      analyser = this.localAnalyser;
    } else {
      const peer = this.peerNodes.get(peerId);
      analyser = peer ? peer.analyserNode : null;
    }

    if (!analyser) return 0;

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buffer);

    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i];
    }
    const average = sum / buffer.length;
    // Normalize to 0 - 1
    return Math.min(1, average / 128);
  }

  /**
   * Removes peer audio nodes and cleans up connections
   * @param {string} peerId
   */
  removePeer(peerId) {
    const peer = this.peerNodes.get(peerId);
    if (!peer) return;

    try {
      peer.sourceNode.disconnect();
      if (peer.pannerNode) peer.pannerNode.disconnect();
      peer.gainNode.disconnect();
      peer.analyserNode.disconnect();
    } catch (e) {
      // ignore cleanup errors
    }

    this.peerNodes.delete(peerId);
  }

  /**
   * Destroys all nodes and closes the audio context
   */
  cleanup() {
    for (const peerId of this.peerNodes.keys()) {
      this.removePeer(peerId);
    }
    if (this.localSource) {
      try {
        this.localSource.disconnect();
      } catch (e) {}
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
