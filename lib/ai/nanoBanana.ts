export async function colorizeBestIllustration(input: {
  imageDataUrl: string;
  prompt: string;
}): Promise<{ imageDataUrl: string; provider: "nanobanana" }> {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) {
    throw new Error("NANOBANANA_API_KEY_MISSING");
  }

  // NOTE:
  // NanoBanana で最優秀イラストを彩色する拡張ポイント。
  // ここは API 仕様確定後に置き換える。
  return {
    imageDataUrl: input.imageDataUrl,
    provider: "nanobanana"
  };
}
