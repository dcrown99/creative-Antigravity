import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/**
 * VRM File Upload API
 * ブラウザからアップロードされたVRMファイルを保存
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // ファイルタイプチェック
        const validExtensions = ['.vrm', '.glb'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            return NextResponse.json({
                error: "Invalid file type. Only .vrm and .glb files are supported."
            }, { status: 400 });
        }

        // ファイルサイズチェック (50MB制限)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            return NextResponse.json({
                error: "File too large. Maximum size is 50MB."
            }, { status: 400 });
        }

        // アップロードディレクトリ
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');

        // ディレクトリが存在しない場合は作成
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // 一意なファイル名を生成
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueFileName = `${timestamp}_${safeFileName}`;
        const filePath = path.join(uploadDir, uniqueFileName);

        // ファイルを保存
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // 公開URLを生成
        const publicUrl = `/uploads/avatars/${uniqueFileName}`;

        console.log(`VRM file uploaded: ${uniqueFileName} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

        return NextResponse.json({
            success: true,
            url: publicUrl,
            filename: safeFileName,
            size: file.size
        });

    } catch (error) {
        console.error("File upload error:", error);
        return NextResponse.json(
            { error: "Failed to upload file" },
            { status: 500 }
        );
    }
}
