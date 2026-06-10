import { NextRequest, NextResponse } from "next/server";

/**
 * VRM Proxy API
 * CORS制限のある外部URLからVRMファイルをフェッチし、クライアントに転送する
 */
export async function GET(req: NextRequest) {
    try {
        const url = req.nextUrl.searchParams.get('url');

        if (!url) {
            return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
        }

        // セキュリティ: 許可されたドメインのみ
        const allowedDomains = [
            'hub.vroid.com',
            'cdn.vroid.com',
            'pixiv.net',
            // 他の信頼できるドメインを追加
        ];

        let urlObj: URL;
        try {
            urlObj = new URL(url);
        } catch {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }

        const isAllowed = allowedDomains.some(domain =>
            urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
        );

        if (!isAllowed) {
            console.warn(`Blocked request to unauthorized domain: ${urlObj.hostname}`);
            return NextResponse.json({
                error: "Domain not allowed. Only VRoid Hub and trusted sources are supported."
            }, { status: 403 });
        }

        console.log(`Proxying VRM from: ${url}`);

        // 外部URLからファイルをフェッチ
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!response.ok) {
            console.error(`Failed to fetch VRM: ${response.status} ${response.statusText}`);
            return NextResponse.json({
                error: `Failed to fetch VRM: ${response.status}`
            }, { status: response.status });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': buffer.byteLength.toString(),
                'Cache-Control': 'public, max-age=3600', // 1時間キャッシュ
            },
        });

    } catch (error) {
        console.error("VRM Proxy Error:", error);
        return NextResponse.json(
            { error: "Failed to proxy VRM file" },
            { status: 500 }
        );
    }
}
