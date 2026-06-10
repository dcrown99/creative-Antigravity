import { Environment, ContactShadows } from "@react-three/drei";
import { useControls } from "leva";

export function SceneEnvironment() {
    const lights = useControls("Studio Lights", {
        envIntensity: { value: 0.3, min: 0, max: 2 }, // 環境光は弱めて、ライトで陰影を作る
        keyLightIntensity: { value: 1.8, min: 0, max: 5 },
        fillLightIntensity: { value: 0.5, min: 0, max: 5 },
        rimLightIntensity: { value: 3.0, min: 0, max: 10 },
    });

    return (
        <group>
            {/* Cityプリセットは色情報が豊富で肌が綺麗に見えやすい */}
            <Environment preset="city" environmentIntensity={lights.envIntensity} />

            {/* Key Light: 正面やや上 */}
            <directionalLight
                position={[-1, 2, 3]}
                intensity={lights.keyLightIntensity}
                color="#fff5eb" // ほんのり暖色
                castShadow
            />

            {/* Fill Light: 逆サイドからの青み (影を紫っぽくするテクニック) */}
            <directionalLight
                position={[2, 0, 2]}
                intensity={lights.fillLightIntensity}
                color="#dbeeff"
            />

            {/* Rim Light: 真後ろ上からの強力なバックライト */}
            <spotLight
                position={[0, 4, -2]}
                intensity={lights.rimLightIntensity}
                color="#ffffff"
                distance={10}
                angle={1}
                penumbra={1}
            />

            <ContactShadows
                resolution={1024}
                scale={10}
                blur={2.0}
                opacity={0.4}
                far={10}
                color="#000000"
            />
        </group>
    );
}
