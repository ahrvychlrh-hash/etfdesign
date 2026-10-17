import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 콤코미(양 + 소파) 3D 모델. 외부 모델 파일 없이 기본 도형으로 만듭니다.
 * - 둥실거리고, 양털 팔을 흔들고, 눈을 깜빡이고, 포인터 쪽을 바라봅니다.
 */

export default function Mascot3D({ lively = true }: { lively?: boolean }) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.3, 7], fov: 28 }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.85} />
      <hemisphereLight args={['#ffffff', '#c9b48f', 0.8]} />
      <directionalLight position={[3, 5, 5]} intensity={1.5} />
      <directionalLight position={[-4, 2, -3]} intensity={0.7} color="#c4d0ff" />
      <Rig lively={lively}>
        <Komkomi />
      </Rig>
    </Canvas>
  )
}

/* ---------------- 동작 ---------------- */

function Rig({ children, lively }: { children: React.ReactNode; lively: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock, pointer }) => {
    const g = ref.current
    if (!g) return
    const t = clock.getElapsedTime()
    g.position.y = -1.2 + Math.abs(Math.sin(t * 2)) * 0.06
    const lookX = lively ? pointer.x * 0.45 : 0
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.sin(t * 0.7) * 0.25 + lookX, 0.06)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, lively ? -pointer.y * 0.1 : 0, 0.06)
    g.rotation.z = Math.sin(t * 2) * 0.035
    // 오른팔 흔들기 (어깨 축)
    const arm = g.getObjectByName('waveArm')
    if (arm) arm.rotation.z = lively ? -0.35 + Math.sin(t * 5) * 0.35 : Math.sin(t * 2) * 0.08
    // 눈 깜빡임 (약 4초마다)
    const blink = t % 4 < 0.12 ? 0.12 : 1
    g.traverse((o) => {
      if (o.name === 'eye') o.scale.y = blink
    })
  })
  return <group ref={ref}>{children}</group>
}

/* ---------------- 재질 ---------------- */

function useMaterials() {
  return useMemo(
    () => ({
      wool: new THREE.MeshPhysicalMaterial({
        color: '#ffefd2',
        roughness: 0.92,
        sheen: 1,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color('#fff6e6'),
      }),
      face: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.45, clearcoat: 0.3 }),
      belly: new THREE.MeshPhysicalMaterial({ color: '#fbe6e2', roughness: 0.6 }),
      brown: new THREE.MeshPhysicalMaterial({ color: '#7d4f10', roughness: 0.45, clearcoat: 0.4 }),
      ink: new THREE.MeshPhysicalMaterial({ color: '#161210', roughness: 0.15, clearcoat: 1 }),
      cheek: new THREE.MeshStandardMaterial({ color: '#ffb3b8', roughness: 0.9, transparent: true, opacity: 0.85 }),
      tail: new THREE.MeshPhysicalMaterial({ color: '#fbf8f0', roughness: 0.9, sheen: 1 }),
    }),
    [],
  )
}

type Vec3 = [number, number, number]

/** 양털 덩어리: 가운데 큰 공 + 테두리 작은 공들로 뭉게구름 모양 */
function Fluff({
  center,
  rx,
  ry,
  rz,
  bumps,
  bumpR,
  material,
}: {
  center: Vec3
  rx: number
  ry: number
  rz: number
  bumps: number
  bumpR: number
  material: THREE.Material
}) {
  const pts = useMemo(() => {
    const out: { p: Vec3; r: number }[] = []
    // 정면에서 보이는 둘레
    for (let i = 0; i < bumps; i++) {
      const a = (i / bumps) * Math.PI * 2 + 0.2
      out.push({ p: [Math.cos(a) * rx, Math.sin(a) * ry, 0], r: bumpR })
    }
    // 앞뒤 볼륨감
    for (let i = 0; i < Math.round(bumps * 0.4); i++) {
      const a = (i / Math.round(bumps * 0.4)) * Math.PI * 2
      for (const s of [1, -1]) {
        out.push({ p: [Math.cos(a) * rx * 0.55, Math.sin(a) * ry * 0.55, s * rz * 0.78], r: bumpR * 0.8 })
      }
    }
    return out
  }, [rx, ry, rz, bumps, bumpR])

  return (
    <group position={center}>
      <mesh material={material} scale={[rx, ry, rz]}>
        <sphereGeometry args={[1, 40, 40]} />
      </mesh>
      {pts.map((b, i) => (
        <mesh key={i} material={material} position={b.p}>
          <sphereGeometry args={[b.r, 20, 20]} />
        </mesh>
      ))}
    </group>
  )
}

/** 바깥에서 안쪽으로 말려 들어가는 뿔 */
class SpiralCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private side: 1 | -1) {
    super()
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const turns = 1.25
    const a = Math.PI * 0.55 + t * turns * Math.PI * 2 * -this.side
    const r = 0.3 * (1 - t * 0.78)
    return target.set(Math.cos(a) * r * this.side * -1, Math.sin(a) * r, t * 0.05)
  }
}

function Horn({ side, material }: { side: 1 | -1; material: THREE.Material }) {
  const geo = useMemo(() => new THREE.TubeGeometry(new SpiralCurve(side), 80, 0.1, 16, false), [side])
  return (
    <group position={[side * 0.92, 2.26, 0.18]} rotation={[0, side * 0.35, 0]}>
      <mesh geometry={geo} material={material} />
      {/* 뿔 끝·시작을 둥글게 */}
      <mesh material={material} position={new SpiralCurve(side).getPoint(0)}>
        <sphereGeometry args={[0.1, 16, 16]} />
      </mesh>
      <mesh material={material} position={new SpiralCurve(side).getPoint(1)}>
        <sphereGeometry args={[0.1, 16, 16]} />
      </mesh>
    </group>
  )
}

function Eye({ position }: { position: Vec3 }) {
  return (
    <group position={position} name="eye">
      <mesh scale={[1, 1.1, 0.5]}>
        <sphereGeometry args={[0.06, 24, 24]} />
        <meshPhysicalMaterial color="#161210" roughness={0.1} clearcoat={1} />
      </mesh>
      <mesh position={[0.02, 0.025, 0.03]}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

/* ---------------- 콤코미 ---------------- */

function Komkomi() {
  const m = useMaterials()
  const arc = (r: number) => <torusGeometry args={[r, 0.012, 8, 24, Math.PI]} />

  return (
    <group>
      {/* 몸 = 큰 양털 소파 */}
      <Fluff center={[0, 1.5, 0]} rx={0.95} ry={0.98} rz={0.82} bumps={16} bumpR={0.28} material={m.wool} />

      {/* 얼굴 */}
      <mesh material={m.face} position={[0, 1.76, 0.7]} scale={[0.48, 0.4, 0.22]}>
        <sphereGeometry args={[1, 40, 40]} />
      </mesh>
      {/* 이마 위 양털 앞머리 */}
      {[-0.27, -0.13, 0, 0.13, 0.27].map((x, i) => (
        <mesh key={i} material={m.wool} position={[x * 1.15, 2.12 - Math.abs(x) * 0.3, 0.8]}>
          <sphereGeometry args={[0.13, 16, 16]} />
        </mesh>
      ))}
      <Eye position={[-0.16, 1.8, 0.91]} />
      <Eye position={[0.16, 1.8, 0.91]} />
      {/* 코 */}
      <mesh material={m.ink} position={[0, 1.7, 0.93]} scale={[1.3, 0.9, 0.6]}>
        <sphereGeometry args={[0.03, 12, 12]} />
      </mesh>
      {/* ω 입 */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={m.ink} position={[s * 0.045, 1.64, 0.925]} rotation={[0, 0, Math.PI]}>
          {arc(0.045)}
        </mesh>
      ))}
      <mesh material={m.cheek} position={[-0.32, 1.68, 0.84]} scale={[1.3, 0.8, 0.35]}>
        <sphereGeometry args={[0.07, 16, 16]} />
      </mesh>
      <mesh material={m.cheek} position={[0.32, 1.68, 0.84]} scale={[1.3, 0.8, 0.35]}>
        <sphereGeometry args={[0.07, 16, 16]} />
      </mesh>

      {/* 뿔 */}
      <Horn side={-1} material={m.brown} />
      <Horn side={1} material={m.brown} />

      {/* 배 + 배꼽(x) */}
      <mesh material={m.belly} position={[0, 1.12, 0.7]} scale={[0.42, 0.24, 0.16]}>
        <sphereGeometry args={[1, 32, 32]} />
      </mesh>
      {[0.7, -0.7].map((r) => (
        <mesh key={r} material={m.ink} position={[0.02, 1.12, 0.86]} rotation={[0, 0, r]}>
          <boxGeometry args={[0.07, 0.012, 0.01]} />
        </mesh>
      ))}

      {/* 양털 팔: 어깨에서 배 쪽으로 감싸는 모양 */}
      <WoolArm side={-1} material={m.wool} />
      <group name="waveArm" position={[0.78, 1.34, 0.3]}>
        <group position={[-0.78, -1.34, -0.3]}>
          <WoolArm side={1} material={m.wool} />
        </group>
      </group>

      {/* 다리·신발 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={m.brown} position={[s * 0.38, 0.36, 0.05]} rotation={[0, 0, s * -0.08]}>
            <capsuleGeometry args={[0.055, 0.46, 8, 16]} />
          </mesh>
          <mesh material={m.brown} position={[s * 0.42, 0.08, 0.1]} scale={[1.2, 0.6, 1.4]}>
            <sphereGeometry args={[0.13, 20, 20]} />
          </mesh>
        </group>
      ))}

      {/* 뒤쪽 하얀 꼬리 */}
      <Fluff center={[0, 1.1, -0.82]} rx={0.12} ry={0.11} rz={0.08} bumps={6} bumpR={0.07} material={m.tail} />
    </group>
  )
}

function WoolArm({ side, material }: { side: 1 | -1; material: THREE.Material }) {
  // 어깨(바깥 위) → 손(배 앞 안쪽)으로 이어지는 양털 뭉치
  const pts: { p: Vec3; r: number }[] = [
    { p: [side * 0.86, 1.26, 0.32], r: 0.2 },
    { p: [side * 0.78, 1.12, 0.5], r: 0.21 },
    { p: [side * 0.64, 1.04, 0.66], r: 0.19 },
    { p: [side * 0.5, 1.06, 0.76], r: 0.15 },
    { p: [side * 0.9, 1.09, 0.4], r: 0.16 },
  ]
  return (
    <group>
      {pts.map((b, i) => (
        <mesh key={i} material={material} position={b.p}>
          <sphereGeometry args={[b.r, 20, 20]} />
        </mesh>
      ))}
    </group>
  )
}
