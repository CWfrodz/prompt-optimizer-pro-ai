# Як зробити з цього коду `.exe` програму для Windows (Electron)

Оскільки цей код зараз працює у хмарному Next.js середовищі (як веб-додаток), щоб зробити його повноцінною डेस्कтопною програмою у треї, вам потрібно скористатися інструментом **Electron**.

Ось покрокова інструкція, як це зробити на вашому ПК за 10 хвилин:

## Що змінилося: Які файли копіювати?
Щоб не завантажувати всі файли заново, перенесіть до вашого проекту на ПК **тільки ці 4 оновлені файли**:
1. `app/page.tsx`
2. `lib/storage.ts`
3. `main.js`
4. `preload.js` (Потрібно створити цей новий файл поруч із main.js)

*(Всі нові функції контексту та налаштувань знаходяться в них. Для глобального контексту я додав вкладку "Пам'ять / Контекст" в налаштуваннях — туди ви пишете хто ви, з чим працюєте та в якому стилі відповідати, і це буде застосовуватись до кожного промпту).*

---

## Важливо: Підготовка до компіляції (.exe)

Оскільки для `.exe` екрану ми використовуємо статичний файл, нам потрібно відключити серверні API Next.js, які не потрібні в локальному Electron-додатку (адже Electron і так не блокується CORS).

1. **Видаліть папку** `app/api/` (повністю). Вона була потрібна лише для сайту.
2. Відкрийте файл `next.config.ts` та змініть значення `output`:
   Змініть `output: 'standalone'` на **`output: 'export'`**.
3. Це дозволить команді `next build` згенерувати готову статичну папку `out/`, яку ми запакуємо в `.exe`.

## Правильний `main.js` (Виправлено помилку "serve is not a function")
Відредагуйте ваш `main.js`, щоб він виглядав **точно так**. Цей код має вбудований міні-сервер, щоб статика Next.js ідеально працювала в `.exe` без зовнішніх бібліотек.

```javascript
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
    // Якщо порт щоразу випадковий, LocalStorage буде порожнім при кожному запуску.
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
  const trayPos = tray.getBounds();
  const windowPos = window.getBounds();
  
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
  
  // Клік по іконці відкриває/ховає вікно
  tray.on('click', () => {
    toggleWindow();
  });

  // Глобальний шоткарт (щоб відкривати вікно клавіатурою)
  globalShortcut.register('CommandOrControl+Alt+P', () => {
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

## Крок 4. Компіляція
Після цього знову виконайте команду:
```bash
npm run build:electron
```

Тепер `next build` створить надійну статичну копію в папці `out`, а Electron запакує її. Всередині `.exe` код підніме свій мікро-сервер і рендеритиме інтерфейс без жодних білих екранів чи помилок "serve is not a function".

---

### Щодо системи пам'яті
Дані тепер зберігаються **максимально надійно** на рівні операційної системи Windows, незалежно від кешу чи LocalStorage.

Файл збереження (всі налаштування, моделі і пам'ять) зберігається в офіційній папці для налаштувань вашої ОС:
`C:\Users\<Ваше_Ім'я_Користувача>\AppData\Roaming\prompt-optimizer\prompt-optimizer-db.json`

*(Папка AppData є прихованою в Windows, тому щоб туди потрапити, натисніть `Win + R`, введіть `%APPDATA%\prompt-optimizer` та натисніть Enter).*

У вкладці **"Пам'ять / Контекст"** ви зберігаєте лише той текст, який ви самі туди впишете. 
Наприклад, ви можете вписати туди:
> "Я досвідчений розробник на React. Пиши дуже коротко, тільки код, без пояснень."

Програма автоматично буде "підклеювати" цей контекст до системного промпту коли оптимізує ваші запити. Тобто модель завжди пам'ятатиме "хто ви і чого хочете".
