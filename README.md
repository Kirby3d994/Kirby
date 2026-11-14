KIRBY — 3D-презентация

Одностраничный сайт про Кирби: интерактивная 3D-модель с текстурами (Three.js), две анимации и полная информация о персонаже.



Структура

/

├── index.html

├── style.css

├── script.js

├── .nojekyll

└── assets/

&#x20;   ├── kirby.obj

&#x20;   ├── kirby.mtl

&#x20;   ├── textures/

&#x20;   │   ├── kirby\_diffuse.png

&#x20;   │   └── ...

&#x20;   ├── kirby\_loop.mp4

&#x20;   └── kirby\_camera.mp4

CDN (Three.js r160, подключено через import map в index.html)

three: https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js

OrbitControls: https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js

OBJLoader: https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js

MTLLoader: https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/MTLLoader.js

Локальная проверка

Модель нельзя загрузить, открыв index.html двойным кликом (file://). Запустите сервер в папке проекта:



python -m http.server 8000

и откройте http://localhost:8000. Или используйте расширение Live Server в VS Code.



Проверка путей в .mtl

Откройте assets/kirby.mtl в Блокноте / VS Code. Правильная строка:



map\_Kd textures/kirby\_diffuse.png

Неправильно: map\_Kd C:\\Users\\...\\kirby\_diffuse.png, map\_Kd /home/.../kirby\_diffuse.png, обратные слэши \\.

Путь указывается относительно папки, где лежит .mtl (то есть assets/).

