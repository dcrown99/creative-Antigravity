import { NextRequest, NextResponse } from "next/server";

// Docker環境などでのホスト名解決を考慮
const VOICEVOX_URL = process.env.NEXT_PUBLIC_VOICEVOX_URL || "http://localhost:50021";

export async function POST(req: NextRequest) {
    try {
        const { text, speakerId = 47 } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        // Plan B: 日本語会話モード
        // カタカナ変換ロジックを廃止し、テキストをそのままVoicevoxへ渡す
        // 必要に応じて、長文の分割やクリーニングを行う場合はここに追加
        const processedText = text.substring(0, 200); // Voicevoxのリミット考慮

        // 音声合成クエリ作成
        const queryUrl = `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(processedText)}&speaker=${speakerId}`;
        // console.log(`TTS Request: ${processedText}`);

        const queryRes = await fetch(queryUrl, { method: "POST" });

        if (!queryRes.ok) {
            const errText = await queryRes.text();
            console.error(`Voicevox Query Error: ${queryRes.status}`, errText);
            return NextResponse.json({ error: "Voicevox Query Failed", details: errText }, { status: 502 });
        }

        const queryJson = await queryRes.json();

        // Synthesis
        const synthesisRes = await fetch(`${VOICEVOX_URL}/synthesis?speaker=${speakerId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(queryJson),
        });

        if (!synthesisRes.ok) {
            return NextResponse.json({ error: "Voicevox Synthesis Failed" }, { status: 502 });
        }

        const audioBuffer = await synthesisRes.arrayBuffer();

        return new NextResponse(audioBuffer, {
            headers: {
                "Content-Type": "audio/wav",
                "Content-Length": audioBuffer.byteLength.toString(),
            },
        });

    } catch (error) {
        console.error("TTS Proxy Critical Error:", error);
        return NextResponse.json(
            { error: "TTS Service Unavailable. Is Voicevox running?" },
            { status: 503 }
        );
    }
}
