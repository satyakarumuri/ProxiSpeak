/**
 * index.js
 * ProxiSpeak Audio Module Entrypoint
 *
 * Combines WebRTCVoiceManager and SpatialAudioEngine into a unified,
 * plug-and-play API for React and Socket.IO integrations.
 */

import { SpatialAudioEngine } from './SpatialAudioEngine.js';
import { WebRTCVoiceManager } from './WebRTCVoiceManager.js';

export { SpatialAudioEngine, WebRTCVoiceManager };

export class ProxiSpeakAudio {
  /**
   * @param {Object} options
   * @param {Function} options.onSignal - (targetPeerId, signalData) => void (forward to Socket.IO)
   * @param {number} [options.minDistance=50]
   * @param {number} [options.maxDistance=350]
   */
  constructor(options = {}) {
    this.spatial = new SpatialAudioEngine({
      minDistance: options.minDistance || 50,
      maxDistance: options.maxDistance || 350,
    });

    this.webrtc = new WebRTCVoiceManager({
      onSignal: options.onSignal,
      onPeerStream: (peerId, stream) => {
        this.spatial.addPeerStream(peerId, stream);
        if (options.onPeerConnected) options.onPeerConnected(peerId);
      },
      onPeerLeave: (peerId) => {
        this.spatial.removePeer(peerId);
        if (options.onPeerDisconnected) options.onPeerDisconnected(peerId);
      },
    });

    this.myPosition = { x: 0, y: 0 };
  }

  /**
   * Starts local microphone and audio context
   */
  async init() {
    const stream = await this.webrtc.startMicrophone();
    this.spatial.setLocalStream(stream);
    return stream;
  }

  /**
   * Toggles microphone mute
   * @returns {boolean} true if now muted
   */
  toggleMute() {
    return this.webrtc.toggleMute();
  }

  get isMuted() {
    return this.webrtc.isMuted;
  }

  /**
   * Sets current user position and updates spatial audio for all peers
   * @param {{ x: number, y: number }} myPos
   * @param {Map<string, { x: number, y: number }> | Object.<string, { x: number, y: number }>} peersMap
   */
  updatePositions(myPos, peersMap) {
    this.myPosition = myPos;
    const results = {};

    const entries = peersMap instanceof Map ? peersMap.entries() : Object.entries(peersMap);

    for (const [peerId, peerPos] of entries) {
      const stats = this.spatial.updatePeerProximity(peerId, this.myPosition, peerPos);
      if (stats) {
        results[peerId] = stats;
      }
    }

    return results;
  }

  /**
   * Call a peer to establish WebRTC voice connection
   * @param {string} peerId
   */
  connectToPeer(peerId) {
    return this.webrtc.callPeer(peerId);
  }

  /**
   * Handle incoming WebRTC signal data from Socket.IO
   * @param {string} senderPeerId
   * @param {Object} signalData
   */
  handleSignal(senderPeerId, signalData) {
    return this.webrtc.handleSignal(senderPeerId, signalData);
  }

  /**
   * Returns speaking activity (0.0 to 1.0) for visual avatar glow
   * @param {string} [peerId='local']
   */
  getSpeakingLevel(peerId = 'local') {
    return this.spatial.getSpeakingLevel(peerId);
  }

  /**
   * Clean up all audio and WebRTC resources
   */
  destroy() {
    this.spatial.cleanup();
    this.webrtc.cleanup();
  }
}
