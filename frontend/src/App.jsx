import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Activity, Bell, CalendarDays, Camera, Check, ChevronDown, CircleHelp,
  Headphones, Home, MessageSquare, Mic, MicOff, MonitorUp, MoreHorizontal,
  Search, Send, Settings, ShieldCheck, Users, Video, VideoOff, X, PhoneOff,
  MapPin, LayoutGrid, PanelRightClose, PanelRightOpen, Volume2, VolumeX
} from 'lucide-react';

const initialMessages = [];
const people = [];
const avatarInitials = { violet: 'S', pink: 'S', green: 'R', yellow: 'P', blue: 'A' };

function Avatar({ tone='blue', name='', small=false, photo=null }) {
  return <span className={`avatar avatar-${tone} ${small ? 'avatar-small' : ''}`} aria-label={name}>{photo ? <img src={photo} alt={`${name} profile`} /> : (avatarInitials[tone] || (name || '?').slice(0,1).toUpperCase())}</span>;
}

function toneForName(name='') { const palette=['violet','pink','green','yellow','blue']; let n=0; for (const c of name) n += c.charCodeAt(0); return palette[n % palette.length]; }

function App() {
  const [activeNav, setActiveNav] = useState('Office');
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [chatMode, setChatMode] = useState('Office Chat');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [remoteMedia, setRemoteMedia] = useState({});
  const mediaPeersRef = useRef(new Map());
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const profileInputRef = useRef(null);
  const [authReady, setAuthReady] = useState(() => Boolean(localStorage.getItem('proxispeak-token') || localStorage.getItem('proxispeak-guest') === 'true'));
  const [authMode, setAuthMode] = useState('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [account, setAccount] = useState(() => { try { return JSON.parse(localStorage.getItem('proxispeak-user') || 'null'); } catch { return null; } });
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [proximityVoiceOn, setProximityVoiceOn] = useState(false);
  const [proximityStatus, setProximityStatus] = useState('Microphone off');
  const [proximityRefresh, setProximityRefresh] = useState(0);
  const [proximityPeerStates, setProximityPeerStates] = useState({});
  const [helpQuestion, setHelpQuestion] = useState('');
  const [helpAnswer, setHelpAnswer] = useState('');
  const [officeVolume, setOfficeVolume] = useState(1);
  const proximityStreamRef = useRef(null);
  const socketRef = useRef(null);
  const proximityPeersRef = useRef(new Map());
  const proximityAudioRef = useRef(new Map());
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [peopleCollapsed, setPeopleCollapsed] = useState(false);
  const [voiceCollapsed, setVoiceCollapsed] = useState(false);
  const [toast, setToast] = useState('');
  const [position, setPosition] = useState({ x: 50, y: 55 });
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [directDraft, setDirectDraft] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [draggingSelf, setDraggingSelf] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('');
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connection, setConnection] = useState('Connecting');
  const [livePeople, setLivePeople] = useState([]);
  const [systemNotices, setSystemNotices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unreadNotifications = notifications.filter(item => !item.read).length;
  const [status, setStatus] = useState('Online');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('proxispeak-name') || '');

  const peopleSource = livePeople.map(p => ({ ...p, name: p.name === displayName ? p.name + ' (You)' : p.name, tone: toneForName(p.name), place: p.location || 'Office', status: p.status }));
  const filteredPeople = useMemo(() => peopleSource.filter(p =>
    p.name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
    (p.place || '').toLowerCase().includes(peopleSearch.toLowerCase())
  ), [peopleSearch, livePeople, displayName]);

  useEffect(() => {
    if (!authReady) return;
    const savedName = localStorage.getItem('proxispeak-name') || 'Guest';
    const savedToken = localStorage.getItem('proxispeak-token') || '';
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    let profileId=localStorage.getItem('proxispeak-profile-id'); if(!profileId){profileId=crypto.randomUUID();localStorage.setItem('proxispeak-profile-id',profileId);}
    const client = io(apiUrl, { auth: { name: savedName, token: savedToken, profileId }, reconnection: true, reconnectionAttempts: 10 });
    socketRef.current = client;
    setSocket(client);
    client.on('connect', () => { setConnection('Connected'); setProximityRefresh(v => v + 1); if (proximityStreamRef.current) client.emit('proximity:ready'); });
    client.on('disconnect', () => { setConnection('Reconnecting'); setProximityPeerStates({}); setRemoteMedia(prev=>Object.fromEntries(Object.entries(prev).map(([id,m])=>[id,{...m,status:'reconnecting'}]))); });
    client.on('connect_error', () => setConnection('Offline'));
    client.io.on('reconnect', () => { setConnection('Connected'); setProximityRefresh(v => v + 1); });
    client.on('chat:history', history => setMessages(history.map(m => ({ name:m.name, time:new Date(m.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), text:m.text, tone: toneForName(m.name), self:m.name === savedName, id:m.id }))));
    client.on('chat:message', m => {
      setMessages(prev => {
        if (prev.some(x => x.id && x.id === m.id)) return prev;
        return [...prev, { id:m.id, name:m.name, time:new Date(m.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), text:m.text, tone:toneForName(m.name), self:m.name === savedName }].slice(-100);
      });
      // Notify only for messages written by another office member.
      if (m.name && m.name !== savedName) {
        const notification = {
          id: m.id || `office-${m.at || Date.now()}-${m.name}`,
          kind: 'Office chat',
          fromName: m.name,
          text: m.text || 'Sent a message',
          at: m.at || new Date().toISOString(),
          read: false
        };
        setNotifications(prev => {
          if (prev.some(item => item.id === notification.id && item.kind === notification.kind)) return prev;
          return [notification, ...prev].slice(0, 50);
        });
      }
    });
    client.on('people:update', people => { setLivePeople(people); const mine=people.find(p=>p.socketId===client.id); if(mine?.profilePhoto) setProfilePhoto(mine.profilePhoto); });
    client.on('profile:photo:saved', data=>{setProfilePhoto(data.photo||null);notify('Profile photo saved for your teammates.');});
    client.on('profile:error', data=>notify(data.message||'Profile photo upload failed.'));
    client.on('media:signal', async data=>{ try { if(data.type==='status') return; let pc=mediaPeersRef.current.get(data.fromSocketId); if(data.type==='ice'){if(pc&&data.candidate)await pc.addIceCandidate(new RTCIceCandidate(data.candidate));return;} if(data.type==='offer'){if(!pc||pc.signalingState==='closed'){pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});mediaPeersRef.current.set(data.fromSocketId,pc);pc.onicecandidate=e=>{if(e.candidate)client.emit('media:signal',{targetSocketId:data.fromSocketId,type:'ice',candidate:e.candidate});};pc.ontrack=e=>{const stream=e.streams?.[0]||new MediaStream([e.track]);const kind=(data.videoKinds||[]).find(x=>x.id===e.track.id)?.kind||'camera';setRemoteMedia(prev=>({...prev,[data.fromSocketId]:{...(prev[data.fromSocketId]||{}),[kind]:stream,status:'connected'}}));};pc.onconnectionstatechange=()=>setRemoteMedia(prev=>({...prev,[data.fromSocketId]:{...(prev[data.fromSocketId]||{}),status:pc.connectionState}}));} await pc.setRemoteDescription(new RTCSessionDescription(data.description));const answer=await pc.createAnswer();await pc.setLocalDescription(answer);client.emit('media:signal',{targetSocketId:data.fromSocketId,type:'answer',description:pc.localDescription});}else if(data.type==='answer'&&pc?.signalingState==='have-local-offer'){await pc.setRemoteDescription(new RTCSessionDescription(data.description));}}catch(err){console.warn('Media signaling error',err);setRemoteMedia(prev=>({...prev,[data.fromSocketId]:{...(prev[data.fromSocketId]||{}),status:'reconnecting'}}));} });
    client.on('direct:message', m => {
      setDirectMessages(prev => {
        if (m.id && prev.some(item => item.id === m.id)) return prev;
        return [...prev, { ...m, time: new Date(m.at || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) }].slice(-100);
      });
      // The server delivers this event to the recipient; ignore any own message echo.
      if (m.fromSocketId && m.fromSocketId !== client.id) {
        const notification = {
          id: m.id || `direct-${m.at || Date.now()}-${m.fromSocketId}`,
          kind: 'Direct message',
          fromSocketId: m.fromSocketId,
          conversationKey: m.conversationKey,
          fromName: m.fromName || m.name || 'Teammate',
          text: m.text || 'Sent you a message',
          at: m.at || new Date().toISOString(),
          read: false
        };
        setNotifications(prev => {
          if (prev.some(item => item.id === notification.id && item.kind === notification.kind)) return prev;
          return [notification, ...prev].slice(0, 50);
        });
      }
    });
    client.on('call:incoming', call => { setIncomingCall(call); });
    client.on('call:response', async result => {
      if (!result?.accepted) { setCallStatus('Call declined'); notify('Call declined.'); return; }
      const pending = window.__proxiPendingCall;
      if (pending) await startWebRtcCall(client, pending.targetSocketId, pending.kind, pending.name);
    });
    client.on('call:offer', async offer => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({audio:true, video:offer.kind==='video'});
        localStreamRef.current = stream;
        const pc = createPeer(client, offer.fromSocketId, stream);
        peerRef.current = pc;
        await pc.setRemoteDescription(new RTCSessionDescription(offer.offer));
        const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
        client.emit('call:answer',{targetSocketId:offer.fromSocketId,answer:pc.localDescription});
        setActiveCall({name:offer.fromName,kind:offer.kind,targetSocketId:offer.fromSocketId}); setCallStatus('Connected');
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) { notify(`Could not start call: ${err.message}`); client.emit('call:respond',{targetSocketId:offer.fromSocketId,accepted:false}); }
    });
    client.on('call:answer', async answer => { if(peerRef.current) { await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer.answer)); setCallStatus('Connected'); } });
    client.on('call:ice', async data => { try { await peerRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {} });
    client.on('call:hangup', () => endCall(false));
    client.on('proximity:ready', () => {
      // A peer may have attempted an offer before this browser's mic was ready.
      // Drop only unfinished peers so the next proximity pass can negotiate afresh.
      proximityPeersRef.current.forEach((pc, peerId) => {
        if (pc.connectionState !== 'connected' && pc.signalingState !== 'stable') {
          pc.close(); proximityPeersRef.current.delete(peerId);
          const audio = proximityAudioRef.current.get(peerId);
          if (audio) { audio.pause(); audio.srcObject = null; proximityAudioRef.current.delete(peerId); }
        }
      });
      setProximityRefresh(v => v + 1);
    });
    client.on('proximity:signal', async data => {
      try {
        if (!data?.fromSocketId) return;
        const stream = proximityStreamRef.current;
        let pc = proximityPeersRef.current.get(data.fromSocketId);
        if (data.type === 'ice' && data.candidate) {
          const pendingMap = window.__proxiPendingIce || (window.__proxiPendingIce = new Map());
          if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          else { const list = pendingMap.get(data.fromSocketId) || []; list.push(data.candidate); pendingMap.set(data.fromSocketId, list); }
          return;
        }
        if (!stream) return;
        if (data.type === 'offer') {
          if (!pc || ['closed','failed'].includes(pc.connectionState)) pc = createProximityPeer(client, data.fromSocketId, stream);
          await pc.setRemoteDescription(new RTCSessionDescription(data.description));
          const pending = (window.__proxiPendingIce || new Map()).get(data.fromSocketId) || [];
          for (const candidate of pending) { try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {} }
          window.__proxiPendingIce?.delete(data.fromSocketId);
          const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
          client.emit('proximity:signal', { targetSocketId: data.fromSocketId, type: 'answer', description: pc.localDescription });
        } else if (data.type === 'answer' && pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.description));
          const pending = (window.__proxiPendingIce || new Map()).get(data.fromSocketId) || [];
          for (const candidate of pending) { try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {} }
          window.__proxiPendingIce?.delete(data.fromSocketId);
        }
      } catch (err) { console.warn('Proximity signaling error:', err); }
    });
    client.on('system:notice', notice => { setSystemNotices(prev => [...prev.slice(-4), notice]); });
    return () => {
      client.disconnect();
      mediaPeersRef.current.forEach(pc=>pc.close()); mediaPeersRef.current.clear();
      if (socketRef.current === client) socketRef.current = null;
    };
  }, [authReady]);


  const notify = (text) => {
    setToast(text);
    window.clearTimeout(window.__proxiToastTimer);
    window.__proxiToastTimer = window.setTimeout(() => setToast(''), 2400);
  };

  const createPeer = (client, targetSocketId, stream) => {
    const pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = event => { if(event.candidate) client.emit('call:ice',{targetSocketId,candidate:event.candidate}); };
    pc.ontrack = event => { const remote = event.streams?.[0]; if(remote) { window.__proxiRemoteStream = remote; if(remoteVideoRef.current) remoteVideoRef.current.srcObject = remote; } };
    pc.onconnectionstatechange = () => { if(['failed','disconnected','closed'].includes(pc.connectionState)) setCallStatus(pc.connectionState); };
    return pc;
  };
  const createProximityPeer = (client, targetSocketId, stream) => {
    const existing = proximityPeersRef.current.get(targetSocketId);
    if (existing && !['closed','failed'].includes(existing.connectionState)) return existing;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = event => { if (event.candidate) client.emit('proximity:signal', { targetSocketId, type: 'ice', candidate: event.candidate }); };
    pc.ontrack = event => {
      let audio = proximityAudioRef.current.get(targetSocketId);
      if (!audio) { audio = new Audio(); audio.autoplay = true; audio.playsInline = true; proximityAudioRef.current.set(targetSocketId, audio); }
      audio.srcObject = event.streams[0];
      audio.volume = muted ? 0 : officeVolume; audio.muted = muted;
      audio.play().catch(() => notify('Click the page once to allow proximity audio playback.'));
    };
    pc.onconnectionstatechange = () => {
      setProximityPeerStates(prev => ({ ...prev, [targetSocketId]: pc.connectionState }));
      if (pc.connectionState === 'failed') {
        try { pc.restartIce?.(); } catch {}
        window.setTimeout(() => { if (proximityStreamRef.current && socketRef.current?.connected) setProximityRefresh(v => v + 1); }, 1200);
      }
      if (['failed','closed'].includes(pc.connectionState)) {
        pc.close(); proximityPeersRef.current.delete(targetSocketId);
        const audio = proximityAudioRef.current.get(targetSocketId); if (audio) { audio.srcObject = null; proximityAudioRef.current.delete(targetSocketId); }
      }
    };
    proximityPeersRef.current.set(targetSocketId, pc);
    return pc;
  };

  const publishMedia = async () => {
    const client=socketRef.current; if(!client?.connected)return;
    const tracks=[...(cameraStreamRef.current?.getVideoTracks()||[]),...(screenStreamRef.current?.getVideoTracks()||[])];
    const videoKinds=tracks.map(t=>({id:t.id,kind:t===screenStreamRef.current?.getVideoTracks()[0]?'screen':'camera'}));
    client.emit('media:status',{cameraOn:Boolean(cameraStreamRef.current?.getVideoTracks().some(t=>t.readyState==='live'&&t.enabled)),sharing:Boolean(screenStreamRef.current?.getVideoTracks().some(t=>t.readyState==='live')),mediaStatus:tracks.length?'connected':'disconnected'});
    for(const person of livePeople){if(!person.socketId||person.socketId===client.id)continue;try{let pc=mediaPeersRef.current.get(person.socketId);if(!pc||pc.connectionState==='closed'||pc.connectionState==='failed'){pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});mediaPeersRef.current.set(person.socketId,pc);pc.onicecandidate=e=>{if(e.candidate)client.emit('media:signal',{targetSocketId:person.socketId,type:'ice',candidate:e.candidate});};pc.ontrack=e=>{const stream=e.streams?.[0]||new MediaStream([e.track]);const kind=videoKinds.find(x=>x.id===e.track.id)?.kind||'camera';setRemoteMedia(prev=>({...prev,[person.socketId]:{...(prev[person.socketId]||{}),[kind]:stream,status:'connected'}}));};pc.onconnectionstatechange=()=>setRemoteMedia(prev=>({...prev,[person.socketId]:{...(prev[person.socketId]||{}),status:pc.connectionState}}));}
      // Keep a single sender for each kind and replace its track when toggled.
      const senders=pc.getSenders();for(const sender of senders){if(sender.track?.kind==='video')await sender.replaceTrack(null);}
      for(const track of tracks){const sender=pc.getSenders().find(x=>x.track?.id===track.id);if(!sender)pc.addTrack(track,track===screenStreamRef.current?.getVideoTracks()[0]?screenStreamRef.current:cameraStreamRef.current);}
      const offer=await pc.createOffer();await pc.setLocalDescription(offer);client.emit('media:signal',{targetSocketId:person.socketId,type:'offer',description:pc.localDescription,videoKinds});
    }catch(err){console.warn('Could not publish camera/screen to teammate',err);}}
  };
  const uploadProfilePhoto = (file) => { if(!file)return; if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>1024*1024){notify('Choose a PNG, JPG, WEBP or GIF image under 1 MB.');return;}const reader=new FileReader();reader.onload=()=>{socketRef.current?.emit('profile:photo',{photo:reader.result});};reader.readAsDataURL(file); };
  const toggleCamera = async () => { try {if(cameraStreamRef.current){cameraStreamRef.current.getTracks().forEach(t=>t.stop());cameraStreamRef.current=null;setCameraOn(false);}else{cameraStreamRef.current=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:360}},audio:false});setCameraOn(true);}await publishMedia();}catch(err){notify(`Camera unavailable: ${err.message}`);} };
  const toggleScreenShare = async () => {try{if(screenStreamRef.current){screenStreamRef.current.getTracks().forEach(t=>t.stop());screenStreamRef.current=null;setSharing(false);}else{screenStreamRef.current=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});screenStreamRef.current.getVideoTracks()[0].addEventListener('ended',()=>{screenStreamRef.current=null;setSharing(false);publishMedia();});setSharing(true);}await publishMedia();}catch(err){notify(`Screen sharing unavailable: ${err.message}`);} };

  const toggleProximityVoice = async () => {
    const client = socketRef.current;
    if (!client?.connected) {
      notify('Connect to the office server before enabling proximity voice.');
      return;
    }

    // IMPORTANT: muting proximity voice must not destroy the WebRTC peer mesh.
    // Keep the microphone stream and peer connections alive so the user can
    // continue hearing teammates while their own microphone is off.
    if (proximityVoiceOn) {
      const stream = proximityStreamRef.current;
      stream?.getAudioTracks().forEach(track => { track.enabled = false; });
      setProximityVoiceOn(false);
      setProximityStatus('Microphone off · still hearing nearby users');
      client.emit('proximity:stopped');
      notify('Proximity microphone off. You can still hear nearby teammates.');
      return;
    }

    try {
      let stream = proximityStreamRef.current;
      if (!stream || stream.getAudioTracks().every(track => track.readyState === 'ended')) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            channelCount: 1,
          },
          video: false,
        });
        proximityStreamRef.current = stream;
      }

      // Re-enable the existing sender tracks instead of rebuilding peers.
      stream.getAudioTracks().forEach(track => { track.enabled = true; });
      setProximityVoiceOn(true);
      setProximityStatus('Mic on · finding nearby users');
      client.emit('proximity:ready');
      setProximityRefresh(v => v + 1);
      notify('Proximity voice enabled. Nearby voice connects automatically.');
    } catch (err) {
      setProximityStatus('Microphone permission needed');
      notify(`Could not access microphone: ${err.message}`);
    }
  };

  const startWebRtcCall = async (client, targetSocketId, kind, name) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'});
      localStreamRef.current = stream;
      const pc = createPeer(client,targetSocketId,stream); peerRef.current = pc;
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      client.emit('call:offer',{targetSocketId,offer:pc.localDescription,kind,fromName:displayName});
      setActiveCall({name,kind,targetSocketId}); setCallStatus('Calling…');
      setTimeout(()=>{ if(localVideoRef.current) localVideoRef.current.srcObject=stream; },0);
    } catch (err) { notify(`Microphone/camera permission failed: ${err.message}`); }
  };
  useEffect(() => { if (activeCall) { if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current; if (remoteVideoRef.current && window.__proxiRemoteStream) remoteVideoRef.current.srcObject = window.__proxiRemoteStream; } }, [activeCall, callStatus]);

  const toggleCallMicrophone = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    if (!activeCall || tracks.length === 0) {
      notify('Start an audio call with a teammate to use your microphone.');
      return;
    }
    const nextEnabled = !tracks[0].enabled;
    tracks.forEach(track => { track.enabled = nextEnabled; });
    setMicOn(nextEnabled);
    notify(nextEnabled ? 'Microphone on' : 'Microphone muted');
  };

  // Establish a separate WebRTC audio mesh for users within the office voice radius.
  useEffect(() => {
    if (!proximityVoiceOn || !socket?.connected || !proximityStreamRef.current) return;
    const maxRange = 24; // map percentage points
    const me = livePeople.find(p => p.socketId === socket.id);
    const current = me?.position || position;
    livePeople.forEach(async person => {
      if (!person.socketId || person.socketId === socket.id || !person.position) return;
      const dx = Number(current.x) - Number(person.position.x);
      const dy = Number(current.y) - Number(person.position.y);
      const distance = Math.hypot(dx, dy);
      const existing = proximityPeersRef.current.get(person.socketId);
      if (distance <= maxRange && !existing && socket.id.localeCompare(person.socketId) < 0) {
        try {
          const pc = createProximityPeer(socket, person.socketId, proximityStreamRef.current);
          const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
          socket.emit('proximity:signal', { targetSocketId: person.socketId, type: 'offer', description: pc.localDescription });
        } catch (err) { console.warn('Could not start proximity connection:', err); }
      } else if (distance > maxRange && existing) {
        existing.close(); proximityPeersRef.current.delete(person.socketId);
        const audio = proximityAudioRef.current.get(person.socketId); if (audio) { audio.pause(); audio.srcObject = null; proximityAudioRef.current.delete(person.socketId); }
      }
      const audio = proximityAudioRef.current.get(person.socketId);
      if (audio) audio.volume = muted || distance >= maxRange ? 0 : Math.max(0, 1 - distance / maxRange) * officeVolume;
    });
    setProximityStatus(`${proximityVoiceOn ? 'Mic on' : 'Mic off'} · ${livePeople.filter(p => p.socketId !== socket?.id && p.position && Math.hypot(Number((p.position.x)) - Number(position.x), Number(p.position.y) - Number(position.y)) <= maxRange).length} nearby`);
  }, [proximityVoiceOn, socket, livePeople, position, muted, officeVolume, proximityRefresh]);

  useEffect(() => () => {
    proximityPeersRef.current.forEach(pc => pc.close()); proximityPeersRef.current.clear();
    proximityAudioRef.current.forEach(audio => { audio.pause(); audio.srcObject = null; }); proximityAudioRef.current.clear();
    proximityStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  // Keyboard navigation: arrow keys move the local avatar while the office is focused.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      if (activeNav !== 'Office' || selectedPerson || incomingCall || activeCall) return;
      event.preventDefault();
      const step = event.shiftKey ? 5 : 2;
      const next = { x: Math.max(4, Math.min(96, position.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0))), y: Math.max(8, Math.min(90, position.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0))) };
      setPosition(next); socket?.emit('office:position', next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [position, socket, activeNav, selectedPerson, incomingCall, activeCall]);

  const askHelpAssistant = (event) => {
    event?.preventDefault();
    const q = helpQuestion.trim().toLowerCase();
    if (!q) return;
    const answers = [
      [/proximity|voice|hear|audio|mic|microphone/, 'Both people should enable Proximity Voice, allow microphone permission, keep the office open, and stay within the hearing radius. Use headphones to reduce echo. If the status stays Connecting, check the browser console and network/firewall; restrictive networks may require a TURN server.'],
      [/move|avatar|position|keyboard/, 'Click an empty area of the office or drag your avatar. You can also use the arrow keys; hold Shift to move farther per key press.'],
      [/call|video|camera/, 'Select a teammate and choose Audio call or Video call. The other person must accept and allow microphone/camera access.'],
      [/chat|message/, 'Use Office Chat for the room-wide channel, or select a teammate to send a direct message.'],
      [/mute|volume|noise|echo/, 'Use the Mute control to silence incoming office audio and adjust Office audio volume in Settings. Headphones help prevent acoustic feedback.'],
      [/connection|offline|reconnect|network/, 'Check that the backend is running and that VITE_API_URL points to it. Proximity voice may require TURN configuration across some networks.'],
      [/mongodb|database|data/, 'This build currently persists accounts and chat in a local SQLite database. MongoDB is not configured in this build; add a MongoDB URI and migrate the backend persistence layer before describing MongoDB as implemented.']
    ];
    const match = answers.find(([pattern]) => pattern.test(q));
    setHelpAnswer(match ? match[1] : 'I can help with proximity voice, avatar movement, audio/video calls, chat, mute/volume, network troubleshooting, and the current database setup. Try asking about one of those topics.');
  };

  // During a direct call, attenuate the remote audio according to the two avatars'
  // 2D positions on the office map. WebRTC still carries the actual audio stream.
  useEffect(() => {
    if (!activeCall || !remoteVideoRef.current) return;
    const remote = livePeople.find(p => p.socketId === activeCall.targetSocketId);
    if (!remote?.position) {
      remoteVideoRef.current.volume = 1;
      return;
    }
    const dx = (Number(position.x) - Number(remote.position.x)) / 100;
    const dy = (Number(position.y) - Number(remote.position.y)) / 100;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRange = 0.42;
    remoteVideoRef.current.volume = distance >= maxRange ? 0 : Math.max(0.08, 1 - distance / maxRange);
  }, [position, livePeople, activeCall, callStatus]);

  const endCall = (notifyPeer=true) => {
    if(notifyPeer && activeCall?.targetSocketId) socket?.emit('call:hangup',{targetSocketId:activeCall.targetSocketId});
    peerRef.current?.close(); peerRef.current=null;
    localStreamRef.current?.getTracks().forEach(track=>track.stop()); localStreamRef.current=null;
    if(localVideoRef.current) localVideoRef.current.srcObject=null;
    if(remoteVideoRef.current) remoteVideoRef.current.srcObject=null; window.__proxiRemoteStream=null;
    setActiveCall(null); setCallStatus(''); window.__proxiPendingCall=null;
  };

  const submitAuth = async (e) => {
    e.preventDefault(); setAuthError(''); setAuthBusy(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const isRegister = authMode === 'register';
      const response = await fetch(`${apiUrl}/api/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRegister ? { name: authName, email: authEmail, password: authPassword } : { email: authEmail, password: authPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed.');
      localStorage.setItem('proxispeak-token', data.token);
      localStorage.setItem('proxispeak-user', JSON.stringify(data.user));
      localStorage.setItem('proxispeak-name', data.user.name);
      localStorage.removeItem('proxispeak-guest');
      setAccount(data.user); setDisplayName(data.user.name); setAuthReady(true);
    } catch (err) { setAuthError(err.message || 'Could not connect to the backend.'); }
    finally { setAuthBusy(false); }
  };

  const continueAsGuest = () => {
    const name = (authName.trim() || `Guest-${Math.floor(100 + Math.random() * 900)}`).slice(0, 40);
    localStorage.removeItem('proxispeak-token'); localStorage.removeItem('proxispeak-user');
    localStorage.setItem('proxispeak-guest', 'true'); localStorage.setItem('proxispeak-name', name);
    setAccount(null); setDisplayName(name); setAuthReady(true); setAuthError('');
  };

  const logout = () => {
    localStorage.removeItem('proxispeak-token'); localStorage.removeItem('proxispeak-user'); localStorage.removeItem('proxispeak-guest'); localStorage.removeItem('proxispeak-name');
    setAccount(null); setDisplayName(''); setAuthReady(false); setLivePeople([]); setMessages([]);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (!socket?.connected) { notify('Backend is offline. Start the backend in the backend folder.'); return; }
    socket.emit('chat:send', { text });
    setDraft('');
  };

  const openNotification = (item) => {
    setNotifications(prev => prev.map(n => n.kind === item.kind && n.id === item.id ? { ...n, read: true } : n));
    setNotificationsOpen(false);
    if (item.kind === 'Office chat' || item.kind === 'Group chat') {
      setChatMode('Office Chat');
      setChatMenuOpen(false);
      setActiveNav('Chat');
      return;
    }

    // Direct-message notifications should open the sender's conversation.
    const senderSocketId = item.fromSocketId || item.senderSocketId;
    const sender = livePeople.find(person => person.socketId === senderSocketId || person.name === item.fromName);
    if (sender) {
      setSelectedPerson(sender);
      return;
    }

    setChatMode('Personal Chat');
    setChatMenuOpen(false);
    setActiveNav('Personal Chat');
    notify(`${item.fromName || 'This teammate'} is no longer online. Open Personal Chat to continue when they return.`);
  };

  const navItems = [
    { name: 'Office', icon: Home },
    { name: 'Chat', icon: MessageSquare },
    { name: 'People', icon: Users },
    { name: 'Settings', icon: Settings },
    { name: 'Help', icon: CircleHelp }
  ];

  if (!authReady) return <div className="auth-screen"><div className="auth-card">
    <div className="auth-brand"><span className="brand-mark"><Activity size={22} strokeWidth={3}/></span><span>Proxi<span>Speak</span></span></div>
    <p className="auth-kicker">YOUR TEAM, CLOSER</p><h1>{authMode === 'register' ? 'Create your account' : 'Welcome to your office'}</h1>
    <p className="auth-description">Sign in to keep your identity, or join instantly as a guest.</p>
    <div className="auth-tabs"><button className={authMode === 'login' ? 'active' : ''} onClick={() => {setAuthMode('login');setAuthError('');}}>Login</button><button className={authMode === 'register' ? 'active' : ''} onClick={() => {setAuthMode('register');setAuthError('');}}>Register</button></div>
    <form className="auth-form" onSubmit={submitAuth}>
      {authMode === 'register' && <label>Full name<input value={authName} onChange={e=>setAuthName(e.target.value)} required minLength={2} maxLength={40} placeholder="Your name" autoComplete="name"/></label>}
      <label>Email address<input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email"/></label>
      <label>Password<input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} required minLength={authMode === 'register' ? 8 : 1} placeholder={authMode === 'register' ? 'At least 8 characters' : 'Your password'} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}/></label>
      {authError && <p className="auth-error">{authError}</p>}
      <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Sign in'}</button>
    </form>
    <div className="auth-divider"><span>OR</span></div>
    <form className="guest-form" onSubmit={e=>{e.preventDefault();continueAsGuest();}}><label>Guest display name (optional)<input value={authName} onChange={e=>setAuthName(e.target.value)} maxLength={40} placeholder="e.g. Guest-Sam"/></label><button className="guest-submit" type="submit">Continue as guest <span>→</span></button></form>
    <p className="auth-footnote"><ShieldCheck size={14}/> Accounts and messages are stored in your local SQLite database.</p>
  </div></div>;

  return <div className="app-shell">
    <style>{`
      /* ProxiSpeak light blue workspace theme */
      .app-shell .topbar { background: #eef5fb !important; color: #243b53 !important; border-bottom: 1px solid #d7e5f2 !important; }
      .app-shell .sidebar { background: #eaf2fa !important; color: #304b66 !important; border-right: 1px solid #d7e5f2 !important; }
      .app-shell .sidebar .nav-item { color: #47627c !important; }
      .app-shell .sidebar .nav-item:hover, .app-shell .sidebar .nav-item.active { background: #d8e9f8 !important; color: #183b5b !important; }
      .app-shell .sidebar .sidebar-bottom { color: #56718a !important; border-top-color: #d7e5f2 !important; }
      .app-shell .topbar .product-title, .app-shell .topbar .brand { color: #243b53 !important; }
      .app-shell .topbar .icon-button { color: #365875 !important; }
      .app-shell .topbar .icon-button:hover { background: #dcebf8 !important; }
      .app-shell .topbar .logout-button { background: #d8e9f8 !important; color: #234765 !important; border-color: #c6dced !important; }
      .app-shell .notification-panel button[type="button"]:hover { background: #e0effb !important; }
    `}</style>
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Activity size={22} strokeWidth={3}/></span><span>Proxi<span>Speak</span></span></div>
      <div className="product-title"><strong>Virtual Office</strong><span>Move · Chat · Talk · Collaborate</span></div>
      <div className="top-actions">
        <button className="online-pill" style={{ color: '#17324D' }} onClick={() => { const next = status === 'Online' ? 'Away' : 'Online'; setStatus(next); socket?.emit('presence:status', next); }}><i className={status === 'Online' ? 'status-dot' : 'status-dot away'}/>{connection === 'Connected' ? `Online: ${livePeople.length}` : connection}</button>
        <button className="icon-button" title="Participants" onClick={() => setActiveNav('People')}><Users/></button>
        <button className="icon-button notification-bell" style={{ position: 'relative' }} title="Notifications" aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`} onClick={() => { setNotificationsOpen(v => !v); setNotifications(prev => prev.map(item => ({ ...item, read: true }))); }}><Bell/>{unreadNotifications > 0 && <span className="notification-badge" style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: '#e5484d', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</button>
        <button className="icon-button" title="Settings" onClick={() => setActiveNav('Settings')}><Settings/></button>
        <button className="logout-button" onClick={logout}>Log out</button>
      </div>
    </header>

    <aside className="sidebar">
      <div className="mobile-brand">PS</div>
      <nav>{navItems.map(({name, icon: Icon}) => <button key={name} className={`nav-item ${activeNav === name ? 'active' : ''}`} onClick={() => { if(name==='Chat'){setChatMenuOpen(v=>!v);setActiveNav('Office');}else{setChatMenuOpen(false);setActiveNav(name);} }}><Icon size={21}/><span>{name}</span></button>)}</nav>
      <div className="sidebar-bottom"><span className="connection-led"/><span>Office connected</span><button title="Connection details" onClick={() => notify('Frontend preview mode')}><ShieldCheck size={17}/></button></div>
    </aside>

    <main className="main-area">
      <div className="workspace-toolbar">
        <div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search people, rooms or spaces..."/></div>
        <div className="toolbar-right"><span className="date-label"><CalendarDays size={17}/> Virtual Office</span><button className="icon-button light notification-bell" style={{ position: 'relative' }} title="Notifications" aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`} onClick={() => { setNotificationsOpen(v => !v); setNotifications(prev => prev.map(item => ({ ...item, read: true }))); }}><Bell size={19}/>{unreadNotifications > 0 && <span className="notification-badge" style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: '#e5484d', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</button><button className="profile profile-button" onClick={() => setProfileOpen(true)}><Avatar tone="violet" name={displayName} photo={profilePhoto}/><div><b>{displayName}</b><small><i className="status-dot"/> {account ? 'Signed in' : 'Guest'} · {status}</small></div><ChevronDown size={16}/></button></div>
      </div>

      {notificationsOpen && <section className="notification-panel" role="dialog" aria-label="Notifications" style={{ position: 'fixed', top: 76, right: 24, zIndex: 3000, width: 'min(360px, calc(100vw - 32px))', maxHeight: 'min(440px, calc(100vh - 100px))', overflowY: 'auto', padding: 16, border: '1px solid #dce3ec', borderRadius: 14, background: '#ffffff', color: '#172033', boxShadow: '0 12px 36px rgba(15, 23, 42, 0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <strong>Notifications</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            {notifications.length > 0 && <button type="button" className="plain-icon" onClick={() => setNotifications([])} title="Clear all notifications">Clear</button>}
            <button type="button" className="plain-icon" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={17}/></button>
          </div>
        </div>
        {notifications.length === 0 ? <p style={{ margin: '12px 0', color: '#64748b' }}>You're all caught up.</p> : notifications.map(item => <button type="button" key={`${item.kind}-${item.id}`} onClick={() => openNotification(item)} style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', padding: '12px 10px', border: 0, borderTop: '1px solid #e8edf3', borderRadius: 8, background: item.read ? '#ffffff' : '#eef6ff', color: '#172033', opacity: item.read ? 0.82 : 1, marginTop: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}><strong style={{ fontSize: 14 }}>{item.fromName}</strong><small style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{item.kind}</small></div>
          <p style={{ margin: '5px 0', overflowWrap: 'anywhere' }}>{item.text}</p>
          <small style={{ color: '#64748b' }}>{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Click to open</small>
        </button>)}
      </section>}

      {chatMenuOpen && <div className="chat-menu"><button onClick={()=>{setChatMode('Office Chat');setActiveNav('Chat');setChatMenuOpen(false);}}>Office Chat</button><button onClick={()=>{setChatMode('Personal Chat');setActiveNav('Personal Chat');setChatMenuOpen(false);}}>Personal Chat</button></div>}
      {activeNav !== 'Office' && <section className="nav-page panel">
        <div className="office-heading"><div><span className="eyebrow">PROXISPEAK WORKSPACE</span><h1>{activeNav}</h1><p>{activeNav === 'Chat' ? 'Send messages to everyone in the office.' : activeNav === 'People' ? 'Find teammates and start direct conversations or calls.' : activeNav === 'Settings' ? 'Manage your local workspace preferences.' : 'Quick help for using ProxiSpeak.'}</p></div><button className="outline-button" onClick={() => setActiveNav('Office')}><Home size={17}/> Back to Office</button></div>
        {activeNav === 'Chat' && chatMode==='Office Chat' && <><div className="messages-list nav-messages">{messages.map((m,i)=><div className="message-row" key={m.id || i}><Avatar tone={m.tone} name={m.name}/><div className="message-body"><div className="message-meta"><b>{m.name}</b><time>{m.time}</time></div><p>{m.text}</p></div></div>)}</div><form className="message-composer" onSubmit={sendMessage}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Type a message to the office…"/><button type="submit" disabled={!draft.trim()}><Send size={17}/></button></form></>}
        {activeNav === 'Personal Chat' && <><h2>Choose a teammate to start a personal chat</h2><div className="people-list nav-people">{filteredPeople.filter(p=>p.socketId!==socket?.id).map(p=><button className="person-row" key={p.socketId} onClick={()=>setSelectedPerson(livePeople.find(x=>x.socketId===p.socketId)||p)}><Avatar tone={p.tone} name={p.name} photo={p.profilePhoto}/><span className="person-info"><b>{p.name}</b><small>{p.status||'Online'}</small></span></button>)}</div></>}
        {activeNav === 'People' && <><div className="people-search"><Search size={16}/><input value={peopleSearch} onChange={e=>setPeopleSearch(e.target.value)} placeholder="Search people…"/></div><div className="people-list nav-people">{filteredPeople.map(p=><button className="person-row" key={p.socketId || p.name} onClick={()=>setSelectedPerson(livePeople.find(x=>x.name===p.name.replace(' (You)','')) || p)}><Avatar tone={p.tone} name={p.name}/><span className="person-info"><b>{p.name}</b><small>{p.place || 'Office'} · {p.status || 'Online'}</small></span><span className="online-indicator"/></button>)}</div></>}
        {activeNav === 'Settings' && <div className="settings-options"><label>Display name<input value={displayName} onChange={e=>{setDisplayName(e.target.value);localStorage.setItem('proxispeak-name',e.target.value);}} /></label><label>Office audio volume <input type="range" min="0" max="1" step="0.05" value={officeVolume} onChange={e=>setOfficeVolume(Number(e.target.value))}/><span>{Math.round(officeVolume*100)}%</span></label><label>Presence status<select value={status} onChange={e=>{setStatus(e.target.value);socket?.emit('presence:status',e.target.value);}}><option>Online</option><option>Away</option><option>Busy</option></select></label><button className="outline-button" onClick={()=>notify(`Backend status: ${connection}`)}><ShieldCheck size={17}/> Test connection</button></div>}
        {activeNav === 'Help' && <div className="help-content"><h3>ProxiSpeak Help Assistant</h3><p>Ask a quick question about voice, calls, movement, chat, or troubleshooting. This is an in-app FAQ assistant, not a connected generative-AI service.</p><form className="message-composer" onSubmit={askHelpAssistant}><input value={helpQuestion} onChange={e=>setHelpQuestion(e.target.value)} placeholder="e.g. Why can’t I hear nearby users?"/><button type="submit" disabled={!helpQuestion.trim()}><Send size={17}/></button></form>{helpAnswer && <div className="help-answer" role="status">{helpAnswer}</div>}<h3>How to use ProxiSpeak</h3><ol><li>Join the office using a guest name or account.</li><li>Click an empty place in the office to move your avatar, or drag your avatar.</li><li>Enable Proximity Voice and allow microphone access.</li><li>Users nearby must also enable Proximity Voice; keep the app open to hear them.</li><li>Select a teammate to send a direct message or start an audio/video call.</li><li>Use Mute to silence incoming office audio.</li></ol><p>Microphone and camera access require localhost or HTTPS. Voice connections may need TURN configuration on restrictive networks.</p></div>}
      </section>}
      {activeNav === 'Office' && <div className="content-grid">
        <section className="office-column">
          <div className="office-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Virtual Office</h1><p>Move around, meet your team, and work together.</p></div><button className="outline-button" onClick={() => notify('Office map view is active')}><LayoutGrid size={17}/> Office map</button></div>
          <div className="office-stage office-floorplan" onPointerDown={e => { if (!e.target.closest('.floor-person')) { const r=e.currentTarget.getBoundingClientRect(); const next={x:Math.max(4,Math.min(96,((e.clientX-r.left)/r.width)*100)),y:Math.max(8,Math.min(90,((e.clientY-r.top)/r.height)*100))}; setPosition(next); socket?.emit('office:position',next); } }}>
            <img className="office-photo exact-office-photo" src="/office-scene.png" alt="ProxiSpeak open-plan virtual office" />
            <div className="office-image-shade" />
            {livePeople.map((p, i) => {
              const isMe = p.socketId ? p.socketId === socket?.id : (p.name === displayName && i === 0);
              const angle = (i * 137.5) * Math.PI / 180;
              const fallback = { x: 48 + Math.cos(angle) * Math.min(30, 8 + i * 4), y: 52 + Math.sin(angle) * Math.min(30, 8 + i * 4) };
              const pos = isMe ? position : (p.position || fallback);
              return <button key={p.socketId || p.id || `${p.name}-${i}`} className={`floor-person ${isMe ? 'is-me' : ''}`} style={{left:`${pos.x}%`,top:`${pos.y}%`}} onPointerDown={e => { if (isMe) { e.preventDefault(); e.stopPropagation(); setDraggingSelf(true); e.currentTarget.setPointerCapture(e.pointerId); } }} onPointerMove={e => { if (!isMe || !draggingSelf) return; const r=e.currentTarget.parentElement.getBoundingClientRect(); const next={x:Math.max(4,Math.min(96,((e.clientX-r.left)/r.width)*100)),y:Math.max(8,Math.min(90,((e.clientY-r.top)/r.height)*100))}; setPosition(next); socket?.emit('office:position',next); }} onPointerUp={() => setDraggingSelf(false)} onClick={() => { if (!isMe) setSelectedPerson(p); }} title={isMe ? 'Drag to move' : `Click to chat or call ${p.name}`}>
                <Avatar tone={toneForName(p.name)} small photo={p.profilePhoto}/>{(remoteMedia[p.socketId]?.camera || (isMe&&cameraStreamRef.current)) && <video className="avatar-media-preview" autoPlay playsInline muted={isMe} ref={el=>{if(el){const stream=isMe?cameraStreamRef.current:remoteMedia[p.socketId]?.camera;if(stream&&el.srcObject!==stream)el.srcObject=stream;}}} />} {(remoteMedia[p.socketId]?.screen || (isMe&&screenStreamRef.current)) && <video className="avatar-media-preview screen-preview" autoPlay playsInline muted ref={el=>{if(el){const stream=isMe?screenStreamRef.current:remoteMedia[p.socketId]?.screen;if(stream&&el.srcObject!==stream)el.srcObject=stream;}}} />}<span className="floor-person-label"><b>{p.name}{isMe ? ' (You)' : ''}</b><small>{isMe ? 'You are here' : (remoteMedia[p.socketId]?.status==='connected'?'Media connected':p.cameraOn||p.sharing?'Media connecting':'Click to connect')}</small>{(p.cameraOn||p.sharing)&&<small>{p.cameraOn?'📷 Camera ':''}{p.sharing?'▣ Sharing':''}</small>}</span>
              </button>;
            })}
            <div className="stage-count"><span className="status-dot"/> {livePeople.length} {livePeople.length === 1 ? 'person' : 'people'} online</div>
            <div className="floor-hint">Click to move · Drag avatar · Arrow keys move (Shift = larger step) · Select teammates to chat/call</div>
          </div>
          <div className="call-toolbar">
            <button className={proximityVoiceOn ? 'call-control selected' : 'call-control'} onClick={toggleProximityVoice}>{proximityVoiceOn ? <Mic size={20}/> : <MicOff size={20}/>}<span>{proximityVoiceOn ? 'Voice on' : 'Proximity mic'}</span></button>
            <button className={muted ? 'call-control selected' : 'call-control'} onClick={() => { const next = !muted; setMuted(next); proximityAudioRef.current.forEach(audio => { audio.volume = next ? 0 : officeVolume; }); notify(next ? 'All incoming office audio muted' : 'Office audio unmuted'); }}>{muted ? <VolumeX size={20}/> : <Volume2 size={20}/>}<span>{muted ? 'Unmute' : 'Mute'}</span></button>
            <button className={cameraOn ? 'call-control selected' : 'call-control'} onClick={toggleCamera}>{cameraOn ? <Video size={20}/> : <VideoOff size={20}/>}<span>{cameraOn ? 'Camera on' : 'Camera'}</span></button>
            <button className={sharing ? 'call-control selected' : 'call-control'} onClick={toggleScreenShare}><MonitorUp size={20}/><span>{sharing ? 'Stop share' : 'Share screen'}</span></button>
            <button className="call-control" onClick={() => setActiveNav('People')}><Users size={20}/><span>Participants</span></button>
            <button className="call-control leave" onClick={() => { if (proximityVoiceOn) toggleProximityVoice(); if (activeCall) endCall(); notify('Voice session ended.'); }}><PhoneOff size={20}/><span>Leave</span></button>
          </div>
        </section>

        {/* Home view intentionally keeps the office canvas uncluttered; chats are opened from Chat. */}
        <aside className="right-column home-hidden-panels" aria-hidden="true" style={{display:'none'}}>
          <section className="panel chat-panel">
            <div className="panel-header"><div><h2>Office Chat</h2><span className="panel-subtitle"><span className="status-dot"/> General channel</span></div><button className="plain-icon" onClick={()=>setChatCollapsed(v=>!v)} title={chatCollapsed?'Expand chat':'Collapse chat'}>{chatCollapsed?<PanelRightOpen size={18}/>:<PanelRightClose size={18}/>}</button></div>
            {!chatCollapsed && <>
              <div className="channel-chip"># General <MoreHorizontal size={16}/></div>
              <div className="messages-list">{systemNotices.map((n,i)=><div className="system-notice" key={`notice-${i}`}>{n.text}</div>)}{messages.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.text.toLowerCase().includes(search.toLowerCase())).map((m,i)=><div className="message-row" key={`${m.name}-${i}`}><Avatar tone={m.tone} name={m.name}/><div className="message-body"><div className="message-meta"><b>{m.name}</b><time>{m.time}</time></div><p>{m.text}</p></div></div>)}</div>
              <form className="message-composer" onSubmit={sendMessage}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Type a message..." aria-label="Type a message"/><button type="submit" aria-label="Send message" disabled={!draft.trim()}><Send size={17}/></button></form>
            </>}
          </section>

          <section className="panel people-panel">
            <div className="panel-header"><div><h2>People in Office <span className="count-badge">{filteredPeople.length}</span></h2><span className="panel-subtitle">Your teammates, at a glance</span></div><button className="plain-icon" onClick={()=>setPeopleCollapsed(v=>!v)}>{peopleCollapsed?<PanelRightOpen size={18}/>:<PanelRightClose size={18}/>}</button></div>
            {!peopleCollapsed && <>
              <div className="people-search"><Search size={16}/><input value={peopleSearch} onChange={e=>setPeopleSearch(e.target.value)} placeholder="Search people..."/></div>
              <div className="people-list">{filteredPeople.map(p=><button className="person-row" key={p.name} onClick={()=>setSelectedPerson(livePeople.find(x => x.name === p.name.replace(' (You)','')) || p)}><Avatar tone={p.tone} name={p.name}/><span className="person-info"><b>{p.name}</b><small>{p.place || 'Office'}{p.status ? ` · ${p.status}` : ''}</small></span><span className="online-indicator"/></button>)}</div>
            </>}
          </section>

          <section className="panel voice-panel">
            <div className="panel-header"><div><h2>Proximity Voice</h2><span className="panel-subtitle"><span className="status-dot"/> {proximityStatus} · {connection}</span></div><button className="plain-icon" onClick={()=>setVoiceCollapsed(v=>!v)}>{voiceCollapsed?<PanelRightOpen size={18}/>:<PanelRightClose size={18}/>}</button></div>
            {!voiceCollapsed && <><button className={`mic-button ${proximityVoiceOn?'mic-active':''}`} onClick={toggleProximityVoice}>{proximityVoiceOn?<Mic size={20}/>:<MicOff size={20}/>} {proximityVoiceOn?'Turn proximity voice off':'Turn proximity voice on'}</button><p>Allow microphone access. Keep this page open; users within 24 map units connect automatically and volume fades with distance.</p><div className="nearby-strip"><span>Nearby users</span>{livePeople.filter(p=>p.socketId!==socket?.id && p.position && Math.hypot(Number(p.position.x)-Number(position.x),Number(p.position.y)-Number(position.y))<=24).map(p=><Avatar key={p.socketId} tone={toneForName(p.name)} small name={p.name}/>)}</div></>}
          </section>
        </aside>
      </div>}
    </main>
    {selectedPerson && <div className="modal-backdrop" onClick={() => setSelectedPerson(null)}><section className="direct-modal" onClick={e => e.stopPropagation()}><header><div><Avatar tone={toneForName(selectedPerson.name)} name={selectedPerson.name}/><span><b>{selectedPerson.name}</b><small>{selectedPerson.status || 'Online'} · {selectedPerson.location || 'Office'}</small></span></div><button className="plain-icon" onClick={() => setSelectedPerson(null)}><X size={18}/></button></header><div className="direct-actions"><button onClick={() => { if (!selectedPerson.socketId) { notify('This person is no longer online.'); return; } window.__proxiPendingCall={targetSocketId:selectedPerson.socketId,kind:'audio',name:selectedPerson.name}; socket?.emit('call:request',{targetSocketId:selectedPerson.socketId,kind:'audio'}); notify(`Calling ${selectedPerson.name}…`); }}><Mic size={17}/> Audio call</button><button onClick={() => { if (!selectedPerson.socketId) { notify('This person is no longer online.'); return; } window.__proxiPendingCall={targetSocketId:selectedPerson.socketId,kind:'video',name:selectedPerson.name}; socket?.emit('call:request',{targetSocketId:selectedPerson.socketId,kind:'video'}); notify(`Calling ${selectedPerson.name}…`); }}><Video size={17}/> Video call</button></div><div className="direct-message-list">{directMessages.filter(m => m.conversationKey === [socket?.id, selectedPerson.socketId].sort().join(':') || m.fromSocketId === selectedPerson.socketId || m.toSocketId === selectedPerson.socketId).map((m,i)=><div className={`direct-bubble ${m.fromSocketId === socket?.id ? 'mine' : ''}`} key={m.id || i}><b>{m.fromName || m.name}</b><p>{m.text}</p><small>{m.time}</small></div>)}</div><form className="message-composer direct-composer" onSubmit={e => { e.preventDefault(); const text=directDraft.trim(); if(!text || !selectedPerson.socketId) return; socket?.emit('direct:send',{targetSocketId:selectedPerson.socketId,text}); setDirectDraft(''); }}><input value={directDraft} onChange={e=>setDirectDraft(e.target.value)} placeholder={`Message ${selectedPerson.name}…`}/><button type="submit" disabled={!directDraft.trim()}><Send size={17}/></button></form></section></div>}
    {profileOpen && <div className="modal-backdrop" onClick={()=>setProfileOpen(false)}><section className="direct-modal profile-modal" onClick={e=>e.stopPropagation()}><header><div><Avatar tone="violet" name={displayName} photo={profilePhoto}/><span><b>My Profile</b><small>{account?.email||'Guest profile'} · {status}</small></span></div><button className="plain-icon" onClick={()=>setProfileOpen(false)}><X size={18}/></button></header><div className="profile-edit"><Avatar tone="violet" name={displayName} photo={profilePhoto}/><h3>{displayName||'Guest'}</h3><p>{account?.email||'Guest user'}</p><input ref={profileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>uploadProfilePhoto(e.target.files?.[0])}/><button className="outline-button" onClick={()=>profileInputRef.current?.click()}>Upload profile photo</button><label>Display name<input value={displayName} maxLength={40} onChange={e=>{setDisplayName(e.target.value);localStorage.setItem('proxispeak-name',e.target.value);}} onBlur={()=>socket?.emit('profile:name',{name:displayName})}/></label><p className="profile-hint">Profile photo is saved on the backend and shared with online teammates.</p></div></section></div>}
    {incomingCall && <div className="modal-backdrop"><section className="direct-modal incoming-call"><h2>Incoming {incomingCall.kind || 'audio'} call</h2><p>{incomingCall.fromName || 'Someone'} is calling you.</p><div className="direct-actions"><button onClick={() => { socket?.emit('call:respond',{targetSocketId:incomingCall.fromSocketId,accepted:true}); window.__proxiPendingCall={targetSocketId:incomingCall.fromSocketId,kind:incomingCall.kind,name:incomingCall.fromName}; setIncomingCall(null); setCallStatus('Connecting…'); }}>Accept</button><button onClick={() => { socket?.emit('call:respond',{targetSocketId:incomingCall.fromSocketId,accepted:false}); setIncomingCall(null); }}>Decline</button></div></section></div>}
    {activeCall && <div className="modal-backdrop"><section className="direct-modal active-call"><header><div><b>{activeCall.kind==='video'?'Video':'Audio'} call · {activeCall.name}</b><small>{callStatus || 'Connecting…'}</small></div><button className="plain-icon" onClick={() => endCall()}><PhoneOff size={18}/></button></header><div className="call-videos"><video ref={remoteVideoRef} autoPlay playsInline/><video ref={localVideoRef} autoPlay playsInline muted/></div><div className="direct-actions"><button onClick={() => { if(localStreamRef.current){ const track=localStreamRef.current.getAudioTracks()[0]; if(track) track.enabled=!track.enabled; } }}>Mute / unmute</button><button onClick={() => endCall()}>End call</button></div></section></div>}
    {toast && <div className="toast"><Check size={17}/>{toast}<button onClick={()=>setToast('')}><X size={14}/></button></div>}
  </div>;
}

export default App;
