"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Loader, PerspectiveCamera } from "@react-three/drei";
import { Suspense } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { Leva } from "leva";
import { SceneEnvironment } from "./SceneEnvironment";
import { PostProcessingEffects } from "./PostProcessingEffects";
import AvatarModel from "./AvatarModel";
import * as THREE from "three";

export default function AvatarCanvas() {
    const avatarUrl = useSettingsStore(s => s.avatarUrl);

    return (
        <div className="w-full h-screen relative bg-slate-950 overflow-hidden">
            {/* Debug UI Panel (Hidden in production, toggle via 'h' key ideally) */}
            <div className="absolute top-0 right-0 z-50">
                <Leva fill collapsed />
            </div>

            <Canvas
                shadows
                dpr={[1, 2]}
                gl={{
                    antialias: false, // PostProcessingのSMAAに任せる
                    stencil: false,
                    depth: true, // Depthは必要
                    toneMapping: THREE.NoToneMapping, // ★Canvas側は無効化 (PP側で制御)
                }}
                className="w-full h-full"
            >
                <PerspectiveCamera makeDefault position={[0, 1.35, 1.2]} fov={35} /> {/* FOVを少し望遠にして歪みを減らす */}

                <Suspense fallback={null}>
                    <color attach="background" args={['#1a1b26']} />

                    <SceneEnvironment />
                    <AvatarModel url={avatarUrl} />
                    <PostProcessingEffects />
                </Suspense>

                <OrbitControls
                    target={[0, 1.35, 0]}
                    minDistance={0.8}
                    maxDistance={2.5}
                    enablePan={false}
                    maxPolarAngle={Math.PI / 1.8}
                />
            </Canvas>

            <Loader
                containerStyles={{ background: 'rgba(26, 27, 38, 0.95)' }}
                dataInterpolation={(p) => `Summoning Avatar... ${p.toFixed(0)}%`}
            />
        </div>
    );
}
