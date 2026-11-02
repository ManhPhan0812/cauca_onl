/* ============================================================
   Cầu nối TikTok LIVE -> sân khấu Hồ Câu live.html
   - Chạy máy chủ web + WebSocket chung cổng 21214 (mở http://localhost:21214)
   - Nhận sự kiện thật (vào phòng, chat, quà, tim, theo dõi) từ
     tiktok-live-connector rồi chuyển tiếp cho trang sân khấu.
   - Không cần đăng nhập/mật khẩu TikTok: chỉ cần tên @username đang live.
   Cách chạy:
     npm install
     node bridge.js ten_tiktok_cua_ban        (bỏ @ ở đầu)
     node bridge.js --demo                    (giả lập sự kiện để xem thử)
     node bridge.js --voice vi-VN-NamMinhNeural ten_tiktok   (đổi giọng đọc online sang giọng nam)
   Giọng đọc cảm ơn ONLINE (HoaiMy) chạy qua cầu nối này: mở sân khấu bằng
   địa chỉ http://localhost:21214 thì trang tự lấy tiếng mp3 từ /tts;
   mở file trực tiếp thì trang dùng giọng của trình duyệt.
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const args = process.argv.slice(2);
const demoFlag = args.includes('--demo');
const portIdx = args.indexOf('--port');
const PORT = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) : 21214;
const voiceIdx = args.indexOf('--voice');
// Bỏ qua giá trị đi kèm --port / --voice khi tìm username
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--port' && args[i - 1] !== '--voice');
const username = (positional[0] || process.env.TIKTOK_USERNAME || '').replace(/^@/, '');

/* --- Giọng đọc ONLINE (Microsoft Edge TTS — giọng HoaiMy, miễn phí, không cần key) ---
   Trang sân khấu gọi GET /tts?text=... -> nhận file mp3 đọc to.
   Đổi giọng nam: node bridge.js --voice vi-VN-NamMinhNeural <username>
   Nếu thư viện chưa cài hoặc mất mạng, cầu nối trả lỗi 502 và trang tự
   quay về giọng đọc sẵn có của trình duyệt. */
const VOICE = voiceIdx >= 0 ? args[voiceIdx + 1] : (process.env.EDGE_TTS_VOICE || 'vi-VN-HoaiMyNeural');
let EdgeTTS = null, EDGE_OUTPUT_FORMAT = null, ttsLoadErr = '';
try { const m = require('msedge-tts'); EdgeTTS = m.MsEdgeTTS; EDGE_OUTPUT_FORMAT = m.OUTPUT_FORMAT; }
catch (e) { ttsLoadErr = 'Chưa cài msedge-tts — hãy chạy npm install. Tạm thời trang sẽ dùng giọng của trình duyệt.'; }
let ttsChain = Promise.resolve();
const ttsCache = new Map();
function cleanTTSText(t) { return String(t || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300); }
async function synthOnce(text) {
  // Mỗi câu dùng một kết nối TTS riêng rồi đóng ngay: ổn định hơn hẳn dùng
  // lại một kết nối cho nhiều câu (bản thư viện 2.x hay đứt giữa chừng).
  let agent; const px = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  if (px) { try { const { HttpsProxyAgent } = require('https-proxy-agent'); agent = new HttpsProxyAgent(px); } catch (e) {} }
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const tts = new EdgeTTS(agent ? { agent } : undefined);
    try {
      await tts.setMetadata(VOICE, EDGE_OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text);
      const chunks = [];
      await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('Giọng online quá thời gian chờ')), 25000);
        audioStream.on('data', c => chunks.push(c));
        audioStream.on('end', () => { clearTimeout(to); resolve(); });
        audioStream.on('error', e => { clearTimeout(to); reject(e); });
      });
      const buf = Buffer.concat(chunks);
      if (!buf.length) throw new Error('Giọng online trả về rỗng');
      return buf;
    } catch (e) { lastErr = e; }
    finally { try { tts.close(); } catch (_) {} }
  }
  throw lastErr;
}
function synthTTS(text) { // nối đuôi nhau từng câu một + nhớ đệm để câu lặp lại khỏi gọi lại mạng
  const key = VOICE + '|' + text;
  if (ttsCache.has(key)) return Promise.resolve(ttsCache.get(key));
  const p = ttsChain.then(() => synthOnce(text));
  ttsChain = p.catch(() => {});
  return p.then(buf => { if (ttsCache.size > 60) ttsCache.delete(ttsCache.keys().next().value); ttsCache.set(key, buf); return buf; });
}
async function handleTTS(req, res) {
  if (!EdgeTTS) { res.writeHead(501, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Giọng online chưa sẵn sàng'); return; }
  let text = '';
  try { text = cleanTTSText(new URL(req.url, 'http://localhost').searchParams.get('text')); } catch (e) {}
  if (!text) { res.writeHead(400); res.end('Thiếu text'); return; }
  try {
    const buf = await synthTTS(text);
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
    res.end(buf);
    console.log('🔊 Đã đọc:', text.slice(0, 70));
  } catch (e) {
    console.error('Lỗi giọng online:', e && e.message ? e.message : e);
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Lỗi giọng đọc online');
  }
}

// --- Máy chủ web tĩnh: chỉ phục vụ live.html ---
const server = http.createServer((req, res) => {
  if ((req.url || '').startsWith('/tts')) { handleTTS(req, res); return; }
  const url = (req.url || '/').split('?')[0];
  if (url === '/' || url === '/live.html') {
    fs.readFile(path.join(__dirname, 'live.html'), (err, data) => {
      if (err) { res.writeHead(500); res.end('Chua tim thay live.html'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); // luôn lấy bản mới nhất, tránh trình duyệt dùng bản cũ trong bộ nhớ đệm
      res.end(data);
    });
  } else { res.writeHead(404); res.end('Not found'); }
});

// --- WebSocket: phát sự kiện cho mọi trang sân khấu đang mở ---
const wss = new WebSocketServer({ server });
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  let n = 0;
  wss.clients.forEach(c => { if (c.readyState === 1) { c.send(msg); n++; } });
  if (n) console.log('->', obj.type, obj.user ? '@' + obj.user.uniqueId : '', obj.text || obj.giftName || '');
}
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'status', ok: true, tts: EdgeTTS ? 'online' : 'off',
    text: username ? `Cầu nối sẵn sàng, đang nghe phòng @${username}` : 'Cầu nối đang chạy chế độ DEMO (sự kiện giả lập)' }));
});
server.listen(PORT, () => {
  console.log(`\n🎣 Sân khấu Hồ Câu live:  http://localhost:${PORT}`);
  if (EdgeTTS) console.log(`🔊 Giọng đọc online sẵn sàng: ${VOICE} — trang sân khấu sẽ tự dùng khi mở qua cầu nối`);
  else console.log('ℹ️ ' + ttsLoadErr);
  console.log(username ? `🎧 Đang kết nối phòng TikTok: @${username}` : '🧪 Chế độ DEMO: sự kiện giả lập (chạy "node bridge.js ten_tiktok" để nghe phòng thật)');
});

// --- Chuẩn hoá dữ liệu người dùng từ các bản thư viện khác nhau ---
function userOf(d) {
  const u = d.user || d;
  return { uniqueId: u.uniqueId || u.unique_id || '', nickname: u.nickname || u.displayId || u.uniqueId || '' };
}

// --- Kết nối TikTok LIVE thật ---
let streamEnded = false;
async function connectTikTok() {
  let lib;
  try { lib = await import('tiktok-live-connector'); }
  catch (e) { console.error('Chưa cài thư viện. Hãy chạy: npm install'); process.exit(1); }
  const Conn = lib.TikTokLiveConnection || lib.WebcastPushConnection || (lib.default && (lib.default.TikTokLiveConnection || lib.default.WebcastPushConnection));
  if (!Conn) { console.error('Không tìm thấy lớp kết nối trong thư viện tiktok-live-connector'); process.exit(1); }
  const conn = new Conn(username, { enableExtendedGiftInfo: true });
  const on = (name, fn) => { try { conn.on(name, fn); } catch (e) {} };

  on('connected', s => { console.log('✔ Đã vào phòng live, roomId =', s && s.roomId); broadcast({ type: 'status', ok: true, text: `Đã nối phòng @${username} ✔` }); });
  on('disconnected', () => { console.log('✖ Mất kết nối TikTok'); broadcast({ type: 'status', ok: false, text: 'Mất kết nối TikTok — cầu nối sẽ thử lại' });
    if (!streamEnded) setTimeout(() => connectTikTok().catch(() => {}), 10000); });
  on('streamEnd', () => { streamEnded = true; broadcast({ type: 'status', ok: false, text: 'Buổi live đã kết thúc' }); console.log('Buổi live đã kết thúc.'); });
  on('error', e => console.error('Lỗi kết nối:', e && e.message ? e.message : e));

  on('member', d => broadcast({ type: 'join', user: userOf(d) }));
  on('chat', d => broadcast({ type: 'chat', user: userOf(d), text: d.comment || '' }));
  on('gift', d => {
    if (d.repeatEnd === false) return; // quà chuỗi: chỉ tính khi dứt chuỗi để khỏi trùng
    const unit = (d.gift && (d.gift.diamondCount || d.gift.diamond_count)) || d.diamondCount || 1;
    const count = d.repeatCount || d.repeat_count || 1;
    broadcast({ type: 'gift', user: userOf(d),
      giftName: (d.gift && d.gift.name) || d.giftName || ('Quà ' + (d.giftId || '')),
      giftCount: count, diamonds: unit * count });
  });
  on('like', d => broadcast({ type: 'like', user: userOf(d), likes: d.likeCount || 1, totalLikes: d.totalLikeCount }));
  on('roomUser', d => broadcast({ type: 'viewers', viewers: d.viewerCount || 0 }));
  on('social', d => {
    const t = (d.displayType || d.display_type || '').toLowerCase();
    if (t.includes('follow')) broadcast({ type: 'follow', user: userOf(d) });
    else if (t.includes('share')) broadcast({ type: 'share', user: userOf(d) });
  });

  try { await conn.connect(); }
  catch (e) {
    console.error('Chưa kết nối được (phòng chưa live?):', e && e.message ? e.message : e);
    broadcast({ type: 'status', ok: false, text: 'Chưa vào được phòng — kiểm tra tên TikTok và chắc chắn đang LIVE, cầu nối thử lại sau 15 giây' });
    if (!streamEnded) setTimeout(() => connectTikTok().catch(() => {}), 15000);
  }
}

// --- Chế độ DEMO: giả lập người xem câu cá ngay trong cầu nối ---
function runDemo() {
  const names = ['Tuấn Anh Coca','ngọc lê926','Minh Anh','Thu Hằng','Văn Đức','Ngọc Trâm','Hoàng Nam','Diệu Hoa','Thanh Tùng','Mỹ Linh','Quốc Bảo','Hương Giang'];
  const smallChats = ['câu cá thôi cả nhà','phao động rồi kìa','cố lên giật đi','hồ nay nhiều cá khủng quá','cho mình xin 1 chỗ','cá to cá to'];
  const gifts = [{ n: 'Hoa hồng', d: 1 }, { n: 'Kem ốc quế', d: 1 }, { n: 'Trái tim tình yêu', d: 5 }, { n: 'Bánh donut', d: 30 }, { n: 'Vương miện', d: 100 }];
  const users = names.map(n => ({ uniqueId: 'demo_' + n.replace(/\s/g, ''), nickname: n }));
  let viewers = 48, likes = 0, joined = 0;
  setInterval(() => {
    const u = users[Math.floor(Math.random() * users.length)];
    const r = Math.random();
    if (r < 0.18 && joined < users.length) { broadcast({ type: 'join', user: users[joined] }); broadcast({ type: 'chat', user: users[joined], text: 'câu cá' }); joined++; }
    else if (r < 0.48) broadcast({ type: 'chat', user: u, text: Math.random() < 0.6 ? 'câu cá' : smallChats[Math.floor(Math.random() * smallChats.length)] });
    else if (r < 0.68) broadcast({ type: 'chat', user: u, text: 'giật' });
    else if (r < 0.86) { const c = 2 + Math.floor(Math.random() * 8); likes += c; broadcast({ type: 'like', user: u, likes: c, totalLikes: likes }); }
    else { const g = gifts[Math.floor(Math.random() * gifts.length)]; broadcast({ type: 'gift', user: u, giftName: g.n, giftCount: 1, diamonds: g.d }); }
    viewers = Math.max(25, viewers + Math.floor(Math.random() * 9) - 4);
    broadcast({ type: 'viewers', viewers });
  }, 2000);
}

if (username && !demoFlag) connectTikTok().catch(e => console.error(e));
else runDemo();
