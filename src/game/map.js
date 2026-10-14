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

  // 장애물 정의 { x, z, w, h, d, color }
  const defs = [
    { x: 0, z: 0, w: 6, h: 2.5, d: 6, color: 0x8a6a4a },      // 중앙 크레이트
    { x: -14, z: -10, w: 3.2, h: 2, d: 3.2, color: 0x777c82 },
    { x: 14, z: -10, w: 3.2, h: 2, d: 3.2, color: 0x777c82 },
    { x: -14, z: 10, w: 3.2, h: 2, d: 3.2, color: 0x777c82 },
    { x: 14, z: 10, w: 3.2, h: 2, d: 3.2, color: 0x777c82 },
    { x: -8, z: -18, w: 2.2, h: 1.8, d: 5, color: 0x5c636b },
    { x: 8, z: -18, w: 2.2, h: 1.8, d: 5, color: 0x5c636b },
    { x: -8, z: 18, w: 2.2, h: 1.8, d: 5, color: 0x5c636b },
    { x: 8, z: 18, w: 2.2, h: 1.8, d: 5, color: 0x5c636b },
    { x: -22, z: 0, w: 3, h: 2.2, d: 3, color: 0x6b737b },
    { x: 22, z: 0, w: 3, h: 2.2, d: 3, color: 0x6b737b },
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
