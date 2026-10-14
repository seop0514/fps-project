import * as THREE from 'three';
import { getKnife, randomGun } from './weapons.js';
import { resolveCollision } from './map.js';

const EYE_HEIGHT = 1.7;
const BASE_SPEED = 5.0;
const GRAVITY = -22;
const JUMP_SPEED = 6.0;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// ---------------------------------------------------------------- Player

export class Player {
  constructor(game, spawn) {
    this.game = game;
    this.team = 'A';
    this.alive = true;
    this.health = 100;
    this.maxHealth = 100;
    this.radius = 0.5;

    this.pos = new THREE.Vector3(spawn[0], 0, spawn[1]);
    this.vel = new THREE.Vector3();
    this.onGround = true;

    this.knife = getKnife();
    this.gun = null;          // 라운드마다 랜덤 배정
    this.weapons = [];        // [gun, knife]
    this.current = 0;         // 0: 총, 1: 칼

    this.mag = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.lastShot = 0;
    this.firing = false;
    this.lastKnife = 0;

    this.keys = {};
  }

  get currentWeapon() {
    return this.weapons[this.current];
  }

  setLoadout(gun) {
    this.gun = gun;
    this.weapons = [gun, this.knife];
    this.current = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.firing = false;
    this.mag = gun ? gun.magSize : 0;
  }

  respawn(spawn) {
    this.pos.set(spawn[0], 0, spawn[1]);
    this.vel.set(0, 0, 0);
    this.onGround = true;
    this.health = this.maxHealth;
    this.alive = true;
    this.reloading = false;
    this.firing = false;
  }

  get eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
  }

  // 이동 속도: 칼을 들고 있을 때만 증가
  get speed() {
    const base = BASE_SPEED;
    if (this.currentWeapon && this.currentWeapon.kind === 'melee') {
      return base * this.currentWeapon.speedMultiplier;
    }
    return base;
  }

  takeDamage(amount, attacker) {
    if (!this.alive) return;
    this.health -= amount;
    this.game.flashDamage();
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.firing = false;
      this.game.onPlayerDeath(attacker);
    }
  }

  switchWeapon(index) {
    if (index >= 0 && index < this.weapons.length && this.weapons[index]) {
      this.current = index;
      this.reloading = false;
      this.reloadTimer = 0;
    }
  }

  startReload() {
    const w = this.currentWeapon;
    if (!w || w.kind !== 'gun') return;
    if (this.reloading || this.mag >= w.magSize) return;
    this.reloading = true;
    this.reloadTimer = w.reloadTime;
  }

  fire(time) {
    const w = this.currentWeapon;
    if (!w) return;
    if (w.kind === 'melee') {
      this.melee(time);
      return;
    }
    if (this.reloading) return;
    if (this.mag <= 0) {
      this.startReload();
      return;
    }
    const interval = 60 / w.rpm;
    if (time - this.lastShot < interval) return;
    this.lastShot = time;
    this.mag--;
    this.game.playerShoot(w);
    if (this.mag <= 0) this.startReload();
  }

  melee(time) {
    const w = this.currentWeapon;
    if (!w) return;
    if (time - this.lastKnife < w.attackInterval) return;
    this.lastKnife = time;
    this.game.playerMelee(w);
  }

  update(dt, time) {
    if (!this.alive) {
      // 사망 시 이동/사격 불가
      return;
    }

    // --- 이동 입력 ---
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.game.camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() > 0.0001) forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (this.keys['KeyW']) move.add(forward);
    if (this.keys['KeyS']) move.sub(forward);
    if (this.keys['KeyD']) move.add(right);
    if (this.keys['KeyA']) move.sub(right);
    if (move.lengthSq() > 0) move.normalize();

    this.vel.x = move.x * this.speed;
    this.vel.z = move.z * this.speed;

    // 점프
    if (this.keys['Space'] && this.onGround) {
      this.vel.y = JUMP_SPEED;
      this.onGround = false;
    }

    // 중력
    this.vel.y += GRAVITY * dt;

    // 위치 적분
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      this.onGround = true;
    }

    resolveCollision(this.pos, this.radius, this.game.colliders, this.game.bounds);

    // 카메라 위치
    this.game.camera.position.copy(this.eyePos);

    // 재장전 진행
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.mag = this.currentWeapon.magSize;
      }
    }

    // 자동 연사
    if (this.firing && this.currentWeapon && this.currentWeapon.auto) {
      this.fire(time);
    }
  }
}

// ---------------------------------------------------------------- Bot

export class Bot {
  constructor(game, team, spawn, idx) {
    this.game = game;
    this.team = team;
    this.idx = idx;
    this.alive = true;
    this.health = 100;
    this.maxHealth = 100;
    this.radius = 0.5;

    this.pos = new THREE.Vector3(spawn[0], 0, spawn[1]);
    this.vel = new THREE.Vector3();
    this.speed = 4.1 + Math.random() * 0.7;

    this.gun = randomGun();
    this.knife = getKnife();
    this.weapons = [this.gun, this.knife];
    this.current = 0;
    this.mag = this.gun.magSize;
    this.reloading = false;
    this.reloadTimer = 0;
    this.lastShot = 0;
    this.lastKnife = 0;

    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 0;

    this.buildMesh();
  }

  buildMesh() {
    this.group = new THREE.Group();
    const color = this.team === 'A' ? 0x3b82f6 : 0xef4444;

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 1.1, 10),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    );
    body.position.y = 0.55;
    body.castShadow = true;
    body.userData = { entity: this, part: 'body' };
    this.group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9b38c, roughness: 0.5 })
    );
    head.position.y = 1.72;
    head.castShadow = true;
    head.userData = { entity: this, part: 'head' };
    this.group.add(head);

    // 들고 있는 총(시각용, 히트박스 없음)
    this.gunVisual = new THREE.Group();
    const gunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.5 })
    );
    const gunBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.4 })
    );
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 0.02, 0.27);
    gunBody.position.set(0, 0, 0.08);
    this.gunVisual.add(gunBody, gunBarrel);
    this.gunVisual.position.set(0.18, 0.95, 0.28);
    this.group.add(this.gunVisual);

    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.game.scene.add(this.group);
  }

  get currentWeapon() {
    return this.weapons[this.current];
  }

  get eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z);
  }

  respawn(spawn) {
    this.pos.set(spawn[0], 0, spawn[1]);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.alive = true;
    this.reloading = false;
    this.group.visible = true;
  }

  setGun(gun) {
    this.gun = gun;
    this.weapons = [gun, this.knife];
    this.mag = gun.magSize;
    this.reloading = false;
    this.reloadTimer = 0;
  }

  takeDamage(amount, attacker) {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.group.visible = false;
      this.game.onBotDeath(this, attacker);
    }
  }

  update(dt, time) {
    if (!this.alive) return;

    const target = this.game.findNearestEnemy(this.team, this.eyePos);
    if (!target) return;

    const targetEye = target.eyePos;
    const myEye = this.eyePos;
    const toTarget = new THREE.Vector3().subVectors(targetEye, myEye);
    const dist = toTarget.length();
    const dir = toTarget.normalize();

    // --- 무기 선택: 매우 가까우면 칼 ---
    if (dist < 2.6) {
      this.current = 1;
    } else {
      this.current = 0;
    }

    const weapon = this.currentWeapon;

    // --- 시야 판정(장애물에 막히는지) ---
    const los = this.game.hasLineOfSight(myEye, targetEye);

    // --- 이동 ---
    const move = new THREE.Vector3();
    const desired = weapon.kind === 'melee' ? 0.8 : Math.max(6, weapon.range * 0.5);

    if (dist > desired) {
      move.add(dir);
    }
    // 좌우 스트레이프
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      this.strafeTimer = 0.6 + Math.random() * 1.0;
    }
    const strafe = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir);
    move.add(strafe.multiplyScalar(0.6));

    if (move.lengthSq() > 0) move.normalize();
    this.pos.x += move.x * this.speed * dt;
    this.pos.z += move.z * this.speed * dt;
    resolveCollision(this.pos, this.radius, this.game.colliders, this.game.bounds);
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(dir.x, dir.z);

    // --- 공격 ---
    if (weapon.kind === 'melee') {
      if (dist < weapon.range && los && time - this.lastKnife >= weapon.attackInterval) {
        this.lastKnife = time;
        target.takeDamage(weapon.damage, this);
      }
    } else {
      const interval = 60 / weapon.rpm;
      if (
        los &&
        dist < weapon.range &&
        !this.reloading &&
        this.mag > 0 &&
        time - this.lastShot >= interval
      ) {
        this.lastShot = time;
        this.mag--;
        // 확률 기반 명중
        const p = clamp(1 - dist / weapon.range, 0.12, 0.85) * 0.85;
        const hit = Math.random() < p;
        const tracerColor = this.team === 'B' ? 0xff6b5e : 0x6fb1ff;
        if (hit) {
          const dmg = this.botDamage(weapon, dist);
          target.takeDamage(dmg, this);
          this.game.addTracer(myEye, targetEye, tracerColor);
        } else {
          const off = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5
          );
          this.game.addTracer(
            myEye,
            targetEye.clone().add(off.multiplyScalar(0.3 + dist * 0.02)),
            tracerColor
          );
        }
        if (this.mag <= 0) {
          this.reloading = true;
          this.reloadTimer = weapon.reloadTime;
        }
      }
    }

    // 재장전
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.mag = this.gun.magSize;
      }
    }
  }

  botDamage(weapon, dist) {
    if (weapon.pellets > 1) {
      // 산탄총: 거리에 따라 맞는 펠릿 수 감소
      const hitPellets = Math.max(1, Math.round(weapon.pellets * (1 - dist / weapon.range)));
      return weapon.damage * hitPellets;
    }
    return weapon.damage;
  }
}
