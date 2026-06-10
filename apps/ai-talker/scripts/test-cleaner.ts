
function cleanText(response: string) {
    let emotion = "neutral";
    let text = response;

    const match = response.match(/^[\[\(](neutral|joy|happy|fun|angry|sorrow|sad|surprised|relaxed)[\]\)]\s*([\s\S]*)/i);

    if (match) {
        emotion = match[1].toLowerCase();
        if (emotion === 'happy') emotion = 'joy';
        if (emotion === 'sad') emotion = 'sorrow';
        text = match[2].trim();
    } else {
        text = response.replace(/^[\[\(].*?[\]\)]\s*/, "").trim();
    }

    // Global Cleanup
    text = text.replace(/[\[\(].*?[\]\)]/g, "").trim();

    return { emotion, text };
}

const testCases = [
    { input: "[joy] こんにちは！", expectedEmotion: "joy", expectedText: "こんにちは！" },
    { input: "[sad] 悲しいです... [cry]", expectedEmotion: "sorrow", expectedText: "悲しいです..." },
    { input: "元気ですか？ [wave]", expectedEmotion: "neutral", expectedText: "元気ですか？" },
    { input: "(fun) めっちゃウケるw", expectedEmotion: "fun", expectedText: "めっちゃウケるw" },
    { input: "普通です。", expectedEmotion: "neutral", expectedText: "普通です。" },
    { input: "[unknown] 無視されるタグ", expectedEmotion: "neutral", expectedText: "無視されるタグ" }
];

console.log("Running Text Cleaner Tests...\n");

let passed = 0;
testCases.forEach((tc, i) => {
    const result = cleanText(tc.input);
    const isEmotionMatch = result.emotion === tc.expectedEmotion;
    const isTextMatch = result.text === tc.expectedText;

    if (isEmotionMatch && isTextMatch) {
        console.log(`✅ Case ${i + 1}: Passed`);
        passed++;
    } else {
        console.error(`❌ Case ${i + 1}: Failed`);
        console.error(`   Input: "${tc.input}"`);
        console.error(`   Expected: { emotion: "${tc.expectedEmotion}", text: "${tc.expectedText}" }`);
        console.error(`   Got:      { emotion: "${result.emotion}", text: "${result.text}" }`);
    }
});

console.log(`\nResult: ${passed}/${testCases.length} passed.`);

if (passed === testCases.length) {
    process.exit(0);
} else {
    process.exit(1);
}
