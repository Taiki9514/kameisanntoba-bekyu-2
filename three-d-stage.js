// three-d-stage.js — map3d.html 用の軽量3Dステージ（<three-d-stage> カスタム要素）
// map3d.html の importmap で指定された three / OrbitControls を読み込みます。
(function () {
  class ThreeDStage extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML =
        '<style>:host{display:block;position:relative;overflow:hidden}canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}</style>';
      this.ready = new Promise((res, rej) => { this._res = res; this._rej = rej; });
    }

    connectedCallback() {
      if (this._started) return;
      this._started = true;
      Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')])
        .then(([THREE, ctl]) => this._init(THREE, ctl.OrbitControls))
        .catch((e) => { console.error(e); this._rej(e); });
    }

    _init(THREE, OrbitControls) {
      const bg = this.getAttribute('background') || '#f3ead8';
      const w = this.clientWidth || innerWidth, h = this.clientHeight || innerHeight;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.shadowRoot.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(bg);

      const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 2000);
      camera.position.set(30, 40, 50);

      const hemi = new THREE.HemisphereLight(0xfff6e6, 0x8a7a60, 1.1);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(-6, 10, 6);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.bias = -0.0005;
      scene.add(key, key.target);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShadowMaterial({ opacity: 0.15 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;

      Object.assign(this, {
        THREE, _renderer: renderer, _scene: scene, _camera: camera,
        _controls: controls, _key: key, _hemi: hemi, _ground: ground, _object: null
      });

      const resize = () => {
        const W = this.clientWidth || innerWidth, H = this.clientHeight || innerHeight;
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
      };
      new ResizeObserver(resize).observe(this);
      addEventListener('resize', resize);

      const tmp = new THREE.Vector3();
      const loop = () => {
        // ライトが近すぎると影が欠けるので、向きを保ったまま十分遠くに置く
        if (this._r) {
          tmp.copy(key.position).sub(key.target.position);
          if (tmp.length() < this._r * 2.5) key.position.copy(key.target.position).add(tmp.setLength(this._r * 3));
        }
        controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop);
      };
      loop();

      this._res({ THREE, scene, camera, renderer, controls });
    }

    // 表示するオブジェクトをセット。影を有効にし、地面とライトの影範囲を合わせる
    setObject(obj) {
      const THREE = this.THREE;
      if (this._object) this._scene.remove(this._object);
      this._object = obj;
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this._scene.add(obj);

      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const c = box.getCenter(new THREE.Vector3());
      const r = Math.max(size.x, size.z) * 0.75 || 10;

      this._ground.position.set(c.x, box.min.y + 0.01, c.z);
      this._ground.scale.set(r * 4, r * 4, 1);

      const cam = this._key.shadow.camera;
      cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
      cam.near = 0.5; cam.far = r * 8;
      this._r = r;
      cam.updateProjectionMatrix();
      this._key.target.position.copy(c);
    }
  }
  if (!customElements.get('three-d-stage')) customElements.define('three-d-stage', ThreeDStage);
})();
