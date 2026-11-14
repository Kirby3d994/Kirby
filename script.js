/* =========================================================
   KIRBY — логика сайта
   1) Интерактивная 3D-модель (Three.js + MTLLoader + OBJLoader + OrbitControls)
   2) Переключатель режимов: 3D / Видео №1 / Видео №2
   3) Мобильное меню и анимации появления при скролле
   ========================================================= */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

/* ---------- Настройки путей (поменяйте, если назвали файлы иначе) ---------- */
const ASSETS_PATH = 'assets/';          // папка с моделью (относительно index.html)
const MTL_FILE = 'kirby.mtl';           // файл материалов
const OBJ_FILE = 'kirby.obj';           // файл модели
const TEXTURES_DIR = 'textures/';       // подпапка с текстурами внутри assets/

/* =========================================================
   1. 3D-ПРОСМОТРЩИК
   ========================================================= */
const viewerEl = document.getElementById('viewer');
const loaderEl = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const errorEl = document.getElementById('viewer-error');
const btnRotate = document.getElementById('btn-rotate');
const btnReset = document.getElementById('btn-reset');

let is3DActive = true;   // активна ли вкладка «3D-модель»
let isInView = true;     // виден ли hero-блок на экране (экономим ресурсы)

// --- Рендерер ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace; // корректные цвета текстур
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
viewerEl.appendChild(renderer.domElement);

// --- Сцена и камера ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.position.set(0, 0.4, 5);

// --- Освещение: мягкое, «мультяшное» ---
scene.add(new THREE.HemisphereLight(0xffffff, 0xffc2da, 1.6));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xffd6e6, 0.9);
rimLight.position.set(-4, 2, -3);
scene.add(rimLight);

// --- Управление мышью / пальцем ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;     // плавная инерция
controls.dampingFactor = 0.08;
controls.enablePan = false;        // не даём «уронить» модель за край
controls.autoRotate = true;
controls.autoRotateSpeed = 1.6;
controls.minDistance = 1.5;
controls.maxDistance = 12;

// --- Мягкая круглая тень под моделью (текстура рисуется на canvas) ---
function createShadow() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(232, 93, 147, 0.45)');
  grad.addColorStop(1, 'rgba(232, 93, 147, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
const shadow = createShadow();
scene.add(shadow);

// Контейнер для модели (нужен, чтобы покачивать модель, не ломая центровку)
const modelPivot = new THREE.Group();
scene.add(modelPivot);

/* ---------- LoadingManager: прогресс и ошибки загрузки ---------- */
const manager = new THREE.LoadingManager();

// Ошибка любого файла (в т.ч. текстуры из .mtl) — пишем понятное сообщение в консоль
manager.onError = (url) => {
  if (/\.(png|jpe?g|tga|bmp|webp)$/i.test(url)) {
    console.error(
      `[Kirby] ❌ Текстура не загрузилась: ${url}\n` +
      `Проверьте: 1) файл реально лежит по этому пути; 2) регистр букв в имени совпадает ` +
      `(GitHub Pages различает Kirby.png и kirby.png); 3) путь в .mtl относительный, ` +
      `например "map_Kd ${TEXTURES_DIR}kirby_diffuse.png".`
    );
  } else {
    console.error(`[Kirby] ❌ Не удалось загрузить файл: ${url}`);
  }
};

/*
  Страховка от «плохих» путей в .mtl.
  Blender и другие редакторы часто пишут абсолютные пути вроде
  C:\Users\Имя\Desktop\kirby_diffuse.png — в браузере они не работают.
  Здесь мы перехватываем такие URL и перенаправляем их в assets/textures/<имя файла>.
  Правильнее всё же исправить сам .mtl (см. инструкцию в README).
*/
manager.setURLModifier((url) => {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (!/\.(png|jpe?g|tga|bmp|webp)$/i.test(url)) return url;

  const looksBroken =
    url.includes('\\') ||                 // обратные слэши Windows
    /[a-zA-Z]:[\\/]/.test(url) ||         // буква диска: C:\ или C:/
    url.includes(ASSETS_PATH + '/') ||    // абсолютный путь вида /home/...
    url.includes('../');                  // выход за пределы папки assets

  if (!looksBroken) return url;

  const fileName = url.split(/[\\/]/).pop();
  const fixed = ASSETS_PATH + TEXTURES_DIR + fileName;
  console.warn(`[Kirby] ⚠️ Некорректный путь к текстуре в .mtl: "${url}" → пробуем "${fixed}". Исправьте путь в ${MTL_FILE}.`);
  return fixed;
});

function setProgress(percent) {
  loaderText.textContent = `Загружаем Кирби… ${Math.round(percent)}%`;
}

function showError(message) {
  console.error('[Kirby]', message);
  loaderEl.classList.add('hidden');
  errorEl.hidden = false;
}

/* ---------- Центровка и масштаб модели ---------- */
function fitModel(object) {
  // Вычисляем габариты модели и ставим её центр в начало координат
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  const scale = 2 / maxDim;               // приводим к размеру ~2 единицы
  object.scale.setScalar(scale);
  object.position.copy(center).multiplyScalar(-scale);

  // Тень — ровно под «ногами»
  shadow.position.y = -(size.y * scale) / 2 - 0.01;

  // Отодвигаем камеру так, чтобы модель целиком влезала в кадр
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (1.25 / Math.tan(fov / 2)) * 1.1;
  camera.position.set(0, 0.35, distance);
  controls.target.set(0, 0, 0);
  controls.update();
  controls.saveState(); // запоминаем позицию для кнопки «Сброс»
}

/* ---------- Пост-обработка материалов ---------- */
function prepareMaterials(object) {
  const report = [];
  object.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      // Цветовые текстуры должны быть в sRGB, иначе модель будет «выцветшей»
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      // Повышаем качество текстур под углом
      [mat.map, mat.normalMap, mat.bumpMap].forEach((t) => {
        if (t) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      });
      mat.needsUpdate = true;
      report.push({ меш: child.name || '(без имени)', материал: mat.name, текстура: mat.map ? 'есть ✅' : 'нет ❌' });
    });
  });
  console.groupCollapsed('[Kirby] Материалы модели');
  console.table(report);
  console.groupEnd();
  if (report.length && report.every((r) => r['текстура'] !== 'есть ✅')) {
    console.warn('[Kirby] ⚠️ Ни у одного материала нет diffuse-текстуры. Проверьте строку map_Kd в .mtl.');
  }
}

/* ---------- Загрузка OBJ (с материалами или без) ---------- */
function loadOBJ(materials) {
  const objLoader = new OBJLoader(manager);
  if (materials) objLoader.setMaterials(materials); // КЛЮЧЕВОЙ шаг: связываем OBJ и MTL
  objLoader.setPath(ASSETS_PATH);

  objLoader.load(
    OBJ_FILE,
    (object) => {
      // Если .mtl не загрузился — красим Кирби в розовый, чтобы он не был белым
      if (!materials) {
        const fallback = new THREE.MeshStandardMaterial({ color: 0xff9ec4, roughness: 0.6 });
        object.traverse((c) => { if (c.isMesh) c.material = fallback; });
      }
      prepareMaterials(object);
      fitModel(object);
      modelPivot.add(object);
      loaderEl.classList.add('hidden');
      console.info('[Kirby] ✅ Модель загружена');
    },
    (xhr) => {
      if (xhr.lengthComputable) setProgress(30 + (xhr.loaded / xhr.total) * 70);
    },
    (err) => showError(`Не удалось загрузить ${ASSETS_PATH}${OBJ_FILE}: ${err?.message || err}`)
  );
}

/* ---------- Сначала MTL, потом OBJ ---------- */
function loadModel() {
  if (location.protocol === 'file:') {
    console.warn('[Kirby] ⚠️ Сайт открыт как file://. Браузер блокирует загрузку модели. Запустите локальный сервер (см. README).');
  }

  const mtlLoader = new MTLLoader(manager);
  mtlLoader.setPath(ASSETS_PATH);          // где лежит сам .mtl
  mtlLoader.setResourcePath(ASSETS_PATH);  // относительно чего искать текстуры из .mtl

  mtlLoader.load(
    MTL_FILE,
    (materials) => {
      materials.preload(); // создаёт материалы и запускает загрузку текстур

      // Выводим в консоль, какие текстуры прописаны в .mtl
      const info = Object.entries(materials.materialsInfo).map(([name, m]) => ({
        материал: name,
        map_Kd: m.map_kd || '—',
        map_Bump: m.map_bump || m.bump || '—',
        norm: m.norm || '—',
      }));
      console.groupCollapsed('[Kirby] Текстуры, прописанные в .mtl');
      console.table(info);
      console.groupEnd();

      setProgress(30);
      loadOBJ(materials);
    },
    undefined,
    (err) => {
      console.error(`[Kirby] ❌ Не удалось загрузить ${ASSETS_PATH}${MTL_FILE} — модель будет без текстур.`, err);
      loadOBJ(null);
    }
  );
}

/* ---------- Размер холста под контейнер ---------- */
function resize() {
  const { clientWidth: w, clientHeight: h } = viewerEl;
  if (!w || !h) return; // панель скрыта — пропускаем
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewerEl);

/* ---------- Цикл отрисовки ---------- */
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  if (!is3DActive || !isInView) return; // не тратим батарею, когда 3D не видно
  const t = clock.getElapsedTime();
  modelPivot.position.y = Math.sin(t * 1.6) * 0.06; // лёгкое «парение»
  shadow.scale.setScalar(1 - Math.sin(t * 1.6) * 0.06);
  controls.update();
  renderer.render(scene, camera);
});

// Ставим рендер на паузу, когда hero-блок уходит за пределы экрана
new IntersectionObserver(([entry]) => { isInView = entry.isIntersecting; })
  .observe(document.querySelector('.stage'));

// Кнопки управления 3D
btnRotate.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  btnRotate.setAttribute('aria-pressed', String(controls.autoRotate));
});
btnReset.addEventListener('click', () => controls.reset());

loadModel();

/* =========================================================
   2. ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ (3D / Видео №1 / Видео №2)
   ========================================================= */
const switchButtons = document.querySelectorAll('.switch-btn');
const panels = document.querySelectorAll('.panel');

function setMode(mode) {
  switchButtons.forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  panels.forEach((panel) => {
    const active = panel.dataset.panel === mode;
    panel.hidden = !active;
    panel.classList.toggle('active', active);

    // Видео: играем только видимое, остальные ставим на паузу
    const video = panel.querySelector('video');
    if (video) {
      if (active) video.play().catch(() => { /* автозапуск может быть заблокирован — не страшно */ });
      else video.pause();
    }
  });

  is3DActive = mode === 'model';
  if (is3DActive) requestAnimationFrame(resize); // панель снова видна — пересчитываем размер
}

switchButtons.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

// Если видеофайл не найден — показываем подсказку вместо чёрного прямоугольника
document.querySelectorAll('.panel video').forEach((video) => {
  video.addEventListener('error', () => {
    console.error(`[Kirby] ❌ Видео не загрузилось: ${video.currentSrc || video.getAttribute('src')}`);
    video.hidden = true;
    const msg = video.parentElement.querySelector('.video-error');
    if (msg) msg.hidden = false;
  });
});

// Изначально видео скрыты — ставим их на паузу
setMode('model');

/* =========================================================
   3. МОБИЛЬНОЕ МЕНЮ
   ========================================================= */
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

burger.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
});
nav.querySelectorAll('a').forEach((link) =>
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  })
);

/* =========================================================
   4. ПОЯВЛЕНИЕ БЛОКОВ ПРИ СКРОЛЛЕ
   ========================================================= */
const revealEls = document.querySelectorAll('.reveal');

// Небольшая задержка для соседних карточек — эффект «волны»
revealEls.forEach((el) => {
  const siblings = Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal'));
  const index = siblings.indexOf(el);
  el.style.transitionDelay = `${Math.min(index, 6) * 80}ms`;
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
);
revealEls.forEach((el) => revealObserver.observe(el));
