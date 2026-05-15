const { app, BrowserWindow, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let tray = null;
let window = null;
let isQuitting = false;

// Вбудований локальний сервер для Next.js статики (папка out) - працює в .exe
function serveNextStatic() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];
      let filePath = path.join(__dirname, 'out', urlPath === '/' ? 'index.html' : urlPath);
      
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'out', urlPath + '.html');
      }
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'out', 'index.html');
      }
      
      const extname = path.extname(filePath);
      let contentType = 'text/html';
      if (extname === '.js') contentType = 'text/javascript';
      else if (extname === '.css') contentType = 'text/css';
      else if (extname === '.json') contentType = 'application/json';
      
      fs.readFile(filePath, (err, content) => {
        if (!err) {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        } else {
          res.writeHead(404);
          res.end();
        }
      });
    });
    // ВАЖЛИВО: Використовуємо фіксований порт. 
    // Якщо порт щоразу випадковий, LocalStorage буде порожнім при кожному запуску, оскільки він прив'язаний до порту.
    let port = 37129;
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        port++;
        setTimeout(() => {
          server.listen(port, '127.0.0.1');
        }, 100);
      }
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function createWindow() {
  window = new BrowserWindow({
    width: 450,
    height: 320, // Зменшена висота для компактності
    show: false, 
    frame: false, 
    resizable: true, 
    alwaysOnTop: true, // Поверх інших вікон
    skipTaskbar: true, // Сховати з панелі задач (бо це трей-програма)
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // ВАЖЛИВО! Відключає CORS для запитів до локальних LLM
    },
  });

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault(); // Зупиняємо закриття
      window.hide(); // Ховаємо вікно
    }
  });

  // Перевіряємо чи додаток скомпільований чи ні
  const isDev = !app.isPackaged;

  if (isDev) {
    // В режимі npm run electron:dev підключаємось до Next.js сервера (який на 3000 порту)
    window.loadURL('http://localhost:3000');
  } else {
    // В скомпільованому .exe піднімаємо свій сервер і роздаємо папку out/
    const localUrl = await serveNextStatic();
    window.loadURL(localUrl);
  }
}

const toggleWindow = () => {
  if (window.isVisible()) {
    window.hide();
  } else {
    showWindow();
  }
};

const showWindow = () => {
  const windowPos = window.getBounds();
  const trayPos = tray.getBounds();
  
  let x = Math.round(trayPos.x + (trayPos.width / 2) - (windowPos.width / 2));
  let y = Math.round(trayPos.y - windowPos.height - 10);

  // Жорстко задаємо розмір
  window.setBounds({ x: x, y: y, width: 450, height: 320 });
  window.show();
  window.focus();
};

app.whenReady().then(() => {
  createWindow();

  // Використовуємо вашу іконку з папки public
  tray = new Tray(path.join(__dirname, 'public/favicon.ico'));

  tray.setToolTip('Prompt Optimizer Pro');
  
  tray.on('click', () => {
    toggleWindow();
  });

  // Меню по правому кліку
  tray.on('right-click', () => {
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Вихід', 
        click: () => {
          isQuitting = true; // Дозволяємо вікну закритися повністю
          app.quit();
        } 
      }
    ]);
    tray.popUpContextMenu(contextMenu);
  });

  // Глобальний хоткей (наприклад, Ctrl+Space)
  globalShortcut.register('CommandOrControl+Space', () => {
    toggleWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
