import * as THREE from 'three';

function metal(color, metalness = 0.25, roughness = 0.55) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

// 무기별 외형 설정
const GUN_CFG = {
  pistol: { barrelLen: 0.26, barrelR: 0.016, bodyLen: 0.3, stock: false, mag: 'small', color: 0x4a525c, accent: 0x2a3038 },
  smg: { barrelLen: 0.32, barrelR: 0.017, bodyLen: 0.34, stock: false, mag: 'long', color: 0x4a525c, accent: 0x2a3038 },
  rifle: { barrelLen: 0.5, barrelR: 0.018, bodyLen: 0.42, stock: true, mag: 'curved', color: 0x4a525c, accent: 0x2a3038 },
  shotgun: { barrelLen: 0.58, barrelR: 0.03, bodyLen: 0.4, stock: true, mag: 'tube', color: 0x6a5240, accent: 0x3a2c1e },
  sniper: { barrelLen: 0.74, barrelR: 0.02, bodyLen: 0.46, stock: true, mag: 'small', color: 0x4a525c, accent: 0x2a3038, scope: true },
  lmg: { barrelLen: 0.46, barrelR: 0.022, bodyLen: 0.44, stock: true, mag: 'box', color: 0x4a525c, accent: 0x2a3038 },
};

const GUN_POS = new THREE.Vector3(0.34, -0.31, -0.55);
const KNIFE_POS = new THREE.Vector3(0.42, -0.34, -0.6);

export class Viewmodel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.group.visible = false;

    this.gunGroup = new THREE.Group();
    this.knifeGroup = new THREE.Group();
    this.group.add(this.gunGroup);
    this.group.add(this.knifeGroup);

    this.flashTex = this.makeFlashTexture();

    this.weaponId = null;
    this.current = 'gun';

    this.recoil = 0;
    this.swing = 0;
    this.swingActive = false;
    this.bobPhase = 0;
    this.muzzleFlashTimer = 0;
    this.muzzle = null;
    this.muzzleFlash = null;

    this.buildKnife();
    this.gunGroup.visible = false;
    this.knifeGroup.visible = true;
  }

  makeFlashTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,225,130,0.95)');
    g.addColorStop(0.6, 'rgba(255,150,40,0.45)');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  box(parent, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  }

  cyl(parent, rTop, rBot, len, x, y, z, mat, axis = 'y') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 10), mat);
    m.position.set(x, y, z);
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    parent.add(m);
    return m;
  }

  buildKnife() {
    const g = this.knifeGroup;
    const steel = metal(0xd7dde3, 0.4, 0.3);
    const dark = metal(0x3a322b, 0.2, 0.7);

    // 칼날(앞쪽 -z)
    this.box(g, 0.02, 0.05, 0.24, 0, 0.02, -0.16, steel);
    // 칼끝(뾰족하게 표현)
    this.box(g, 0.012, 0.035, 0.07, 0, 0.03, -0.3, steel);
    // 가드
    this.box(g, 0.08, 0.02, 0.03, 0, -0.02, -0.03, dark);
    // 손잡이
    this.box(g, 0.035, 0.05, 0.11, 0, -0.02, 0.05, dark);
    // 폼멜
    this.box(g, 0.04, 0.04, 0.03, 0, -0.02, 0.12, dark);

    this.knifeGroup.position.copy(KNIFE_POS);
    this.knifeGroup.rotation.x = -0.25;
  }

  buildGun(weapon) {
    const g = this.gunGroup;
    // 이전 모델 정리
    while (g.children.length) {
      const c = g.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }

    const cfg = GUN_CFG[weapon.id] || GUN_CFG.rifle;
    const main = metal(cfg.color, 0.25, 0.5);
    const dark = metal(cfg.accent, 0.3, 0.55);
    const steel = metal(0xb8c0c8, 0.5, 0.3);

    // 몸통(리시버)
    this.box(g, 0.06, 0.09, cfg.bodyLen, 0, 0, -0.05, main);
    // 총열
    this.cyl(g, cfg.barrelR, cfg.barrelR, cfg.barrelLen, 0, 0.02, -cfg.bodyLen / 2 - cfg.barrelLen / 2 - 0.02, dark, 'z');
    // 총구
    this.cyl(g, cfg.barrelR + 0.008, cfg.barrelR + 0.008, 0.05, 0, 0.02, -cfg.bodyLen / 2 - cfg.barrelLen - 0.04, steel, 'z');
    // 핸드가드
    this.box(g, 0.07, 0.07, cfg.barrelLen * 0.6, 0, 0, -cfg.bodyLen / 2 - cfg.barrelLen * 0.3, dark);
    // 손잡이
    this.box(g, 0.045, 0.11, 0.07, 0, -0.1, 0.05, dark, -0.3);
    // 탄창
    if (cfg.mag === 'box') {
      this.box(g, 0.05, 0.16, 0.09, 0, -0.14, 0.02, dark);
    } else if (cfg.mag === 'long') {
      this.box(g, 0.04, 0.2, 0.05, 0, -0.16, 0.02, dark, 0.2);
    } else if (cfg.mag === 'curved') {
      this.box(g, 0.045, 0.14, 0.06, 0, -0.12, 0.02, dark, 0.35);
    } else if (cfg.mag === 'tube') {
      this.cyl(g, 0.02, 0.02, 0.32, 0, -0.03, -0.2, steel, 'z');
    } else {
      this.box(g, 0.04, 0.09, 0.05, 0, -0.08, 0.02, dark);
    }
    // 개머리판
    if (cfg.stock) {
      this.box(g, 0.05, 0.07, 0.16, 0, -0.02, 0.16, dark);
    }
    // 가늠자 / 스코프
    if (cfg.scope) {
      this.cyl(g, 0.03, 0.03, 0.16, 0, 0.09, -0.08, dark, 'z');
      this.cyl(g, 0.02, 0.02, 0.02, 0, 0.09, -0.17, steel, 'z');
    } else {
      this.box(g, 0.015, 0.035, 0.03, 0, 0.075, -0.22, dark);
    }

    // 총구 위치 마커
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.02, -cfg.bodyLen / 2 - cfg.barrelLen - 0.06);
    g.add(this.muzzle);

    // 총구 화염 스프라이트
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.flashTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    sprite.scale.setScalar(0.001);
    sprite.renderOrder = 999;
    this.muzzle.add(sprite);
    this.muzzleFlash = sprite;

    this.gunGroup.position.copy(GUN_POS);
    this.gunGroup.rotation.set(0, 0, 0);
  }

  setWeapon(weapon) {
    if (!weapon) return;
    const next = weapon.kind === 'melee' ? 'knife' : 'gun';
    if (next === 'gun') {
      if (this.weaponId !== weapon.id) {
        this.weaponId = weapon.id;
        this.buildGun(weapon);
      }
      this.gunGroup.visible = true;
      this.knifeGroup.visible = false;
    } else {
      this.weaponId = 'knife';
      this.gunGroup.visible = false;
      this.knifeGroup.visible = true;
    }
    this.current = next;
  }

  playShot() {
    this.recoil = 1;
    this.muzzleFlashTimer = 0.045;
    if (this.muzzleFlash) {
      this.muzzleFlash.visible = true;
      this.muzzleFlash.scale.setScalar(0.12 + Math.random() * 0.1);
      this.muzzleFlash.material.rotation = Math.random() * Math.PI;
    }
  }

  playSwing() {
    this.swingActive = true;
    this.swing = 0;
  }

  update(dt, moving) {
    // 반동 감쇠
    this.recoil = Math.max(0, this.recoil - dt * 7);
    const kick = this.recoil;

    // 이동 시 흔들림
    if (moving) this.bobPhase += dt * 9;
    else this.bobPhase += (0 - this.bobPhase) * dt * 6;
    const by = Math.sin(this.bobPhase) * 0.012;
    const bx = Math.cos(this.bobPhase * 0.5) * 0.01;

    // 총 위치/반동
    this.gunGroup.position.set(GUN_POS.x + bx, GUN_POS.y + by, GUN_POS.z + kick * 0.07);
    this.gunGroup.rotation.x = kick * 0.12;
    this.gunGroup.rotation.z = -bx * 1.5;

    // 칼 휘두르기
    if (this.swingActive) {
      this.swing += dt * 4.2;
      if (this.swing >= 1) this.swingActive = false;
    }
    const sw = this.swingActive ? Math.sin(this.swing * Math.PI) : 0;
    this.knifeGroup.position.set(KNIFE_POS.x + bx, KNIFE_POS.y + by, KNIFE_POS.z + sw * 0.1);
    this.knifeGroup.rotation.x = -0.25 - sw * 1.0;
    this.knifeGroup.rotation.z = sw * 0.5;

    // 총구 화염
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0 && this.muzzleFlash) this.muzzleFlash.visible = false;
    }
  }

  getMuzzleWorld() {
    this.camera.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    if (this.muzzle && this.current === 'gun') {
      this.muzzle.getWorldPosition(v);
    } else {
      v.copy(this.camera.position).add(new THREE.Vector3(0.3, -0.2, -0.5).applyQuaternion(this.camera.quaternion));
    }
    return v;
  }
}
