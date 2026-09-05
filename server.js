// ==========================================
// 마음 돋보기 (Mind Lens) - 초경량 웹 서버
// ==========================================
// 외부 의존성(npm install) 없이 Node.js 내장 모듈만으로 즉시 실행 가능합니다.
// 실행 방법: node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0].split('#')[0];

  // URL 라우팅 별칭 매핑
  if (reqPath === '/' || reqPath === '/client') {
    reqPath = '/app.html';
  } else if (reqPath === '/admin') {
    reqPath = '/admin.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found - 마음 돋보기 파일을 찾을 수 없습니다.');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  const localIp = getLocalIp();
  console.log('====================================================');
  console.log('🌻 마음 돋보기 (Mind Lens) 웹 서버가 가동되었습니다!');
  console.log('====================================================');
  console.log(`- 🖥️  내담자 접속 주소 (로컬)   : http://localhost:${PORT}/`);
  console.log(`- 📱 내담자 모바일 접속 주소     : http://${localIp}:${PORT}/`);
  console.log(`- 🎓 상담자 콘솔 접속 주소       : http://localhost:${PORT}/admin`);
  console.log('====================================================');
});
