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

/* ---------------- 가끔 하는 동작 ---------------- */

type MoveKind = 'spin' | 'wave' | 'jump' | 'happy'

/** 동작별 길이(초) */
const MOVES: Record<MoveKind, number> = { spin: 1.4, wave: 2.2, jump: 1.1, happy: 1.6 }

const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)

/** 다음 동작까지 7~14초 */
const nextGap = () => 7 + Math.random() * 7

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/* ---------------- 로봇 '모아' ---------------- */

function Robot({ lively }: { lively: boolean }) {
  const m = useMaterials()
  const root = useRef<THREE.Group>(null)
  // 동작(한 바퀴·점프 등)은 바라보기 회전과 섞이지 않게 안쪽 그룹에 줌
  const actor = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const move = useRef<{ kind: MoveKind; start: number } | null>(null)
  // 화면을 연 지 3초 뒤 첫 동작
  const nextAt = useRef(3)
  const lastKind = useRef<MoveKind | null>(null)
  const calm = useMemo(prefersReducedMotion, [])

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime()
    const g = root.current
    if (!g) return
    g.position.y = -1.2 + Math.sin(t * 2) * 0.06
    const lookX = lively ? pointer.x * 0.45 : 0
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.sin(t * 0.7) * 0.22 + lookX, 0.06)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, lively ? -pointer.y * 0.1 : 0, 0.06)

    // 가끔 다른 동작 — 같은 동작이 연달아 나오지 않게
    if (lively && (!calm || nextAt.current === 0) && !move.current && t >= nextAt.current) {
      const kinds = (Object.keys(MOVES) as MoveKind[]).filter((k) => k !== lastKind.current)
      const kind = kinds[Math.floor(Math.random() * kinds.length)]
      move.current = { kind, start: t }
      lastKind.current = kind
    }
    const mv = move.current
    const p = mv ? Math.min((t - mv.start) / MOVES[mv.kind], 1) : 0
    const a = actor.current
    let squint = false
    if (a) {
      a.rotation.y = mv?.kind === 'spin' ? easeInOut(p) * Math.PI * 2 : 0
      a.position.y =
        mv?.kind === 'spin'
          ? Math.sin(p * Math.PI) * 0.18
          : mv?.kind === 'jump'
            ? Math.abs(Math.sin(p * Math.PI * 2)) * 0.32
            : 0
      // 점프 착지 때 살짝 눌림
      const squash = mv?.kind === 'jump' ? Math.max(0, Math.cos(p * Math.PI * 4)) * 0.06 : 0
      a.scale.set(1 + squash, 1 - squash, 1 + squash)
    }
    // 오른팔을 몸 바깥으로 빼서 비스듬히 위로 들고 흔들며 인사
    if (armR.current) {
      const lift = mv?.kind === 'wave' ? Math.sin(Math.min(p * 4, 1) * (Math.PI / 2)) * (p > 0.8 ? (1 - p) / 0.2 : 1) : 0
      armR.current.rotation.z = -lift * (2 + Math.sin((t - (mv?.start ?? 0)) * 12) * 0.3)
      armR.current.position.x = 0.36 + lift * 0.35
      armR.current.position.y = 1 + lift * 0.08
    }
    // 고개 갸웃 (인사·기쁨 동작 땐 끄덕끄덕)
    if (head.current) {
      head.current.rotation.z = Math.sin(t * 1.1) * 0.06 + (mv?.kind === 'wave' ? Math.sin(p * Math.PI) * 0.12 : 0)
      head.current.rotation.x = mv?.kind === 'happy' ? Math.sin(p * Math.PI * 4) * 0.14 : 0
    }
    if (mv && (mv.kind === 'happy' || mv.kind === 'wave')) squint = true
    if (mv && p >= 1) {
      move.current = null
      nextAt.current = t + nextGap()
    }
    // 눈 깜빡임 (약 4초마다), 기쁠 땐 눈웃음
    if (eyes.current) eyes.current.scale.y = squint ? 0.45 : t % 4 < 0.12 ? 0.12 : 1
    // 안테나·동전이 은은하게 빛남
    const pulse = 0.75 + Math.sin(t * 3) * 0.25
    m.warm.color.setRGB(1, 0.85 + pulse * 0.1, 0.55 + pulse * 0.2)
    m.coin.emissiveIntensity = 0.4 + pulse * 0.35
  })

  return (
    // 누르면 바로 동작
    <group
      ref={root}
      onPointerDown={() => {
        if (!move.current) nextAt.current = 0
      }}
    >
      <group ref={actor}>
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
      {/* 왼팔은 동전을 안고, 오른팔은 어깨를 축으로 들어 인사할 수 있게 */}
      <Pill p={[-0.3, 0.86, 0.36]} r={0.11} len={0.22} m={m.blue} rot={[0.6, 0, -1.15]} />
      <group ref={armR} position={[0.36, 1.0, 0.14]}>
        <Pill p={[-0.06, -0.14, 0.22]} r={0.11} len={0.22} m={m.blue} rot={[0.6, 0, 1.15]} />
      </group>

      {/* 다리 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Pill p={[s * 0.19, 0.3, 0.02]} r={0.14} len={0.12} m={m.blue} />
          <Ball p={[s * 0.2, 0.14, 0.06]} r={0.15} m={m.blueDeep} s={[1, 0.55, 1.25]} />
        </group>
      ))}
      </group>
    </group>
  )
}
