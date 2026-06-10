import { useFrame } from "@react-three/fiber";
import { VRM } from "@pixiv/three-vrm";
import { useRef } from "react";
import * as THREE from "three";
import { useConversationStore } from "@/stores/conversation-store";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { MathUtils } from "three";

// 疑似乱数生成 (簡易Perlin Noise)
const noise = (t: number) => Math.sin(t) + Math.sin(t * 2.5) * 0.5 + Math.sin(t * 0.1) * 2;

export function useAvatarBehavior(vrm: VRM | null) {
    const { isAiProcessing, isAiSpeaking } = useConversationStore();
    const { isListening } = useSpeechRecognition();

    // Internal State refs
    const state = useRef({
        blinkTimer: 0,
        nextBlinkTime: 2,
        saccadeTimer: 0,
        nextSaccadeTime: 1,
        lookTarget: new THREE.Vector3(0, 0, 10), // 現在の注視点
        actualLookAt: new THREE.Vector3(0, 0, 10), // 補間用
    });

    useFrame((rootState, delta) => {
        if (!vrm) return;

        const t = rootState.clock.elapsedTime;
        const s = state.current;

        // --- 1. Advanced Auto Blink (Human-like) ---
        s.blinkTimer += delta;
        if (s.blinkTimer > s.nextBlinkTime) {
            s.blinkTimer = 0;
            // 瞬きの間隔をランダム化 (人間は平均3-4秒だが、集中時は減る)
            const isConcentrating = isListening || isAiProcessing;
            s.nextBlinkTime = Math.random() * (isConcentrating ? 6 : 4) + 1;

            // 瞬き実行（トリガー的に値をセットするロジックが必要だが、今回は簡易的にSine波で開閉）
            // 実装簡略化のため、周期的なSine波にランダムオフセットを乗せる方式を採用
        }

        // 瞬きアニメーション: 基本は開いている(0)。時々閉じる(1)。
        // 時間 t に基づく鋭いスパイク波形を作る
        const blinkWave = Math.sin(t * 3 + s.nextBlinkTime);
        // 閾値を高くして「たまに瞬く」状態を作る。
        const blinkValue = Math.max(0, (blinkWave - 0.95) * 20);
        vrm.expressionManager?.setValue('blink', Math.min(1, blinkValue));


        // --- 2. Breathing (Chest & Shoulders) ---
        const breath = (Math.sin(t * 0.8) + 1) * 0.5; // 0~1 normalized
        const chest = vrm.humanoid.getNormalizedBoneNode('chest');
        const upperChest = vrm.humanoid.getNormalizedBoneNode('upperChest'); // VRM1.0対応

        if (chest) {
            chest.rotation.x = MathUtils.lerp(chest.rotation.x, breath * 0.05, delta * 2);
            chest.position.y = MathUtils.lerp(chest.position.y, breath * 0.005, delta * 2);
        }
        if (upperChest) {
            upperChest.rotation.x = MathUtils.lerp(upperChest.rotation.x, breath * 0.03, delta * 2);
        }


        // --- 3. Gaze & Head Control (The Core Intelligence) ---

        // Saccade (眼球の跳躍運動) の計算
        s.saccadeTimer += delta;
        if (s.saccadeTimer > s.nextSaccadeTime) {
            s.saccadeTimer = 0;
            s.nextSaccadeTime = Math.random() * 2 + 0.5;

            // ターゲット座標の決定
            if (isListening) {
                // 基本はカメラを見るが、少しずらす（圧迫感軽減）
                s.lookTarget.set(
                    (Math.random() - 0.5) * 0.5, // X: わずかな横揺れ
                    (Math.random() - 0.5) * 0.2, // Y: わずかな縦揺れ
                    5
                );
            } else if (isAiProcessing) {
                // 思考中: 斜め上や横を見る（アクセス解析中）
                s.lookTarget.set(
                    (Math.random() - 0.5) * 5, // 大きく視線を動かす
                    Math.random() * 2 + 1,     // 上を見る
                    5
                );
            } else {
                // 通常時: ぼーっとする
                s.lookTarget.set(
                    noise(t * 0.5) * 2,
                    noise(t * 0.3) * 1,
                    5
                );
            }
        }

        // 実際の視線（LookAt）をターゲットに向かってSpring補間
        // lerp係数を可変にすることで「視線の鋭さ」を変える
        const dampSpeed = isListening ? 4.0 : 2.0; // 聞くときは素早く、普段はゆっくり
        s.actualLookAt.lerp(s.lookTarget, delta * dampSpeed);

        // VRMのLookAt機能を利用
        if (vrm.lookAt) {
            vrm.lookAt.lookAt(s.actualLookAt);
        }

        // 頭の動き（視線とは独立して少し遅れて追従 + ノイズ）
        const head = vrm.humanoid.getNormalizedBoneNode('head');
        if (head) {
            const noiseX = noise(t * 0.4) * 0.1;
            const noiseY = noise(t * 0.3) * 0.1;
            const noiseZ = noise(t * 0.2) * 0.05;

            // ターゲット方向への指向性
            const targetRotationY = s.actualLookAt.x * 0.15;
            const targetRotationX = -s.actualLookAt.y * 0.15;

            // 状況に応じた追加モーション
            let moodX = 0;
            let moodZ = 0;

            if (isListening) {
                moodX = -0.05; // 軽く顎を引く（傾聴）
                moodZ = Math.sin(t * 1.5) * 0.03; // わずかな首の傾げ
            } else if (isAiSpeaking) {
                moodX = Math.sin(t * 8) * 0.02; // 喋るリズムで頷き
            }

            head.rotation.y = MathUtils.lerp(head.rotation.y, targetRotationY + noiseY, delta * 3);
            head.rotation.x = MathUtils.lerp(head.rotation.x, targetRotationX + noiseX + moodX, delta * 3);
            head.rotation.z = MathUtils.lerp(head.rotation.z, noiseZ + moodZ, delta * 3);
        }

        vrm.update(delta);
    });
}
