import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../data'));
const fs = await import('node:fs/promises');
await fs.mkdir(dataDir, { recursive: true });
const dbPath = path.resolve(process.env.DB_PATH || path.join(dataDir, 'proxispeak.sqlite'));
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
    text TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'general', created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  CREATE TABLE IF NOT EXISTS direct_messages (id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, from_name TEXT NOT NULL, to_name TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_direct_messages_pair ON direct_messages(from_id, to_id, created_at);
  CREATE TABLE IF NOT EXISTS profiles (profile_id TEXT PRIMARY KEY, photo_data TEXT, updated_at TEXT NOT NULL);
`);
try { db.exec('ALTER TABLE users ADD COLUMN profile_photo TEXT'); } catch {}
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-secret-change-before-deployment';
const origins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim());
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: origins, methods: ['GET','POST'] } });
app.use(cors({ origin: origins })); app.use(express.json({ limit: '2mb' }));
const online = new Map(); // Live presence is intentionally in memory; only active sockets count.
const officeRoom = 'office-general';
const rowToMessage = r => ({ id:r.id, userId:r.user_id, name:r.name, text:r.text, channel:r.channel, at:r.created_at });
const listMessages = () => db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 100').all().reverse().map(rowToMessage);
const safeUser = u => ({ id:u.id, name:u.name, email:u.email, createdAt:u.created_at });
function createToken(u) { return jwt.sign({ sub:u.id, name:u.name, email:u.email }, JWT_SECRET, { expiresIn:'7d' }); }
function auth(req,res,next) { const token=(req.headers.authorization||'').replace(/^Bearer /,''); try { const payload=jwt.verify(token,JWT_SECRET); const u=db.prepare('SELECT * FROM users WHERE id=?').get(payload.sub); if(!u) return res.status(401).json({error:'Account not found.'}); req.user=u; next(); } catch { return res.status(401).json({error:'Please sign in again.'}); } }
app.get('/api/health', (_req,res)=>res.json({status:'ok',service:'ProxiSpeak API',database:'SQLite',databaseFile:path.basename(dbPath),online:online.size,timestamp:new Date().toISOString()}));
app.get('/api/people',(_req,res)=>res.json({people:[...online.values()].map(({id,name,status,location})=>({id,name,status,location}))}));
app.get('/api/messages',(_req,res)=>res.json({messages:listMessages()}));
app.post('/api/auth/register',async(req,res)=>{ const name=String(req.body?.name||'').trim().slice(0,40),email=String(req.body?.email||'').trim().toLowerCase(),password=String(req.body?.password||''); if(name.length<2)return res.status(400).json({error:'Name must be at least 2 characters.'}); if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Enter a valid email address.'}); if(password.length<8)return res.status(400).json({error:'Password must be at least 8 characters.'}); if(db.prepare('SELECT id FROM users WHERE email=?').get(email))return res.status(409).json({error:'An account with this email already exists.'}); const u={id:crypto.randomUUID(),name,email,password_hash:await bcrypt.hash(password,12),created_at:new Date().toISOString()}; db.prepare('INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)').run(u.id,u.name,u.email,u.password_hash,u.created_at); res.status(201).json({token:createToken(u),user:safeUser(u)}); });
app.post('/api/auth/login',async(req,res)=>{ const email=String(req.body?.email||'').trim().toLowerCase(),password=String(req.body?.password||''); const u=db.prepare('SELECT * FROM users WHERE email=?').get(email); if(!u||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).json({error:'Incorrect email or password.'}); res.json({token:createToken(u),user:safeUser(u)}); });
app.get('/api/auth/me',auth,(req,res)=>res.json({user:safeUser(req.user)}));
app.get('/',(_req,res)=>res.json({service:'ProxiSpeak backend',health:'/api/health'}));
function broadcastPeople(){io.emit('people:update',[...online.entries()].map(([socketId,p])=>({socketId,id:p.id,profileId:p.profileId,name:p.name,status:p.status,location:p.location,position:p.position,profilePhoto:p.profilePhoto,cameraOn:p.cameraOn||false,sharing:p.sharing||false,mediaStatus:p.mediaStatus||'disconnected'})));}
app.get('/api/profile/:id', (req,res)=>{ const row=db.prepare('SELECT photo_data,updated_at FROM profiles WHERE profile_id=?').get(String(req.params.id).slice(0,100)); res.json({photo:row?.photo_data||null,updatedAt:row?.updated_at||null}); });
io.on('connection',socket=>{
  const requestedName=String(socket.handshake.auth?.name||'Guest').trim().slice(0,40)||'Guest';
  // Anonymous by default. A supplied valid token is optional, never required for chatting/presence.
  let identity=null; const token=socket.handshake.auth?.token;
  if(token){try{const p=jwt.verify(token,JWT_SECRET);identity=db.prepare('SELECT * FROM users WHERE id=?').get(p.sub)||null;}catch{}}
  const profileId=String(socket.handshake.auth?.profileId||identity?.id||crypto.randomUUID()).slice(0,100);
  const savedProfile=db.prepare('SELECT photo_data FROM profiles WHERE profile_id=?').get(profileId);
  const person={id:identity?.id||profileId,profileId,profilePhoto:savedProfile?.photo_data||null,sessionId:socket.id,name:identity?.name||requestedName,status:'Online',location:'Office',position:{x:50,y:55},cameraOn:false,sharing:false,mediaStatus:'disconnected',connectedAt:new Date().toISOString()};
  online.set(socket.id, person); socket.join(officeRoom);
  socket.emit('chat:history',listMessages()); broadcastPeople();
  socket.broadcast.emit('system:notice',{text:`${person.name} joined the office.`,at:new Date().toISOString()});
  socket.on('chat:send',payload=>{const text=String(payload?.text||'').trim().slice(0,2000);if(!text)return;const message={id:crypto.randomUUID(),name:person.name,userId:person.id,text,channel:'general',at:new Date().toISOString()};db.prepare('INSERT INTO messages(id,user_id,name,text,channel,created_at) VALUES(?,?,?,?,?,?)').run(message.id,message.userId,message.name,message.text,message.channel,message.at);io.to(officeRoom).emit('chat:message',message);});
  socket.on('office:position',pos=>{const x=Number(pos?.x),y=Number(pos?.y);if(Number.isFinite(x)&&Number.isFinite(y)){person.position={x:Math.max(4,Math.min(96,x)),y:Math.max(8,Math.min(90,y))};online.set(socket.id,person);broadcastPeople();}});
  socket.on('direct:send',payload=>{const targetSocketId=String(payload?.targetSocketId||'');const text=String(payload?.text||'').trim().slice(0,2000);const target=online.get(targetSocketId);if(!target||!text)return;const msg={id:crypto.randomUUID(),fromId:person.id,toId:target.id,fromSocketId:socket.id,toSocketId:targetSocketId,fromName:person.name,toName:target.name,text,at:new Date().toISOString(),conversationKey:[socket.id,targetSocketId].sort().join(':')};db.prepare('INSERT INTO direct_messages(id,from_id,to_id,from_name,to_name,text,created_at) VALUES(?,?,?,?,?,?,?)').run(msg.id,msg.fromId,msg.toId,msg.fromName,msg.toName,msg.text,msg.at);io.to(targetSocketId).emit('direct:message',msg);socket.emit('direct:message',msg);});
  socket.on('profile:photo', payload=>{ const photo=String(payload?.photo||''); if(photo && (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(photo) || photo.length>1_500_000)) { socket.emit('profile:error',{message:'Use PNG, JPG, WEBP or GIF under 1 MB.'}); return; } const at=new Date().toISOString(); db.prepare('INSERT INTO profiles(profile_id,photo_data,updated_at) VALUES(?,?,?) ON CONFLICT(profile_id) DO UPDATE SET photo_data=excluded.photo_data,updated_at=excluded.updated_at').run(profileId,photo||null,at); person.profilePhoto=photo||null; online.set(socket.id,person); broadcastPeople(); socket.emit('profile:photo:saved',{photo:person.profilePhoto}); });
  socket.on('profile:name', payload=>{const name=String(payload?.name||'').trim().slice(0,40);if(name.length>=2){person.name=name;online.set(socket.id,person);broadcastPeople();}});
  socket.on('media:status', payload=>{ person.cameraOn=Boolean(payload?.cameraOn); person.sharing=Boolean(payload?.sharing); person.mediaStatus=String(payload?.mediaStatus||'connected'); online.set(socket.id,person); broadcastPeople(); });
  socket.on('media:signal', payload=>{ const targetSocketId=String(payload?.targetSocketId||''); if(!online.has(targetSocketId)) return; const targetSocket=io.sockets.sockets.get(targetSocketId); if(!targetSocket||!targetSocket.rooms.has(officeRoom)) return; if(!['offer','answer','ice','status'].includes(payload?.type)) return; io.to(targetSocketId).emit('media:signal',{fromSocketId:socket.id,type:payload.type,description:payload.description,candidate:payload.candidate,mediaKind:payload.mediaKind,videoKinds:payload.videoKinds}); });
  socket.on('proximity:ready', () => { socket.to(officeRoom).emit('proximity:ready'); });
  socket.on('proximity:stopped', () => { socket.to(officeRoom).emit('proximity:ready'); });
  socket.on('proximity:signal', payload => {
    const targetSocketId = String(payload?.targetSocketId || '');
    if (!online.has(targetSocketId)) return;
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket || !targetSocket.rooms.has(officeRoom)) return;
    const type = ['offer','answer','ice'].includes(payload?.type) ? payload.type : null;
    if (!type) return;
    io.to(targetSocketId).emit('proximity:signal', {
      fromSocketId: socket.id, type,
      ...(payload.description ? { description: payload.description } : {}),
      ...(payload.candidate ? { candidate: payload.candidate } : {})
    });
  });
  socket.on('call:request',payload=>{const targetSocketId=String(payload?.targetSocketId||'');if(!online.has(targetSocketId))return;io.to(targetSocketId).emit('call:incoming',{fromSocketId:socket.id,fromName:person.name,kind:payload?.kind==='video'?'video':'audio'});});
  socket.on('call:offer',payload=>{const targetSocketId=String(payload?.targetSocketId||'');if(online.has(targetSocketId))io.to(targetSocketId).emit('call:offer',{fromSocketId:socket.id,fromName:person.name,kind:payload?.kind==='video'?'video':'audio',offer:payload?.offer});});
  socket.on('call:answer',payload=>{const targetSocketId=String(payload?.targetSocketId||'');if(online.has(targetSocketId))io.to(targetSocketId).emit('call:answer',{answer:payload?.answer});});
  socket.on('call:ice',payload=>{const targetSocketId=String(payload?.targetSocketId||'');if(online.has(targetSocketId)&&payload?.candidate)io.to(targetSocketId).emit('call:ice',{candidate:payload.candidate});});
  socket.on('call:hangup',payload=>{const targetSocketId=String(payload?.targetSocketId||'');if(online.has(targetSocketId))io.to(targetSocketId).emit('call:hangup');});
  socket.on('call:respond',payload=>{const targetSocketId=String(payload?.targetSocketId||'');if(!online.has(targetSocketId))return;io.to(targetSocketId).emit('call:response',{accepted:Boolean(payload?.accepted)});});
  socket.on('presence:status',status=>{if(['Online','Away','Busy'].includes(status)){person.status=status;online.set(socket.id,person);broadcastPeople();}});
  socket.on('office:move',location=>{const place=String(location?.place||'').slice(0,60);if(place)person.location=place;online.set(socket.id,person);broadcastPeople();});
  socket.on('disconnect',()=>{online.delete(socket.id);broadcastPeople();socket.broadcast.emit('system:notice',{text:`${person.name} left the office.`,at:new Date().toISOString()});});
});
server.listen(PORT,()=>console.log(`ProxiSpeak API + Socket.IO at http://localhost:${PORT}; SQLite: ${dbPath}`));
