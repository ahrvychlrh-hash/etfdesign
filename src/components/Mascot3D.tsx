import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 메인 캐릭터 '모아' — 반짝이는 동전을 안고 있는 작은 로봇.
 * 외부 모델 파일 없이 기본 도형으로 만들고, 둥실거리기·눈 깜빡임·안테나와 동전 빛남·포인터 바라보기 동작을 넣었습니다.
 */

export default function Mascot3D({ lively = true }: { lively?: boolean }) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.35, 7], fov: 28 }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#ffffff', '#b9cdf0', 0.9]} />
      <directionalLight position={[3, 5, 5]} intensity={1.5} />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#cfe0ff" />
      <Robot lively={lively} />
    </Canvas>
  )
}

/* ---------------- 재질 ---------------- */

function useMaterials() {
  return useMemo(
    () => ({
      shell: new THREE.MeshPhysicalMaterial({ color: '#f8fafd', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 }),
      blue: new THREE.MeshPhysicalMaterial({ color: '#8cc8ff', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      blueDeep: new THREE.MeshPhysicalMaterial({ color: '#5aa9f5', roughness: 0.35, clearcoat: 0.6 }),
      visor: new THREE.MeshPhysicalMaterial({ color: '#1d2d55', roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }),
      glow: new THREE.MeshBasicMaterial({ color: '#8ff4ff' }),
      warm: new THREE.MeshBasicMaterial({ color: '#ffe39a' }),
      coin: new THREE.MeshPhysicalMaterial({
        color: '#ffcb45',
        emissive: new THREE.Color('#ffb21a'),
        emissiveIntensity: 0.55,
        roughness: 0.3,
        metalness: 0.4,
        clearcoat: 1,
      }),
      coinFace: new THREE.MeshBasicMaterial({ color: '#fff3c4' }),
    }),
    [],
  )
}

type Vec3 = [number, number, number]

function Ball({ p, r, m, s = [1, 1, 1] }: { p: Vec3; r: number; m: THREE.Material; s?: Vec3 }) {
  return (
    <mesh position={p} scale={s} material={m}>
      <sphereGeometry args={[r, 40, 40]} />
    </mesh>
  )
}

function Pill({ p, r, len, m, rot }: { p: Vec3; r: number; len: number; m: THREE.Material; rot?: Vec3 }) {
  return (
    <mesh position={p} rotation={rot} material={m}>
      <capsuleGeometry args={[r, len, 10, 24]} />
    </mesh>
  )
}

/* ---------------- 로봇 '모아' ---------------- */

function Robot({ lively }: { lively: boolean }) {
  const m = useMaterials()
  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.Group>(null)

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime()
    const g = root.current
    if (!g) return
    g.position.y = -1.2 + Math.sin(t * 2) * 0.06
    const lookX = lively ? pointer.x * 0.45 : 0
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.sin(t * 0.7) * 0.22 + lookX, 0.06)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, lively ? -pointer.y * 0.1 : 0, 0.06)
    // 고개 갸웃
    if (head.current) head.current.rotation.z = Math.sin(t * 1.1) * 0.06
    // 눈 깜빡임 (약 4초마다)
    if (eyes.current) eyes.current.scale.y = t % 4 < 0.12 ? 0.12 : 1
    // 안테나·동전이 은은하게 빛남
    const pulse = 0.75 + Math.sin(t * 3) * 0.25
    m.warm.color.setRGB(1, 0.85 + pulse * 0.1, 0.55 + pulse * 0.2)
    m.coin.emissiveIntensity = 0.4 + pulse * 0.35
  })

  return (
    <group ref={root}>
      {/* 머리 */}
      <group ref={head} position={[0, 1.78, 0]}>
        <Ball p={[0, 0, 0]} r={0.86} m={m.shell} s={[1.18, 0.9, 0.95]} />
        {/* 정수리 패널 선 */}
        <mesh position={[0, 0.5, 0.18]} rotation={[-0.35, 0, 0]} material={m.blue}>
          <torusGeometry args={[0.36, 0.012, 8, 40, Math.PI]} />
        </mesh>
        {/* 유리 얼굴 */}
        <Ball p={[0, -0.06, 0.5]} r={0.62} m={m.visor} s={[1.18, 0.7, 0.55]} />
        {/* 빛나는 눈 */}
        <group ref={eyes} position={[0, -0.02, 0.83]}>
          <Ball p={[-0.27, 0, 0]} r={0.12} m={m.glow} s={[1, 1.12, 0.35]} />
          <Ball p={[0.27, 0, 0]} r={0.12} m={m.glow} s={[1, 1.12, 0.35]} />
        </group>
        {/* 미소 */}
        <mesh position={[0, -0.2, 0.85]} rotation={[0, 0, Math.PI]} material={m.glow}>
          <torusGeometry args={[0.07, 0.016, 8, 24, Math.PI]} />
        </mesh>
        {/* 헤드폰 귀 */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.98, -0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh material={m.blue}>
              <cylinderGeometry args={[0.24, 0.24, 0.16, 40]} />
            </mesh>
            <mesh position={[0, s * -0.085, 0]} material={m.blueDeep}>
              <torusGeometry args={[0.15, 0.035, 12, 40]} />
            </mesh>
          </group>
        ))}
        {/* 안테나 */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.38, 0.62, 0]} rotation={[0, 0, s * -0.32]}>
            <mesh position={[0, 0.2, 0]} material={m.blue}>
              <cylinderGeometry args={[0.03, 0.03, 0.4, 16]} />
            </mesh>
            <Ball p={[0, 0.44, 0]} r={0.075} m={s === 1 ? m.warm : m.shell} />
          </group>
        ))}
      </group>

      {/* 몸 */}
      <Pill p={[0, 0.82, 0]} r={0.4} len={0.2} m={m.shell} />
      <Ball p={[0, 0.82, 0.3]} r={0.22} m={m.blue} s={[1, 1, 0.3]} />

      {/* 두 팔로 안은 빛나는 동전 */}
      <group position={[0, 0.88, 0.5]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
        <mesh material={m.coin}>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 40]} />
        </mesh>
        <mesh position={[0, 0.032, 0]} material={m.coinFace}>
          <cylinderGeometry args={[0.13, 0.13, 0.005, 40]} />
        </mesh>
      </group>
      <pointLight position={[0, 0.9, 0.9]} color="#ffd36a" intensity={1.2} distance={1.6} />
      {[-1, 1].map((s) => (
        <Pill key={s} p={[s * 0.3, 0.86, 0.36]} r={0.11} len={0.22} m={m.blue} rot={[0.6, 0, s * 1.15]} />
      ))}

      {/* 다리 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Pill p={[s * 0.19, 0.3, 0.02]} r={0.14} len={0.12} m={m.blue} />
          <Ball p={[s * 0.2, 0.14, 0.06]} r={0.15} m={m.blueDeep} s={[1, 0.55, 1.25]} />
        </group>
      ))}
    </group>
  )
}
