import { useEffect, useState } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { useAvatarStore } from "@/stores/avatar-store";
import { useConversationStore } from "@/stores/conversation-store";
import { useAvatarBehavior } from "@/hooks/use-avatar-behavior";
import { globalAudioManager } from "@/lib/audio/audio-manager";
import * as THREE from "three";

interface AvatarModelProps {
    url: string;
}

export default function AvatarModel({ url }: AvatarModelProps) {
    const [vrm, setVrm] = useState<VRM | null>(null);
    const emotion = useAvatarStore((s) => s.emotion);
    const { isAiSpeaking } = useConversationStore();

    const gltf = useLoader(GLTFLoader, url, (loader) => {
        loader.register((parser) => new VRMLoaderPlugin(parser));
    });

    useEffect(() => {
        if (!gltf) return;
        const vrmInstance = gltf.userData.vrm as VRM;

        // Null check: VRM data might not be loaded yet
        if (!vrmInstance) {
            console.warn("VRM data not found in GLTF userData");
            return;
        }

        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);

        vrmInstance.scene.traverse((obj) => {
            obj.frustumCulled = false;
            if ((obj as THREE.Mesh).isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });

        // A-Pose Correction
        const leftArm = vrmInstance.humanoid.getNormalizedBoneNode('leftUpperArm');
        const rightArm = vrmInstance.humanoid.getNormalizedBoneNode('rightUpperArm');
        if (leftArm) leftArm.rotation.z = Math.PI / 3.5;
        if (rightArm) rightArm.rotation.z = -Math.PI / 3.5;

        setVrm(vrmInstance);
    }, [gltf]);

    useAvatarBehavior(vrm);

    useFrame((state, delta) => {
        if (!vrm || !vrm.expressionManager) return;

        // 1. Emotion Application (Smart Blending)
        const mouthDampener = isAiSpeaking ? 0.3 : 1.0;

        // 全表情のリセットと適用
        const expressionKeys = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'joy', 'sorrow', 'fun'];
        expressionKeys.forEach(key => {
            const isMatch =
                (key === emotion) ||
                (emotion === 'joy' && key === 'happy') ||
                (emotion === 'sorrow' && key === 'sad');
            let targetWeight = isMatch ? 1.0 : 0.0;

            // 口に影響する表情ならウェイト抑制
            if (['happy', 'joy', 'surprised', 'fun'].includes(key)) {
                targetWeight *= mouthDampener;
            }

            // 現在の値から徐々に変化させる（Lerp）
            const current = vrm.expressionManager!.getValue(key as any) || 0;
            vrm.expressionManager!.setValue(key as any, THREE.MathUtils.lerp(current, targetWeight, delta * 5));
        });

        // 2. Lip Sync
        const volume = globalAudioManager.getVolume();
        const lipOpen = Math.min(1.0, Math.pow(volume * 2.5, 0.8));
        vrm.expressionManager.setValue('aa', lipOpen);
    });

    return vrm ? <primitive object={vrm.scene} /> : null;
}
