/**
 * WebRTCVoiceManager.js
 * ProxiSpeak - Geospatial Proximity Audio Ecosystem
 */

const DEFAULT_RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRTCVoiceManager {
  constructor(options = {}) {
    this.onSignal = options.onSignal || (() => {});
    this.onPeerStream = options.onPeerStream || (() => {});
    this.onPeerLeave = options.onPeerLeave || (() => {});
    this.rtcConfig = options.rtcConfig || DEFAULT_RTC_CONFIG;

    this.localStream = null;
    this.isMuted = false;
    this.peers = new Map();
  }

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

  stopMicrophone() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  toggleMute() {
    if (!this.localStream) return false;

    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });

    return this.isMuted;
  }

  setMuted(mute) {
    if (!this.localStream) return;
    this.isMuted = !!mute;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });
  }

  async callPeer(peerId) {
    const pc = this._createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.onSignal(peerId, {
      type: 'offer',
      sdp: pc.localDescription,
    });
  }

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

  _createPeerConnection(peerId) {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId);
    }

    const pc = new RTCPeerConnection(this.rtcConfig);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onSignal(peerId, {
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.onPeerStream(peerId, remoteStream);
      }
    };

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

  removePeer(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
      this.onPeerLeave(peerId);
    }
  }

  cleanup() {
    for (const peerId of this.peers.keys()) {
      this.removePeer(peerId);
    }
    this.stopMicrophone();
  }
}
