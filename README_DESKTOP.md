# Як зробити з цього коду `.exe` програму для Windows (Electron)

Оскільки цей код зараз працює у хмарному Next.js середовищі (як веб-додаток), щоб зробити його повноцінною डेस्कтопною програмою у треї, вам потрібно скористатися інструментом **Electron**.

Ось покрокова інструкція, як це зробити на вашому ПК за 10 хвилин:

## Крок 1. Завантажте цей проект
1. В інтерфейсі AI Studio натисніть на меню проекту і виберіть **"Export as ZIP"** (Експортувати як ZIP).
2. Розархівуйте ZIP-файл у зручну папку на вашому комп'ютері.

## Крок 2. Встановіть середовище Node.js
Якщо у вас ще не встановлено **Node.js**, завантажте та встановіть його з офіційного сайту: [https://nodejs.org/](https://nodejs.org/)

## Крок 3. Додайте Electron до проекту
Відкрийте командний рядок (Terminal / PowerShell), перейдіть у папку з розархівованим проектом та виконайте:

```bash
npm install
npm install --save-dev electron electron-builder wait-on concurrently
```

## Крок 4. Створіть файл запуску `main.js`
Створіть в корені проекту новий файл з назвою `main.js` і вставте в нього цей код:

```javascript
const { app, BrowserWindow, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');

let tray = null;
let window = null;
let isQuitting = false;

function createWindow() {
  window = new BrowserWindow({
    width: 450,
    height: 320, // Зменшена висота для компактності
    show: false, // Не показувати відразу
    frame: false, // Вікно без стандартних рамок 
    resizable: true, // Дозволяємо зміну розміру якщо потрібно
    alwaysOnTop: true, // Поверх інших вікон
    skipTaskbar: true, // Сховати з панелі задач (бо це трей-програма)
    webPreferences: {
      nodeIntegration: true,
    },
  });

  // Завантажуємо локальний сервер Next.js
  window.loadURL('http://localhost:3000');

  // Замість того, щоб вбивати програму, перехоплюємо закриття і просто ховаємо її в трей
  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault(); // Зупиняємо закриття
      window.hide(); // Ховаємо вікно
    }
  });
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

  // Жорстко задаємо розмір, щоб вікно не зменшувалось самостійно при зміні позиції
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

## Крок 5. Налаштуйте команди запуску (`package.json`)
Відкрийте файл `package.json` і в секцію `"scripts"` додайте:

```json
  "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron .\"",
  "build:electron": "next build && electron-builder"
```

Також, в корінь об'єкта `package.json` (окремо від scripts) додайте поле `main` і `build`:
```json
  "main": "main.js",
  "build": {
    "appId": "com.prompt.optimizer",
    "win": {
      "target": "nsis"
    }
  }
```

## Крок 6. Запустіть або скомпілюйте!
Щоб просто перевірити як воно працює в Electron (для дебагу), введіть у консолі:
```bash
npm run electron:dev
```

Щоб згенерувати повноцінний файл **.exe**, вимкніть сервер та запустіть команду:
```bash
npm run build:electron
```
Після успішного виконання в директорії `dist/` на вашому ПК з'явиться готовий `.exe` інсталятор.

---

### Щодо збереження даних
У Electron (на ПК) `LocalStorage` прив'язаний до вашої встановленої програми (до її внутрішнього профілю у `%APPDATA%`), він працює так само як в браузері, але надійно ізольований та не стирається при очищенні історії браузера. Це робить його цілком безпечним та надійним для такого невеликого локального додатку.

Якщо в майбутньому знадобиться обробляти гігабайти тексту або експортувати історію, ви можете замінити `LocalStorage` на бібліотеку `electron-store`, яка зберігатиме все у звичайному `config.json` файлі на ПК.
