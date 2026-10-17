import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterId } from '../lib/characters'

/**
 * 비닐 피규어 느낌의 3D 캐릭터 3종 (양·소·오리). 외부 모델 파일 없이 기본 도형으로 만듭니다.
 * - 둥실거리고, 손을 흔들고, 눈을 깜빡이고, 포인터 쪽을 바라봅니다.
 */

export default function Mascot3D({ id, lively = true }: { id: CharacterId; lively?: boolean }) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.32, 7], fov: 28 }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.85} />
      <hemisphereLight args={['#ffffff', '#c8c2b0', 0.8]} />
      <directionalLight position={[3, 5, 5]} intensity={1.5} />
      <directionalLight position={[-4, 2, -3]} intensity={0.7} color="#c4d0ff" />
      <Rig lively={lively}>
        {id === 'sheep' && <Sheep />}
        {id === 'cow' && <Cow />}
        {id === 'duck' && <Duck />}
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
    g.position.y = -1.25 + Math.abs(Math.sin(t * 2)) * 0.06
    const lookX = lively ? pointer.x * 0.45 : 0
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.sin(t * 0.7) * 0.25 + lookX, 0.06)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, lively ? -pointer.y * 0.1 : 0, 0.06)
    g.rotation.z = Math.sin(t * 2) * 0.035
    const arm = g.getObjectByName('waveArm')
    if (arm) arm.rotation.z = lively ? 2.2 + Math.sin(t * 6) * 0.35 : 0.35 + Math.sin(t * 2) * 0.08
    const blink = t % 4 < 0.12 ? 0.12 : 1
    g.traverse((o) => {
      if (o.name === 'eye') o.scale.y = blink
    })
  })
  return <group ref={ref}>{children}</group>
}

/* ---------------- 공통 부품 ---------------- */

type Vec3 = [number, number, number]

function toy(color: string, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.5, ...extra })
}

function fluffy(color: string, sheen = '#ffffff') {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.95,
    sheen: 1,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(sheen),
  })
}

const INK = new THREE.MeshPhysicalMaterial({ color: '#2a1d16', roughness: 0.2, clearcoat: 1 })
const CHEEK = new THREE.MeshStandardMaterial({ color: '#ff9fa8', roughness: 0.9, transparent: true, opacity: 0.7 })

function Ball({ p, r, m, s = [1, 1, 1], rot }: { p: Vec3; r: number; m: THREE.Material; s?: Vec3; rot?: Vec3 }) {
  return (
    <mesh position={p} scale={s} rotation={rot} material={m}>
      <sphereGeometry args={[r, 32, 32]} />
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

/** 호(반원) 선: up=true면 ∩, false면 ∪ */
function Arc({ p, r, up, thick = 0.016, m = INK }: { p: Vec3; r: number; up: boolean; thick?: number; m?: THREE.Material }) {
  return (
    <mesh position={p} rotation={[0, 0, up ? 0 : Math.PI]} material={m}>
      <torusGeometry args={[r, thick, 10, 32, Math.PI]} />
    </mesh>
  )
}

function DotEye({ p, r = 0.06 }: { p: Vec3; r?: number }) {
  return (
    <group position={p} name="eye">
      <mesh scale={[0.8, 1.2, 0.5]} material={INK}>
        <sphereGeometry args={[r, 24, 24]} />
      </mesh>
      <mesh position={[r * 0.3, r * 0.5, r * 0.3]}>
        <sphereGeometry args={[r * 0.28, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

/** 어깨를 축으로 도는 팔 (wave면 흔드는 팔) */
function Arm({ side, at, r, len, m, tip, wave }: { side: 1 | -1; at: Vec3; r: number; len: number; m: THREE.Material; tip?: THREE.Material; wave?: boolean }) {
  return (
    <group position={at} rotation={[0, 0, side * 0.35]} name={wave ? 'waveArm' : undefined}>
      <Pill p={[0, -(len / 2 + r * 0.3), 0]} r={r} len={len} m={m} />
      {tip && <Ball p={[0, -(len + r * 0.9), 0]} r={r * 1.02} m={tip} s={[1, 0.6, 1]} />}
    </group>
  )
}

/* ---------------- 양: 몽실이 ---------------- */

function Sheep() {
  const wool = useMemo(() => fluffy('#fffaf0', '#ffffff'), [])
  const face = useMemo(() => toy('#fbe4d8', { roughness: 0.7, clearcoat: 0 }), [])
  const ear = useMemo(() => toy('#f3e2d0', { roughness: 0.7 }), [])
  const earIn = useMemo(() => toy('#f6c2b6', { roughness: 0.8 }), [])
  const horn = useMemo(() => toy('#e8d6b8'), [])
  const knit = useMemo(() => toy('#f9e27d', { roughness: 0.85, clearcoat: 0 }), [])
  const hoof = useMemo(() => toy('#3b4060'), [])

  const headRing = useMemo(() => {
    const out: Vec3[] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      out.push([Math.cos(a) * 0.62, 1.78 + Math.sin(a) * 0.56, 0.12])
    }
    return out
  }, [])
  const bottom = useMemo(() => {
    const out: Vec3[] = []
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      out.push([Math.cos(a) * 0.42, 0.62 + Math.sin(a) * 0.14, Math.sin(a) * 0.3])
    }
    return out
  }, [])

  return (
    <group>
      {/* 머리 양털 */}
      <Ball p={[0, 1.82, -0.12]} r={0.72} m={wool} />
      {headRing.map((p, i) => (
        <Ball key={i} p={p} r={0.27} m={wool} />
      ))}
      <Ball p={[0, 2.38, 0.18]} r={0.24} m={wool} />
      {/* 얼굴 */}
      <Ball p={[0, 1.72, 0.32]} r={0.5} m={face} s={[1, 0.88, 0.7]} />
      <Arc p={[-0.17, 1.76, 0.67]} r={0.07} up />
      <Arc p={[0.17, 1.76, 0.67]} r={0.07} up />
      <Ball p={[0, 1.64, 0.68]} r={0.025} m={INK} s={[1.4, 1, 0.6]} />
      <Arc p={[-0.035, 1.6, 0.68]} r={0.035} up={false} thick={0.011} />
      <Arc p={[0.035, 1.6, 0.68]} r={0.035} up={false} thick={0.011} />
      <Ball p={[-0.3, 1.62, 0.6]} r={0.07} m={CHEEK} s={[1.3, 0.8, 0.4]} />
      <Ball p={[0.3, 1.62, 0.6]} r={0.07} m={CHEEK} s={[1.3, 0.8, 0.4]} />
      {/* 늘어진 귀 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.82, 1.78, 0.05]} rotation={[0, 0, s * -0.45]}>
          <Ball p={[s * 0.12, 0, 0]} r={0.26} m={ear} s={[1.35, 0.5, 0.35]} />
          <Ball p={[s * 0.14, 0, 0.05]} r={0.2} m={earIn} s={[1.3, 0.38, 0.2]} />
        </group>
      ))}
      {/* 작은 뿔 */}
      {[-1, 1].map((s) => (
        <Pill key={s} p={[s * 0.42, 2.38, -0.05]} r={0.07} len={0.16} m={horn} rot={[0, 0, s * -0.7]} />
      ))}
      {/* 노란 니트 + 리본 */}
      <mesh position={[0, 1.04, 0]} scale={[1, 1, 0.82]} material={knit}>
        <cylinderGeometry args={[0.44, 0.56, 0.42, 40]} />
      </mesh>
      <Ball p={[0, 1.25, 0]} r={0.44} m={knit} s={[1, 0.3, 0.82]} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.08, 1.15, 0.43]} rotation={[0, 0, s * 0.5]} material={knit} scale={[1, 0.7, 1]}>
          <torusGeometry args={[0.065, 0.02, 10, 24]} />
        </mesh>
      ))}
      <Ball p={[0, 1.15, 0.45]} r={0.035} m={knit} />
      {/* 아래 양털 */}
      {bottom.map((p, i) => (
        <Ball key={i} p={p} r={0.26} m={wool} />
      ))}
      <Ball p={[0, 0.62, 0]} r={0.46} m={wool} s={[1, 0.6, 0.8]} />
      {/* 팔 */}
      <Arm side={-1} at={[-0.5, 1.15, 0]} r={0.1} len={0.22} m={face} tip={hoof} />
      <Arm side={1} at={[0.5, 1.15, 0]} r={0.1} len={0.22} m={face} tip={hoof} wave />
      {/* 다리 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Pill p={[s * 0.2, 0.28, 0]} r={0.12} len={0.14} m={face} />
          <Ball p={[s * 0.2, 0.12, 0.02]} r={0.125} m={hoof} s={[1, 0.55, 1.05]} />
        </group>
      ))}
    </group>
  )
}

/* ---------------- 소: 음메 ---------------- */

function Cow() {
  const skin = useMemo(() => toy('#f5c55c'), [])
  const muzzle = useMemo(() => toy('#fbe7bd'), [])
  const horn = useMemo(() => toy('#fbf1dc'), [])
  const shirt = useMemo(() => toy('#fdf9ef', { roughness: 0.7 }), [])
  const overall = useMemo(() => toy('#b8d65b', { roughness: 0.65 }), [])

  return (
    <group>
      {/* 머리 */}
      <Ball p={[0, 1.78, 0]} r={0.78} m={skin} s={[1.06, 0.95, 0.92]} />
      <Ball p={[0, 1.5, 0.42]} r={0.55} m={muzzle} s={[1.02, 0.62, 0.62]} />
      {/* 앞머리 */}
      <Ball p={[0, 2.55, 0.05]} r={0.12} m={skin} />
      <Ball p={[-0.13, 2.5, 0.08]} r={0.1} m={skin} />
      <Ball p={[0.13, 2.5, 0.08]} r={0.1} m={skin} />
      {/* 눈·눈썹 */}
      <DotEye p={[-0.22, 1.9, 0.7]} r={0.065} />
      <DotEye p={[0.22, 1.9, 0.7]} r={0.065} />
      <Arc p={[-0.24, 2.06, 0.67]} r={0.08} up thick={0.013} />
      <Arc p={[0.24, 2.06, 0.67]} r={0.08} up thick={0.013} />
      {/* 콧구멍·입 */}
      <Ball p={[-0.12, 1.6, 0.76]} r={0.03} m={INK} s={[1.3, 0.9, 0.6]} />
      <Ball p={[0.12, 1.6, 0.76]} r={0.03} m={INK} s={[1.3, 0.9, 0.6]} />
      <Arc p={[0, 1.44, 0.75]} r={0.11} up={false} thick={0.014} />
      {/* 뿔 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.44, 2.45, 0]} rotation={[0, 0, s * -0.55]} material={horn}>
          <coneGeometry args={[0.12, 0.34, 24]} />
        </mesh>
      ))}
      {/* 귀 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.86, 2.0, 0]} rotation={[0, 0, s * 0.3]}>
          <Ball p={[0, 0, 0]} r={0.22} m={skin} s={[1.4, 0.75, 0.5]} />
          <Ball p={[0, 0, 0.06]} r={0.16} m={muzzle} s={[1.3, 0.6, 0.3]} />
        </group>
      ))}
      {/* 흰 티셔츠 */}
      <Pill p={[0, 0.98, 0]} r={0.42} len={0.16} m={shirt} />
      {/* 초록 멜빵바지 */}
      <mesh position={[0, 0.66, 0]} material={overall}>
        <cylinderGeometry args={[0.45, 0.46, 0.5, 40]} />
      </mesh>
      <Ball p={[0, 0.42, 0]} r={0.46} m={overall} s={[1, 0.35, 1]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.24, 1.0, 0.38]} rotation={[0.25, 0, 0]} material={overall}>
            <boxGeometry args={[0.1, 0.36, 0.05]} />
          </mesh>
          <mesh position={[s * 0.24, 0.86, 0.45]} rotation={[Math.PI / 2, 0, 0]} material={shirt}>
            <cylinderGeometry args={[0.055, 0.055, 0.03, 24]} />
          </mesh>
        </group>
      ))}
      {/* 팔 */}
      <Arm side={-1} at={[-0.45, 1.08, 0]} r={0.12} len={0.22} m={skin} />
      <Arm side={1} at={[0.45, 1.08, 0]} r={0.12} len={0.22} m={skin} wave />
      {/* 다리 */}
      {[-1, 1].map((s) => (
        <Pill key={s} p={[s * 0.2, 0.22, 0.02]} r={0.15} len={0.12} m={skin} />
      ))}
    </group>
  )
}

/* ---------------- 오리: 덕구 ---------------- */

function Duck() {
  const white = useMemo(() => toy('#fbfbf7', { roughness: 0.55 }), [])
  const bill = useMemo(() => toy('#ff7a1c', { roughness: 0.45 }), [])
  const boot = useMemo(() => toy('#ff7a1c', { roughness: 0.5 }), [])

  return (
    <group>
      {/* 넓적한 머리 */}
      <Ball p={[0, 1.95, 0]} r={0.62} m={white} s={[1.15, 0.8, 0.95]} />
      <Ball p={[0, 1.66, 0]} r={0.62} m={white} s={[1.5, 0.62, 1]} />
      {/* 머리 위 한 가닥 */}
      <mesh position={[0, 2.5, 0]} rotation={[0, 0, 0.3]} material={white}>
        <torusGeometry args={[0.07, 0.022, 10, 24, Math.PI * 1.3]} />
      </mesh>
      {/* 이마의 주황 컬 */}
      <mesh position={[0, 2.08, 0.6]} material={bill}>
        <torusGeometry args={[0.04, 0.012, 8, 24, Math.PI * 1.6]} />
      </mesh>
      {/* 졸린 눈 */}
      <Arc p={[-0.26, 1.9, 0.63]} r={0.08} up={false} thick={0.014} />
      <Arc p={[0.26, 1.9, 0.63]} r={0.08} up={false} thick={0.014} />
      {/* 부리 */}
      <Ball p={[0, 1.66, 0.62]} r={0.36} m={bill} s={[1.3, 0.34, 0.75]} />
      <Ball p={[0, 1.6, 0.58]} r={0.3} m={bill} s={[1.25, 0.3, 0.7]} />
      {/* 볼 */}
      <Ball p={[-0.78, 1.7, 0.36]} r={0.12} m={CHEEK} s={[0.6, 1, 1]} />
      <Ball p={[0.78, 1.7, 0.36]} r={0.12} m={CHEEK} s={[0.6, 1, 1]} />
      {/* 몸 */}
      <Pill p={[0, 0.85, 0]} r={0.38} len={0.3} m={white} />
      {/* 팔짱 */}
      <Pill p={[0, 0.98, 0.33]} r={0.11} len={0.48} m={white} rot={[0, 0.15, Math.PI / 2 - 0.22]} />
      <Pill p={[0, 0.9, 0.36]} r={0.11} len={0.48} m={white} rot={[0, -0.15, Math.PI / 2 + 0.22]} />
      {/* 주황 장화 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.17, 0.27, 0]} material={boot}>
            <cylinderGeometry args={[0.13, 0.14, 0.42, 24]} />
          </mesh>
          <Ball p={[s * 0.17, 0.08, 0.05]} r={0.15} m={boot} s={[1, 0.55, 1.3]} />
        </group>
      ))}
    </group>
  )
}
