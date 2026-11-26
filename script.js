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

/* ---------- Настройки путей ---------- */
const ASSETS_PATH = 'assets/';
const MTL_FILE = 'kirby.mtl';
const OBJ_FILE = 'kirby.obj';
const TEXTURES_DIR = 'textures/';

/* =========================================================
   1. 3D-ПРОСМОТРЩИК
   ========================================================= */

const viewerEl = document.getElementById('viewer');
const loaderEl = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const errorEl = document.getElementById('viewer-error');
const btnRotate = document.getElementById('btn-rotate');
const btnReset = document.getElementById('btn-reset');

let is3DActive = true;
let isInView = true;

// --- Рендерер ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
viewerEl.appendChild(renderer.domElement);

// --- Сцена и камера ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.position.set(0, 0.4, 5);

// --- Освещение ---
scene.add(new THREE.HemisphereLight(0xffffff, 0xffc2da, 1.6));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xffd6e6, 0.9);
rimLight.position.set(-4, 2, -3);
scene.add(rimLight);

// --- Управление ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.6;
controls.minDistance = 1.5;
controls.maxDistance = 12;

// --- Тень ---
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

const modelPivot = new THREE.Group();
scene.add(modelPivot);

/* ---------- LoadingManager ---------- */
const manager = new THREE.LoadingManager();

manager.onError = (url) => {
  if (/\.(png|jpe?g|tga|bmp|webp)$/i.test(url)) {
    console.error(
      `[Kirby] ❌ Текстура не загрузилась: ${url}\n` +
      `Проверьте: 1) файл реально лежит по этому пути; 2) регистр букв совпадает; ` +
      `3) путь в .mtl относительный, например "map_Kd ${TEXTURES_DIR}kirby_diffuse.png".`
    );
  } else {
    console.error(`[Kirby] ❌ Не удалось загрузить файл: ${url}`);
  }
};

manager.setURLModifier((url) => {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (!/\.(png|jpe?g|tga|bmp|webp)$/i.test(url)) return url;
  const looksBroken =
    url.includes('\\') ||
    /[a-zA-Z]:[\\/]/.test(url) ||
    url.includes(ASSETS_PATH + '/') ||
    url.includes('../');
  if (!looksBroken) return url;
  const fileName = url.split(/[\\/]/).pop();
  const fixed = ASSETS_PATH + TEXTURES_DIR + fileName;
  console.warn(`[Kirby] ⚠️ Некорректный путь к текстуре: "${url}" → "${fixed}". Исправьте путь в ${MTL_FILE}.`);
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

/* ---------- Центровка модели ---------- */
function fitModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2 / maxDim;
  object.scale.setScalar(scale);
  object.position.copy(center).multiplyScalar(-scale);
  shadow.position.y = -(size.y * scale) / 2 - 0.01;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (1.25 / Math.tan(fov / 2)) * 1.1;
  camera.position.set(0, 0.35, distance);
  controls.target.set(0, 0, 0);
  controls.update();
  controls.saveState();
}

/* ---------- Материалы ---------- */
function prepareMaterials(object) {
  const report = [];
  object.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      [mat.map, mat.normalMap, mat.bumpMap].forEach((t) => {
        if (t) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      });
      mat.needsUpdate = true;
      report.push({
        меш: child.name || '(без имени)',
        материал: mat.name,
        текстура: mat.map ? 'есть ✅' : 'нет ❌'
      });
    });
  });
  console.groupCollapsed('[Kirby] Материалы модели');
  console.table(report);
  console.groupEnd();
  if (report.length && report.every((r) => r['текстура'] !== 'есть ✅')) {
    console.warn('[Kirby] ⚠️ Ни у одного материала нет diffuse-текстуры. Проверьте map_Kd в .mtl.');
  }
}

/* ---------- Загрузка OBJ ---------- */
function loadOBJ(materials) {
  const objLoader = new OBJLoader(manager);
  if (materials) objLoader.setMaterials(materials);
  objLoader.setPath(ASSETS_PATH);
  objLoader.load(
    OBJ_FILE,
    (object) => {
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

/* ---------- Загрузка MTL ---------- */
function loadModel() {
  if (location.protocol === 'file:') {
    console.warn('[Kirby] ⚠️ Сайт открыт как file://. Запустите локальный сервер.');
  }
  const mtlLoader = new MTLLoader(manager);
  mtlLoader.setPath(ASSETS_PATH);
  mtlLoader.setResourcePath(ASSETS_PATH);
  mtlLoader.load(
    MTL_FILE,
    (materials) => {
      materials.preload();
      const info = Object.entries(materials.materialsInfo).map(([name, m]) => ({
        материал: name,
        map_Kd: m.map_kd || '—',
        map_Bump: m.map_bump || m.bump || '—',
        norm: m.norm || '—'
      }));
      console.groupCollapsed('[Kirby] Текстуры из .mtl');
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

/* ---------- Размер холста ---------- */
function resize() {
  const { clientWidth: w, clientHeight: h } = viewerEl;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(viewerEl);

/* ---------- Цикл отрисовки ---------- */
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  if (!is3DActive || !isInView) return;
  const t = clock.getElapsedTime();
  modelPivot.position.y = Math.sin(t * 1.6) * 0.06;
  shadow.scale.setScalar(1 - Math.sin(t * 1.6) * 0.06);
  controls.update();
  renderer.render(scene, camera);
});

new IntersectionObserver(([entry]) => { isInView = entry.isIntersecting; })
  .observe(document.querySelector('.stage'));

btnRotate.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  btnRotate.setAttribute('aria-pressed', String(controls.autoRotate));
});

btnReset.addEventListener('click', () => controls.reset());

loadModel();

/* =========================================================
   2. ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ
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
    const video = panel.querySelector('video');
    if (video) {
      if (active) video.play().catch(() => {});
      else video.pause();
    }
  });
  is3DActive = mode === 'model';
  if (is3DActive) requestAnimationFrame(resize);
}

switchButtons.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

document.querySelectorAll('.panel video').forEach((video) => {
  video.addEventListener('error', () => {
    console.error(`[Kirby] ❌ Видео не загрузилось: ${video.currentSrc || video.getAttribute('src')}`);
    video.hidden = true;
    const msg = video.parentElement.querySelector('.video-error');
    if (msg) msg.hidden = false;
  });
});

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

/* =========================================================
ГАЛЕРЕЯ ВИДОВ ОТОБРАЖЕНИЯ В BLENDER
========================================================= */
.gallery {
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 22px;
margin-top: 10px;
}
.gallery-item {
margin: 0;
background: var(--white);
border-radius: var(--radius-lg);
overflow: hidden;
box-shadow: var(--shadow);
transition: transform 0.35s cubic-bezier(.2,.8,.2,1.2), box-shadow 0.35s;
position: relative;
}
.gallery-item::before {
content: '';
position: absolute;
inset: 0;
border-radius: var(--radius-lg);
border: 3px solid transparent;
transition: border-color 0.3s;
pointer-events: none;
z-index: 2;
}
.gallery-item:hover {
transform: translateY(-8px) scale(1.02);
box-shadow: var(--shadow-strong);
}
.gallery-item:hover::before {
border-color: var(--pink);
}
.gallery-frame {
aspect-ratio: 4 / 3;
overflow: hidden;
background: linear-gradient(135deg, var(--pink-pale) 0%, var(--pink-light) 100%);
position: relative;
}
.gallery-frame::after {
content: '🔍';
position: absolute;
top: 50%;
left: 50%;
transform: translate(-50%, -50%) scale(0.5);
font-size: 2.5rem;
opacity: 0;
transition: opacity 0.3s, transform 0.3s;
pointer-events: none;
z-index: 3;
}
.gallery-frame img {
width: 100%;
height: 100%;
object-fit: cover;
transition: transform 0.5s cubic-bezier(.2,.8,.2,1.2);
display: block;
}
.gallery-item:hover .gallery-frame img {
transform: scale(1.08);
}
.gallery-item:hover .gallery-frame::after {
opacity: 0.85;
transform: translate(-50%, -50%) scale(1);
}
.gallery-item figcaption {
padding: 16px 20px;
font-size: 1rem;
font-weight: 800;
color: var(--pink-dark);
text-align: center;
background: var(--white);
border-top: 2px dashed var(--pink-light);
letter-spacing: 0.02em;
}
.gallery-item figcaption small {
display: block;
margin-top: 4px;
font-size: 0.82rem;
font-weight: 600;
color: var(--text-soft);
text-transform: none;
letter-spacing: 0;
}
/* ---------- Адаптив галереи ---------- */
@media (max-width: 860px) {
.gallery { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 600px) {
.gallery { grid-template-columns: 1fr; gap: 16px; }
.gallery-frame { aspect-ratio: 16 / 10; }
}
