import * as THREE from 'three';

// 간단한 대칭 아레나 맵 구성
export function buildMap(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // 바닥
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 60),
    new THREE.MeshStandardMaterial({ color: 0x39424a, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 바닥 중앙선 표시용 얇은 판
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x5b6870 })
  );
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.01;
  line.receiveShadow = true;
  group.add(line);

  const colliders = [];
  const obstacleMeshes = [];

  // 장애물 정의 { x, z, w, h, d, color } — 대칭 구조의 아레나
  const defs = [
    // 중앙 구조물
    { x: 0, z: 0, w: 7, h: 3, d: 7, color: 0x8a6a4a },
    { x: 0, z: 0, w: 3, h: 4.6, d: 3, color: 0x7a5c42 },

    // 중앙을 가로지르는 레인 벽(좌/우)
    { x: -20, z: 0, w: 2.4, h: 2.6, d: 13, color: 0x6b737b },
    { x: 20, z: 0, w: 2.4, h: 2.6, d: 13, color: 0x6b737b },

    // 4사분면 미드 커버
    { x: -12, z: -12, w: 3.6, h: 2.1, d: 3.6, color: 0x777c82 },
    { x: 12, z: -12, w: 3.6, h: 2.1, d: 3.6, color: 0x777c82 },
    { x: -12, z: 12, w: 3.6, h: 2.1, d: 3.6, color: 0x777c82 },
    { x: 12, z: 12, w: 3.6, h: 2.1, d: 3.6, color: 0x777c82 },

    // 코너 커버(사이드)
    { x: -27, z: -8, w: 3.4, h: 2.2, d: 3.4, color: 0x5c636b },
    { x: 27, z: -8, w: 3.4, h: 2.2, d: 3.4, color: 0x5c636b },
    { x: -27, z: 8, w: 3.4, h: 2.2, d: 3.4, color: 0x5c636b },
    { x: 27, z: 8, w: 3.4, h: 2.2, d: 3.4, color: 0x5c636b },

    // 스폰 근처 사이드 커버
    { x: -9, z: -21, w: 2.2, h: 2, d: 5, color: 0x6b737b },
    { x: 9, z: -21, w: 2.2, h: 2, d: 5, color: 0x6b737b },
    { x: -9, z: 21, w: 2.2, h: 2, d: 5, color: 0x6b737b },
    { x: 9, z: 21, w: 2.2, h: 2, d: 5, color: 0x6b737b },

    // 낮은 엄폐 크레이트(앉아서 숨기 좋은)
    { x: -5.5, z: -5.5, w: 1.9, h: 1.2, d: 1.9, color: 0x9a7a55 },
    { x: 5.5, z: -5.5, w: 1.9, h: 1.2, d: 1.9, color: 0x9a7a55 },
    { x: -5.5, z: 5.5, w: 1.9, h: 1.2, d: 1.9, color: 0x9a7a55 },
    { x: 5.5, z: 5.5, w: 1.9, h: 1.2, d: 1.9, color: 0x9a7a55 },

    // 긴 커버 벽(중앙 레인)
    { x: 0, z: -11, w: 9, h: 1.5, d: 2.2, color: 0x5c636b },
    { x: 0, z: 11, w: 9, h: 1.5, d: 2.2, color: 0x5c636b },
  ];

  for (const d of defs) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(d.w, d.h, d.d),
      new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.85 })
    );
    mesh.position.set(d.x, d.h / 2, d.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    obstacleMeshes.push(mesh);
    colliders.push({
      minX: d.x - d.w / 2,
      maxX: d.x + d.w / 2,
      minZ: d.z - d.d / 2,
      maxZ: d.z + d.d / 2,
    });
  }

  // ===== 장식: 경계 벽 =====
  const wallDefs = [
    { x: 0, z: -30, w: 82, h: 3.5, d: 1.2 },
    { x: 0, z: 30, w: 82, h: 3.5, d: 1.2 },
    { x: -40, z: 0, w: 1.2, h: 3.5, d: 62 },
    { x: 40, z: 0, w: 1.2, h: 3.5, d: 62 },
  ];
  for (const w of wallDefs) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w.w, w.h, w.d),
      new THREE.MeshStandardMaterial({ color: 0x4a5158, roughness: 0.9 })
    );
    mesh.position.set(w.x, w.h / 2, w.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    obstacleMeshes.push(mesh);
    colliders.push({
      minX: w.x - w.w / 2,
      maxX: w.x + w.w / 2,
      minZ: w.z - w.d / 2,
      maxZ: w.z + w.d / 2,
    });
  }

  // ===== 장식: 드럼통(원통) =====
  const barrelDefs = [
    { x: -16, z: -5, c: 0xb0413e },
    { x: 16, z: -5, c: 0xb0413e },
    { x: -16, z: 5, c: 0xb0413e },
    { x: 16, z: 5, c: 0xb0413e },
    { x: 0, z: -16, c: 0x3f7fae },
    { x: 0, z: 16, c: 0x3f7fae },
    { x: -24, z: -14, c: 0xb0413e },
    { x: 24, z: -14, c: 0xb0413e },
  ];
  const BARREL_R = 0.65;
  const BARREL_H = 1.3;
  for (const b of barrelDefs) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(BARREL_R, BARREL_R, BARREL_H, 14),
      new THREE.MeshStandardMaterial({ color: b.c, roughness: 0.55 })
    );
    mesh.position.set(b.x, BARREL_H / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    obstacleMeshes.push(mesh);
    colliders.push({
      minX: b.x - BARREL_R,
      maxX: b.x + BARREL_R,
      minZ: b.z - BARREL_R,
      maxZ: b.z + BARREL_R,
    });
  }

  // ===== 장식: 스폰 구역 패드(평평, 충돌 없음) =====
  const padA = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 6),
    new THREE.MeshStandardMaterial({ color: 0x2f5f8f, roughness: 0.9 })
  );
  padA.rotation.x = -Math.PI / 2;
  padA.position.set(0, 0.02, 25);
  padA.receiveShadow = true;
  group.add(padA);

  const padB = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 6),
    new THREE.MeshStandardMaterial({ color: 0x8f3a35, roughness: 0.9 })
  );
  padB.rotation.x = -Math.PI / 2;
  padB.position.set(0, 0.02, -25);
  padB.receiveShadow = true;
  group.add(padB);

  const bounds = { minX: -39, maxX: 39, minZ: -29, maxZ: 29 };

  // 팀 A(아군) 스폰: +z 방향 / 팀 B(적군) 스폰: -z 방향
  const spawnA = [
    [-14, 24],
    [-7, 26],
    [0, 25],
    [7, 26],
    [14, 24],
  ];
  const spawnB = [
    [-14, -24],
    [-7, -26],
    [0, -25],
    [7, -26],
    [14, -24],
  ];

  return { group, colliders, obstacleMeshes, bounds, spawnA, spawnB };
}

// 원형(반경 radius) 엔티티를 장애물/경계와 충돌 해결
export function resolveCollision(pos, radius, colliders, bounds) {
  pos.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, pos.x));
  pos.z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, pos.z));

  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 === 0) {
        const penL = pos.x - c.minX;
        const penR = c.maxX - pos.x;
        const penT = pos.z - c.minZ;
        const penB = c.maxZ - pos.z;
        const min = Math.min(penL, penR, penT, penB);
        if (min === penL) pos.x = c.minX - radius;
        else if (min === penR) pos.x = c.maxX + radius;
        else if (min === penT) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      } else {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      }
    }
  }
  return pos;
}
