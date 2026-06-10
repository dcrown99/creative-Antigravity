import { EffectComposer, Bloom, Vignette, Noise, ToneMapping, SMAA } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useControls } from "leva";

export function PostProcessingEffects() {
    const config = useControls("Post Processing", {
        bloomIntensity: { value: 0.6, min: 0, max: 2, step: 0.1 },
        bloomThreshold: { value: 0.7, min: 0, max: 1, step: 0.05 },
        bloomRadius: { value: 0.7, min: 0, max: 1, step: 0.1 },
        vignetteDarkness: { value: 0.45, min: 0, max: 1, step: 0.05 },
        noiseOpacity: { value: 0.015, min: 0, max: 0.1, step: 0.005 },
        exposure: { value: 1.0, min: 0.5, max: 2.0 },
    });

    return (
        <EffectComposer enableNormalPass={false} multisampling={0}>
            {/* SMAA: ジャギー除去 (最優先) */}
            <SMAA />

            {/* ToneMapping: 色調補正 */}
            <ToneMapping
                exposure={config.exposure}
            // mode={ToneMappingMode.AGX} // PostprocessingのバージョンによってはAgXが使えるが、今回はデフォルト(Reinhard/ACES)を調整
            />

            {/* Bloom: アイドルオーラ */}
            <Bloom
                luminanceThreshold={config.bloomThreshold}
                mipmapBlur
                intensity={config.bloomIntensity}
                radius={config.bloomRadius}
            />

            <Vignette
                eskil={false}
                offset={0.1}
                darkness={config.vignetteDarkness}
            />

            <Noise
                opacity={config.noiseOpacity}
                blendFunction={BlendFunction.OVERLAY}
            />
        </EffectComposer>
    );
}
