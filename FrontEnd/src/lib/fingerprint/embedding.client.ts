"use client";

// Runs CLIP (ViT-B/32, int8) in the visitor's browser via transformers.js.
// Keeping inference on the client means nothing heavy has to run inside a Vercel function;
// the ~90MB model is fetched once from the Hugging Face CDN and cached by the browser.

const MODEL_ID = "Xenova/clip-vit-base-patch32";

type Progress = (info: { status: string; progress?: number }) => void;

interface Loaded {
  processor: (img: unknown) => Promise<unknown>;
  model: (inputs: unknown) => Promise<{ image_embeds: { data: Float32Array } }>;
  RawImage: { fromBlob: (b: Blob) => Promise<unknown> };
}

let loading: Promise<Loaded> | null = null;
let progressListener: Progress | undefined;

function load(): Promise<Loaded> {
  if (!loading) {
    loading = (async () => {
      const tf = await import("@huggingface/transformers");
      const processor = await tf.AutoProcessor.from_pretrained(MODEL_ID);
      const model = await tf.CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
        dtype: "q8",
        progress_callback: (info: { status: string; progress?: number }) => progressListener?.(info),
      });
      return {
        processor: processor as unknown as Loaded["processor"],
        model: model as unknown as Loaded["model"],
        RawImage: tf.RawImage as unknown as Loaded["RawImage"],
      };
    })().catch((err) => {
      loading = null; // allow retry
      throw err;
    });
  }
  return loading;
}

/** Returns a 512-d CLIP image embedding, or null if the model cannot run in this browser. */
export async function computeClipEmbedding(imageBlob: Blob, onProgress?: Progress): Promise<number[] | null> {
  try {
    progressListener = onProgress;
    const { processor, model, RawImage } = await load();
    const image = await RawImage.fromBlob(imageBlob);
    const { image_embeds } = await model(await processor(image));
    return Array.from(image_embeds.data);
  } catch (err) {
    console.warn("CLIP embedding unavailable, falling back to hash-only analysis:", err);
    return null;
  } finally {
    progressListener = undefined;
  }
}

/** Optionally warm the model while the user is still drawing. */
export function preloadClipModel() {
  load().catch(() => undefined);
}
