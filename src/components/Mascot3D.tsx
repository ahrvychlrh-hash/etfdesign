import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { CharacterId } from '../lib/characters'

/**
 * 장난감(비닐 피규어) 느낌의 3D 캐릭터. 외부 모델 파일 없이 기본 도형으로 만듭니다.
 * - 살짝 둥실거리고, 손을 흔들고, 눈을 깜빡이고, 포인터 쪽을 바라봅니다.
 */

interface Props {
  id: CharacterId
  /** 손 흔들기 등 동작 크기 (썸네일은 작게) */
  lively?: boolean
}

export default function Mascot3D({ id, lively = true }: Props) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.32, 6.4], fov: 28 }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#ffffff', '#9fb1ff', 0.9]} />
      <directionalLight position={[3, 5, 5]} intensity={1.7} />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#c4d0ff" />
      <Rig lively={lively}>
        {id === 'star' && <Star />}
        {id === 'momo' && <Momo />}
        {id === 'robo' && <Robo />}
      </Rig>
    </Canvas>
  )
}

/* ---------------- 공통 동작 ---------------- */

function Rig({ children, lively }: { children: React.ReactNode; lively: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock, pointer }) => {
    const g = ref.current
    if (!g) return
    const t = clock.getElapsedTime()
    g.position.y = -1.05 + Math.sin(t * 2) * 0.05
    const lookX = lively ? pointer.x * 0.5 : 0
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.sin(t * 0.7) * 0.22 + lookX, 0.06)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, lively ? -pointer.y * 0.12 : 0, 0.06)
    g.rotation.z = Math.sin(t * 1.3) * 0.03
    // 손 흔들기
    const wave = g.getObjectByName('waveArm')
    if (wave) wave.rotation.z = (lively ? 2.3 : 0.9) + Math.sin(t * (lively ? 6 : 2)) * (lively ? 0.35 : 0.1)
    // 눈 깜빡임 (약 4초마다)
    const blink = t % 4 < 0.12 ? 0.15 : 1
    g.traverse((o) => {
      if (o.name === 'eye') o.scale.y = blink
    })
  })
  return <group ref={ref}>{children}</group>
}

function toy(color: string, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, ...extra })
}

/** 반짝이는 검은 눈 + 하이라이트 */
function Eye({ position, r = 0.075 }: { position: [number, number, number]; r?: number }) {
  return (
    <group position={position} name="eye">
      <mesh scale={[1, 1.25, 0.6]}>
        <sphereGeometry args={[r, 24, 24]} />
        <meshPhysicalMaterial color="#141414" roughness={0.15} clearcoat={1} />
      </mesh>
      <mesh position={[r * 0.35, r * 0.45, r * 0.5]}>
        <sphereGeometry args={[r * 0.3, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

/** 웃는 입 (아래로 휜 호) */
function Smile({ position, r = 0.09, color = '#3a2a1f' }: { position: [number, number, number]; r?: number; color?: string }) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI]}>
      <torusGeometry args={[r, r * 0.24, 12, 32, Math.PI]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  )
}

function Cheek({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} scale={[1.3, 0.85, 0.35]}>
      <sphereGeometry args={[0.085, 20, 20]} />
      <meshStandardMaterial color="#ff9d8f" roughness={0.8} transparent opacity={0.9} />
    </mesh>
  )
}

function Capsule({
  r,
  len,
  material,
  ...props
}: { r: number; len: number; material: THREE.Material } & JSX.IntrinsicElements['mesh']) {
  return (
    <mesh {...props} material={material}>
      <capsuleGeometry args={[r, len, 10, 24]} />
    </mesh>
  )
}

/** 어깨를 축으로 도는 팔 */
function Arm({
  side,
  at,
  r,
  len,
  material,
  hand,
  wave,
}: {
  side: 1 | -1
  at: [number, number, number]
  r: number
  len: number
  material: THREE.Material
  hand?: THREE.Material
  wave?: boolean
}) {
  return (
    <group position={at} rotation={[0, 0, side * 0.55]} name={wave ? 'waveArm' : undefined}>
      <Capsule r={r} len={len} material={material} position={[0, -(len / 2 + r * 0.4), 0]} />
      {hand && (
        <mesh position={[0, -(len + r * 1.1), 0]} material={hand}>
          <sphereGeometry args={[r * 1.25, 20, 20]} />
        </mesh>
      )}
    </group>
  )
}

/* ---------------- 별이: 노란 별 + 파란 멜빵바지 ---------------- */

function starShape(outer: number, inner: number) {
  const s = new THREE.Shape()
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 === 0 ? outer : inner
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r))
  }
  // 꼭짓점을 둥글게 — 각 변의 중점을 잇고 꼭짓점을 제어점으로 사용
  const mid = (a: THREE.Vector2, b: THREE.Vector2) => a.clone().add(b).multiplyScalar(0.5)
  const start = mid(pts[9], pts[0])
  s.moveTo(start.x, start.y)
  for (let i = 0; i < 10; i++) {
    const p = pts[i]
    const m = mid(p, pts[(i + 1) % 10])
    s.quadraticCurveTo(p.x, p.y, m.x, m.y)
  }
  return s
}

function Star() {
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(starShape(0.86, 0.54), {
      depth: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.26,
      bevelSize: 0.2,
      bevelSegments: 10,
      curveSegments: 24,
    })
    g.center()
    g.computeVertexNormals()
    return g
  }, [])
  const yellow = useMemo(() => toy('#ffd84a', { emissive: new THREE.Color('#ffb300'), emissiveIntensity: 0.12 }), [])
  const blue = useMemo(() => toy('#2f6bff', { roughness: 0.55, clearcoat: 0.1 }), [])
  const gold = useMemo(() => toy('#ffb300', { metalness: 0.3, roughness: 0.3 }), [])
  const white = useMemo(() => toy('#ffffff'), [])

  return (
    <group>
      {/* 머리 */}
      <mesh geometry={geo} material={yellow} position={[0, 1.78, 0]} />
      <Eye position={[-0.18, 1.8, 0.44]} r={0.085} />
      <Eye position={[0.18, 1.8, 0.44]} r={0.085} />
      <Smile position={[0, 1.66, 0.45]} r={0.07} />
      <Cheek position={[-0.34, 1.66, 0.4]} />
      <Cheek position={[0.34, 1.66, 0.4]} />
      {/* 몸 */}
      <Capsule r={0.4} len={0.32} material={yellow} position={[0, 0.86, 0]} />
      {/* 멜빵바지 */}
      <mesh material={blue} position={[0, 0.72, 0]}>
        <capsuleGeometry args={[0.425, 0.2, 10, 24]} />
      </mesh>
      <mesh material={white} position={[0, 0.47, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.36, 0.035, 10, 40]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={blue} position={[s * 0.2, 0.98, 0.3]} rotation={[0.35, 0, s * 0.12]}>
          <boxGeometry args={[0.09, 0.42, 0.06]} />
        </mesh>
      ))}
      {/* 가슴 주머니의 동전 */}
      <mesh material={gold} position={[0, 0.78, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 32]} />
      </mesh>
      {/* 팔 */}
      <Arm side={-1} at={[-0.4, 1.02, 0]} r={0.11} len={0.3} material={yellow} />
      <Arm side={1} at={[0.4, 1.02, 0]} r={0.11} len={0.3} material={yellow} wave />
      {/* 다리·신발 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Capsule r={0.13} len={0.12} material={yellow} position={[s * 0.17, 0.3, 0]} />
          <mesh material={white} position={[s * 0.17, 0.12, 0.05]} scale={[1, 0.6, 1.35]}>
            <sphereGeometry args={[0.15, 20, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---------------- 몽이: 복슬복슬 파란 털뭉치 ---------------- */

function Momo() {
  const fur = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#3f6dff',
        roughness: 0.95,
        sheen: 1,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color('#b9ccff'),
      }),
    [],
  )
  const furLight = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#7d9dff', roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#e3eaff') }),
    [],
  )
  const white = useMemo(() => toy('#ffffff', { roughness: 0.2, clearcoat: 1 }), [])
  const pupil = useMemo(() => toy('#0b1450', { roughness: 0.1, clearcoat: 1 }), [])
  const feet = useMemo(() => toy('#2b4fd8', { roughness: 0.8 }), [])

  return (
    <group>
      {/* 몸통 겸 머리 */}
      <mesh material={fur} position={[0, 1.1, 0]} scale={[1, 0.95, 0.92]}>
        <sphereGeometry args={[0.88, 48, 48]} />
      </mesh>
      {/* 얼굴 둘레 밝은 털 */}
      <mesh material={furLight} position={[0, 1.2, 0.5]} scale={[1.05, 0.72, 0.5]}>
        <sphereGeometry args={[0.62, 40, 40]} />
      </mesh>
      {/* 귀 */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={fur} position={[s * 0.5, 1.84, -0.05]} rotation={[0, 0, -s * 0.45]}>
          <coneGeometry args={[0.2, 0.42, 24]} />
        </mesh>
      ))}
      {/* 큰 눈 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.25, 1.24, 0.74]} name="eye">
          <mesh material={white} scale={[1, 1.08, 0.55]}>
            <sphereGeometry args={[0.2, 32, 32]} />
          </mesh>
          <mesh material={pupil} position={[s * -0.02, -0.01, 0.07]} scale={[1, 1.05, 0.6]}>
            <sphereGeometry args={[0.145, 32, 32]} />
          </mesh>
          <mesh position={[0.05, 0.06, 0.16]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.06, 0.83]} scale={[1.3, 0.8, 0.7]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color="#0b1450" />
      </mesh>
      <Smile position={[0, 0.98, 0.82]} r={0.07} color="#0b1450" />
      {/* 팔 */}
      <Arm side={-1} at={[-0.78, 0.95, 0.05]} r={0.12} len={0.2} material={fur} />
      <Arm side={1} at={[0.78, 0.95, 0.05]} r={0.12} len={0.2} material={fur} wave />
      {/* 발 */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={feet} position={[s * 0.3, 0.2, 0.12]} scale={[1, 0.55, 1.3]}>
          <sphereGeometry args={[0.2, 24, 24]} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------------- 로보: 모니터 얼굴 로봇 ---------------- */

function Robo() {
  const head = useMemo(() => new RoundedBoxGeometry(1.12, 0.94, 0.86, 6, 0.22), [])
  const screen = useMemo(() => new RoundedBoxGeometry(0.84, 0.64, 0.1, 4, 0.08), [])
  const boot = useMemo(() => new RoundedBoxGeometry(0.26, 0.16, 0.34, 4, 0.07), [])
  const yellow = useMemo(() => toy('#ffc21a'), [])
  const white = useMemo(() => toy('#fbfbfb'), [])
  const black = useMemo(() => toy('#121212', { roughness: 0.1, clearcoat: 1 }), [])
  const pixel = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), [])
  const gray = useMemo(() => toy('#e2e5ee'), [])

  return (
    <group>
      {/* 머리 */}
      <mesh geometry={head} material={yellow} position={[0, 1.72, 0]} />
      <mesh geometry={screen} material={black} position={[0, 1.72, 0.41]} />
      {/* 화면 속 얼굴: 왼눈 막대, 오른눈 윙크(<), 입 */}
      <mesh material={pixel} position={[-0.17, 1.79, 0.47]} name="eye">
        <boxGeometry args={[0.07, 0.17, 0.01]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} material={pixel} position={[0.17, 1.79 + s * 0.035, 0.47]} rotation={[0, 0, s * 0.6]}>
          <boxGeometry args={[0.13, 0.05, 0.01]} />
        </mesh>
      ))}
      <mesh material={pixel} position={[0, 1.62, 0.47]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.08, 0.022, 8, 24, Math.PI]} />
      </mesh>
      {/* 헤드폰 */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={gray} position={[s * 0.6, 1.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.12, 32]} />
        </mesh>
      ))}
      <mesh material={gray} position={[0, 1.72, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.62, 0.035, 10, 48, Math.PI]} />
      </mesh>
      {/* 몸 */}
      <Capsule r={0.34} len={0.32} material={white} position={[0, 0.86, 0]} />
      <mesh material={yellow} position={[0, 0.9, 0.33]} scale={[1, 1, 0.35]}>
        <sphereGeometry args={[0.12, 24, 24]} />
      </mesh>
      {/* 팔 */}
      <Arm side={-1} at={[-0.33, 1.08, 0]} r={0.09} len={0.24} material={white} hand={yellow} />
      <Arm side={1} at={[0.33, 1.08, 0]} r={0.09} len={0.24} material={white} hand={yellow} wave />
      {/* 다리·부츠 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Capsule r={0.11} len={0.14} material={white} position={[s * 0.15, 0.36, 0]} />
          <mesh geometry={boot} material={yellow} position={[s * 0.16, 0.14, 0.04]} />
        </group>
      ))}
    </group>
  )
}
