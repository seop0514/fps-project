import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildMap } from './map.js';
import { Player, Bot } from './entities.js';
import { Viewmodel } from './viewmodel.js';
import { randomGun } from './weapons.js';

const ROUNDS_TO_WIN = 3;
const TOTAL_ROUNDS = 5;

export class Game {
  constructor(container) {
    this.container = container;

    // --- 렌더러 ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14181d);
    this.scene.fog = new THREE.Fog(0x14181d, 40, 140);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);
    this.camera.rotation.order = 'YXZ';

    // --- 조명 ---
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3f45, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(35, 45, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    // --- 컨트롤 ---
    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.controls.pointerSpeed = 1.0;

    // --- 1인칭 뷰모델(총/칼) ---
    this.viewmodel = new Viewmodel(this.camera);

    // --- 맵 ---
    const map = buildMap(this.scene);
    this.colliders = map.colliders;
    this.obstacleMeshes = map.obstacleMeshes;
    this.bounds = map.bounds;
    this.spawnA = map.spawnA;
    this.spawnB = map.spawnB;

    // --- 상태 ---
    this.phase = 'menu'; // menu | playing | paused | roundEnd | matchEnd
    this.round = 0;
    this.scoreA = 0;
    this.scoreB = 0;
    this.time = 0;
    this.transitionAt = 0;

    this.player = null;
    this.bots = [];
    this.shootTargets = [];
    this.tracers = [];
    this._dmgFlashT = 0;

    this.raycaster = new THREE.Raycaster();

    // --- HUD ---
    this.buildHUD();

    // --- 입력 ---
    this.bindInput();

    // --- 컨트롤 이벤트 ---
    this.onLock = this.onLock.bind(this);
    this.onUnlock = this.onUnlock.bind(this);
    this.controls.addEventListener('lock', this.onLock);
    this.controls.addEventListener('unlock', this.onUnlock);

    // --- 리사이즈 ---
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.onResize();

    // --- 루프 ---
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(this.tick.bind(this));
  }

  // ------------------------------------------------------------ HUD

  buildHUD() {
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = `
      <div class="topbar">
        <div class="team team-a">아군 <span id="scoreA">0</span></div>
        <div class="round" id="roundInfo">ROUND 1 / 5</div>
        <div class="team team-b"><span id="scoreB">0</span> 적군</div>
      </div>
      <div class="crosshair" id="crosshair"><span class="ch-dot"></span></div>
      <div class="reload" id="reloadIndicator"></div>
      <div class="hud-bottom">
        <div class="hp-wrap">
          <div class="hp-bar"><div class="hp-fill" id="hpFill"></div></div>
          <div class="hp-num" id="hpText">100</div>
        </div>
        <div class="weapon-wrap">
          <div class="weapon-name" id="weaponName">-</div>
          <div class="ammo" id="ammoText">-</div>
        </div>
      </div>
      <div class="killfeed" id="killfeed"></div>
      <div class="msg-center" id="msgCenter"></div>
      <div class="death-notice" id="deathNotice"></div>
      <div class="dmg-flash" id="dmgFlash"></div>
      <div class="hitmarker" id="hitmarker"></div>
      <div class="overlay" id="overlay">
        <div class="overlay-inner" id="overlayInner"></div>
      </div>
    `;
    this.container.appendChild(hud);

    this.el = {
      scoreA: hud.querySelector('#scoreA'),
      scoreB: hud.querySelector('#scoreB'),
      roundInfo: hud.querySelector('#roundInfo'),
      hpFill: hud.querySelector('#hpFill'),
      hpText: hud.querySelector('#hpText'),
      weaponName: hud.querySelector('#weaponName'),
      ammoText: hud.querySelector('#ammoText'),
      reloadIndicator: hud.querySelector('#reloadIndicator'),
      killfeed: hud.querySelector('#killfeed'),
      msgCenter: hud.querySelector('#msgCenter'),
      deathNotice: hud.querySelector('#deathNotice'),
      dmgFlash: hud.querySelector('#dmgFlash'),
      hitmarker: hud.querySelector('#hitmarker'),
      overlay: hud.querySelector('#overlay'),
      overlayInner: hud.querySelector('#overlayInner'),
    };

    this.showMenu();
  }

  showMenu() {
    this.el.overlay.style.display = 'flex';
    this.el.overlayInner.innerHTML = `
      <h1 class="title">5 vs 5 FPS</h1>
      <p class="subtitle">5라운드 중 3라운드를 먼저 승리하면 승리</p>
      <ul class="rules">
        <li>각 라운드마다 <b>랜덤 총</b>이 지급됩니다.</li>
        <li><b>칼</b>은 항상 지급되며, 칼을 들고 있을 때만 <b>이동 속도가 증가</b>합니다.</li>
        <li>체력은 100. 상대 팀을 전멸시키면 라운드 승리.</li>
      </ul>
      <div class="controls">
        <div><b>W A S D</b> 이동</div>
        <div><b>마우스</b> 시점 / <b>좌클릭</b> 공격</div>
        <div><b>1 / 2</b> 총 / 칼 전환</div>
        <div><b>R</b> 재장전 &nbsp; <b>Space</b> 점프</div>
      </div>
      <button class="btn" id="startBtn">클릭하여 시작</button>
    `;
    this.el.overlayInner.querySelector('#startBtn').addEventListener('click', () => {
      this.controls.lock();
    });
  }

  showPause() {
    this.el.overlay.style.display = 'flex';
    this.el.overlayInner.innerHTML = `
      <h1 class="title">일시정지</h1>
      <button class="btn" id="resumeBtn">클릭하여 계속</button>
    `;
    this.el.overlayInner.querySelector('#resumeBtn').addEventListener('click', () => {
      this.controls.lock();
    });
  }

  showMatchEnd(won) {
    this.el.overlay.style.display = 'flex';
    this.el.overlayInner.innerHTML = `
      <h1 class="title ${won ? 'win' : 'lose'}">${won ? '승리!' : '패배'}</h1>
      <p class="final-score">아군 ${this.scoreA} : ${this.scoreB} 적군</p>
      <button class="btn" id="replayBtn">다시 시작</button>
    `;
    this.el.overlayInner.querySelector('#replayBtn').addEventListener('click', () => {
      this.controls.lock();
    });
  }

  hideOverlay() {
    this.el.overlay.style.display = 'none';
  }

  showMessage(text, duration = 2) {
    this.el.msgCenter.textContent = text;
    this.el.msgCenter.classList.add('show');
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => {
      this.el.msgCenter.classList.remove('show');
    }, duration * 1000);
  }

  // ------------------------------------------------------------ 입력

  bindInput() {
    this._onKeyDown = (e) => {
      if (this.controls.isLocked && this.player) {
        this.player.keys[e.code] = true;
        if (e.code === 'Digit1') this.player.switchWeapon(0);
        if (e.code === 'Digit2') this.player.switchWeapon(1);
        if (e.code === 'KeyR') this.player.startReload();
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }
      }
    };
    this._onKeyUp = (e) => {
      if (this.player) this.player.keys[e.code] = false;
    };
    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (!this.controls.isLocked || this.phase !== 'playing') return;
      if (!this.player || !this.player.alive) return;
      const p = this.player;
      p.firing = true;
      const w = p.currentWeapon;
      if (w) {
        if (w.kind === 'melee') p.melee(this.time);
        else if (!w.auto) p.fire(this.time);
      }
    };
    this._onMouseUp = (e) => {
      if (e.button !== 0) return;
      if (this.player) this.player.firing = false;
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  // ------------------------------------------------------------ 컨트롤 이벤트

  onLock() {
    if (this.phase === 'menu' || this.phase === 'matchEnd') {
      this.startMatch();
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.hideOverlay();
    }
  }

  onUnlock() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.showPause();
    }
  }

  // ------------------------------------------------------------ 경기 관리

  clearCombatants() {
    for (const b of this.bots) {
      this.scene.remove(b.group);
    }
    for (const t of this.tracers) {
      this.scene.remove(t.group);
      t.glow.geometry.dispose();
      t.glowMat.dispose();
      t.core.geometry.dispose();
      t.coreMat.dispose();
    }
    this.tracers = [];
    this.bots = [];
    this.player = null;
  }

  rebuildShootTargets() {
    this.shootTargets = this.obstacleMeshes.slice();
    for (const b of this.bots) {
      for (const child of b.group.children) {
        if (child.userData.entity) this.shootTargets.push(child);
      }
    }
  }

  startMatch() {
    this.clearCombatants();
    this.hideOverlay();
    this.el.killfeed.innerHTML = '';

    this.player = new Player(this, this.spawnA[0]);
    this.bots = [];
    for (let i = 0; i < 4; i++) this.bots.push(new Bot(this, 'A', this.spawnA[i + 1], i));
    for (let i = 0; i < 5; i++) this.bots.push(new Bot(this, 'B', this.spawnB[i], i));
    this.rebuildShootTargets();

    this.scoreA = 0;
    this.scoreB = 0;
    this.round = 0;
    this.startRound(1);
  }

  startRound(n) {
    this.round = n;
    this.phase = 'playing';

    // 라운드마다 랜덤 총 지급
    this.player.setLoadout(randomGun());
    this.player.respawn(this.spawnA[0]);
    this.player.current = 0;

    const spawnsA = [this.spawnA[0], this.spawnA[1], this.spawnA[2], this.spawnA[3], this.spawnA[4]];
    const spawnsB = this.spawnB;
    let ai = 0;
    let bi = 0;
    for (const b of this.bots) {
      if (b.team === 'A') {
        b.setGun(randomGun());
        b.respawn(spawnsA[ai + 1]);
        ai++;
      } else {
        b.setGun(randomGun());
        b.respawn(spawnsB[bi]);
        bi++;
      }
      b.current = 0;
    }

    this.el.deathNotice.style.display = 'none';
    this.updateHUD();
    this.showMessage(`ROUND ${n}`, 1.5);
  }

  get aliveA() {
    let n = this.player && this.player.alive ? 1 : 0;
    for (const b of this.bots) if (b.alive && b.team === 'A') n++;
    return n;
  }

  get aliveB() {
    let n = 0;
    for (const b of this.bots) if (b.alive && b.team === 'B') n++;
    return n;
  }

  onPlayerDeath(attacker) {
    this.addKill(this.label(attacker), '나', attacker);
    this.el.deathNotice.style.display = 'block';
    this.el.deathNotice.textContent = '사망 — 라운드 종료까지 관전 중';
    this.checkRoundEnd();
  }

  onBotDeath(bot, attacker) {
    this.addKill(this.label(attacker), this.label(bot), attacker);
    this.checkRoundEnd();
  }

  label(entity) {
    if (!entity) return '?';
    if (entity === this.player) return '나';
    if (entity.team === 'A') return `아군 봇`;
    return `적군 봇`;
  }

  addKill(killer, victim, attacker) {
    const wep = attacker && attacker.currentWeapon ? attacker.currentWeapon.name : '';
    const entry = document.createElement('div');
    entry.className = 'kf-entry';
    entry.innerHTML = `<span>${killer}</span> <b>${wep}</b> <span>${victim}</span>`;
    this.el.killfeed.appendChild(entry);
    while (this.el.killfeed.children.length > 5) {
      this.el.killfeed.removeChild(this.el.killfeed.firstChild);
    }
  }

  checkRoundEnd() {
    if (this.phase !== 'playing') return;
    if (this.aliveB === 0) {
      this.scoreA++;
      this.endRound('A');
    } else if (this.aliveA === 0) {
      this.scoreB++;
      this.endRound('B');
    }
  }

  endRound(winner) {
    this.phase = 'roundEnd';
    const won = winner === 'A';
    this.showMessage(
      `${won ? '아군' : '적군'} 라운드 승리! (${this.scoreA} : ${this.scoreB})`,
      2.2
    );

    if (this.scoreA >= ROUNDS_TO_WIN || this.scoreB >= ROUNDS_TO_WIN) {
      this.transitionAt = this.time + 2.4;
      this._endAs = 'match';
    } else if (this.round >= TOTAL_ROUNDS) {
      // 5라운드까지도 3승이 안 나오는 경우는 없지만 안전 처리
      this.transitionAt = this.time + 2.4;
      this._endAs = 'match';
    } else {
      this.transitionAt = this.time + 2.4;
      this._endAs = 'round';
    }
    this.updateHUD();
  }

  processTransition() {
    if (this._endAs === 'match') {
      this.phase = 'matchEnd';
      this.controls.unlock();
      this.showMatchEnd(this.scoreA > this.scoreB);
      this._endAs = null;
    } else if (this._endAs === 'round') {
      this.startRound(this.round + 1);
      this._endAs = null;
    }
  }

  // ------------------------------------------------------------ 전투

  playerShoot(gun) {
    const origin = this.camera.position.clone();
    const muzzle = this.viewmodel.getMuzzleWorld();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    // 총구 화염 + 반동
    this.viewmodel.playShot();

    for (let i = 0; i < (gun.pellets || 1); i++) {
      const dir = forward.clone();
      if (gun.spread > 0) {
        dir.x += (Math.random() - 0.5) * 2 * gun.spread;
        dir.y += (Math.random() - 0.5) * 2 * gun.spread;
        dir.z += (Math.random() - 0.5) * 2 * gun.spread;
        dir.normalize();
      }
      this.raycaster.set(origin, dir);
      this.raycaster.far = gun.range;
      const hits = this.raycaster.intersectObjects(this.shootTargets, false);

      let resolved = false;
      for (const h of hits) {
        const ent = h.object.userData.entity;
        if (ent && !ent.alive) continue;
        resolved = true;
        this.addTracer(muzzle, h.point, 0xffe08a);
        if (ent && ent.team !== 'A') {
          let dmg = gun.damage;
          if (h.object.userData.part === 'head' && gun.headshot) dmg *= gun.headshot;
          ent.takeDamage(dmg, this.player);
          this.flashHitmarker(h.object.userData.part === 'head');
        }
        break;
      }
      if (!resolved) {
        this.addTracer(muzzle, muzzle.clone().add(dir.clone().multiplyScalar(gun.range)), 0xffe08a);
      }
    }
  }

  playerMelee(weapon) {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.raycaster.set(origin, dir);
    this.raycaster.far = weapon.range;
    const hits = this.raycaster.intersectObjects(this.shootTargets, false);

    // 칼 휘두르기 애니메이션
    this.viewmodel.playSwing();

    for (const h of hits) {
      const ent = h.object.userData.entity;
      if (ent && !ent.alive) continue;
      if (ent && ent.team !== 'A') {
        ent.takeDamage(weapon.damage, this.player);
        this.flashHitmarker(false);
      }
      break;
    }
  }

  addTracer(from, to, color) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.001) return;
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    const axis = dir.clone().normalize();

    const group = new THREE.Group();

    const glowGeo = new THREE.CylinderGeometry(0.028, 0.028, len, 6);
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);

    const coreGeo = new THREE.CylinderGeometry(0.011, 0.011, len, 6);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);

    group.add(glow, core);
    group.position.copy(mid);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    group.frustumCulled = false;
    this.scene.add(group);

    this.tracers.push({ group, glow, core, glowMat, coreMat, ttl: 0.09, life: 0.09 });
  }

  flashHitmarker(headshot) {
    this.el.hitmarker.classList.remove('show', 'hs');
    void this.el.hitmarker.offsetWidth;
    this.el.hitmarker.classList.add('show');
    if (headshot) this.el.hitmarker.classList.add('hs');
    clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(() => this.el.hitmarker.classList.remove('show'), 120);
  }

  flashDamage() {
    this._dmgFlashT = 0.35;
  }

  // ------------------------------------------------------------ 보조

  findNearestEnemy(team, fromPos) {
    let best = null;
    let bd = Infinity;
    const all = [this.player, ...this.bots];
    for (const c of all) {
      if (!c || !c.alive) continue;
      if (c.team === team) continue;
      const d = c.eyePos.distanceTo(fromPos);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  hasLineOfSight(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    dir.normalize();
    this.raycaster.set(from, dir);
    this.raycaster.far = dist - 0.05;
    const hits = this.raycaster.intersectObjects(this.obstacleMeshes, false);
    return hits.length === 0;
  }

  // ------------------------------------------------------------ 루프

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    if (this.phase === 'playing') {
      if (this.player) this.player.update(dt, this.time);
      for (const b of this.bots) b.update(dt, this.time);
      this.updateHUD();
    } else if (this.phase === 'roundEnd') {
      for (const b of this.bots) if (b.alive) b.group.rotation.y += dt * 0.5; // 사망 없이 연출
      if (this.time >= this.transitionAt) this.processTransition();
    }

    // 뷰모델(총/칼) 갱신
    if (this.player) {
      const moving =
        this.player.alive &&
        (Math.abs(this.player.vel.x) + Math.abs(this.player.vel.z)) > 0.1;
      this.viewmodel.setWeapon(this.player.currentWeapon);
      this.viewmodel.update(dt, moving);
    }
    this.viewmodel.group.visible =
      (this.phase === 'playing' || this.phase === 'roundEnd') &&
      this.player &&
      this.player.alive;

    // 트레이서 갱신
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.ttl -= dt;
      if (t.ttl <= 0) {
        this.scene.remove(t.group);
        t.glow.geometry.dispose();
        t.glowMat.dispose();
        t.core.geometry.dispose();
        t.coreMat.dispose();
        this.tracers.splice(i, 1);
      } else {
        const f = t.ttl / t.life;
        t.glowMat.opacity = 0.45 * f;
        t.coreMat.opacity = 0.95 * f;
      }
    }

    // 데미지 플래시 페이드
    if (this._dmgFlashT > 0) {
      this._dmgFlashT -= dt;
      this.el.dmgFlash.style.opacity = Math.max(0, this._dmgFlashT * 3);
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateHUD() {
    this.el.scoreA.textContent = this.scoreA;
    this.el.scoreB.textContent = this.scoreB;
    this.el.roundInfo.textContent = `ROUND ${this.round} / ${TOTAL_ROUNDS}  ·  3선승`;

    if (this.player) {
      const hp = Math.max(0, Math.ceil(this.player.health));
      this.el.hpText.textContent = hp;
      this.el.hpFill.style.width = `${hp}%`;
      this.el.hpFill.className = 'hp-fill' + (hp <= 30 ? ' low' : '');

      const w = this.player.currentWeapon;
      if (w) {
        this.el.weaponName.textContent = w.kind === 'melee' ? `${w.name} (속도 ↑)` : w.name;
        this.el.ammoText.textContent =
          w.kind === 'melee' ? '∞' : `${this.player.mag} / ${w.magSize}`;
      }

      if (this.player.reloading) {
        this.el.reloadIndicator.textContent = '재장전 중...';
      } else if (w && w.kind === 'gun' && this.player.mag === 0) {
        this.el.reloadIndicator.textContent = 'R 키로 재장전';
      } else {
        this.el.reloadIndicator.textContent = '';
      }
    }
  }

  onResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    this.controls.removeEventListener('lock', this.onLock);
    this.controls.removeEventListener('unlock', this.onUnlock);
    this.controls.dispose();
    this.clearCombatants();
    if (this.viewmodel) {
      this.camera.remove(this.viewmodel.group);
      this.viewmodel = null;
    }
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
