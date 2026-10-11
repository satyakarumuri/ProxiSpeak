/**
 * WebRTCVoiceManager.js
 * ProxiSpeak - Geospatial Proximity Audio Ecosystem
 *
 * Manages local microphone capture, WebRTC PeerConnections (Mesh network),
 * track enable/disable (mute/unmute), and signaling handshake logic.
 */

const DEFAULT_RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRTCVoiceManager {
  /**
   * @param {Object} options
   * @param {Function} [options.onSignal] - Callback when signaling data needs to be sent: (targetPeerId, data) => void
   * @param {Function} [options.onPeerStream] - Callback when remote audio stream is received: (peerId, stream) => void
   * @param {Function} [options.onPeerLeave] - Callback when remote peer disconnects: (peerId) => void
   * @param {RTCConfiguration} [options.rtcConfig] - Custom STUN/TURN servers
   */
  constructor(options = {}) {
    this.onSignal = options.onSignal || (() => {});
    this.onPeerStream = options.onPeerStream || (() => {});
    this.onPeerLeave = options.onPeerLeave || (() => {});
    this.rtcConfig = options.rtcConfig || DEFAULT_RTC_CONFIG;

    this.localStream = null;
    this.isMuted = false;

    // peerId -> RTCPeerConnection
    this.peers = new Map();
  }

  /**
   * Requests microphone access and captures the local MediaStream
   * @returns {Promise<MediaStream>}
   */
  async startMicrophone() {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      return this.localStream;
    } catch (err) {
      console.error('[WebRTCVoiceManager] Failed to access microphone:', err);
      throw err;
    }
  }

  /**
   * Stops the microphone and releases hardware access
   */
  stopMicrophone() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  /**
   * Toggles microphone mute state
   * @returns {boolean} New mute state (true if muted)
   */
  toggleMute() {
    if (!this.localStream) return false;

    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });

    return this.isMuted;
  }

  /**
   * Sets mute state explicitly
   * @param {boolean} mute
   */
  setMuted(mute) {
    if (!this.localStream) return;
    this.isMuted = !!mute;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });
  }

  /**
   * Initiates a WebRTC connection with a remote peer (creates Offer)
   * @param {string} peerId
   */
  async callPeer(peerId) {
    const pc = this._createPeerConnection(peerId);

    // Create and send SDP Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.onSignal(peerId, {
      type: 'offer',
      sdp: pc.localDescription,
    });
  }

  /**
   * Handles incoming signaling messages (from Socket.IO or another transport)
   * @param {string} senderPeerId
   * @param {Object} data - Signaling message payload ({ type, sdp, candidate })
   */
  async handleSignal(senderPeerId, data) {
    let pc = this.peers.get(senderPeerId);

    if (data.type === 'offer') {
      if (!pc) {
        pc = this._createPeerConnection(senderPeerId);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.onSignal(senderPeerId, {
        type: 'answer',
        sdp: pc.localDescription,
      });
    } else if (data.type === 'answer') {
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
    } else if (data.type === 'candidate' && data.candidate) {
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('[WebRTCVoiceManager] Error adding ICE candidate:', e);
        }
      }
    }
  }

  /**
   * Internal helper to create and configure RTCPeerConnection for a peer
   * @private
   */
  _createPeerConnection(peerId) {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId);
    }

    const pc = new RTCPeerConnection(this.rtcConfig);

    // Add local audio tracks to the peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE Candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onSignal(peerId, {
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    // Remote audio track received
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.onPeerStream(peerId, remoteStream);
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        this.removePeer(peerId);
      }
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  /**
   * Cleans up connection for a specific peer
   * @param {string} peerId
   */
  removePeer(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
      this.onPeerLeave(peerId);
    }
  }

  /**
   * Closes all connections and stops audio
   */
  cleanup() {
    for (const peerId of this.peers.keys()) {
      this.removePeer(peerId);
    }
    this.stopMicrophone();
  }
}
