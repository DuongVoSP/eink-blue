export type Align = "left" | "center" | "right";

export type DisplaySize = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export const DISPLAY_SIZES: DisplaySize[] = [
  { id: "213-250", label: "2.13\" · 250 × 122", width: 250, height: 122 },
  { id: "213-212", label: "2.13\" · 212 × 104", width: 212, height: 104 },
  { id: "29-296", label: "2.9\" · 296 × 128", width: 296, height: 128 },
];

export type RenderOptions = {
  text: string;
  fontSize: number;
  align: Align;
  bold: boolean;
  width: number;
  height: number;
};

export function renderTextToCanvas(
  canvas: HTMLCanvasElement,
  options: RenderOptions,
): void {
  const { text, fontSize, align, bold, width, height } = options;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#000000";
  ctx.font = `${bold ? "700" : "400"} ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = align;

  const maxWidth = width - 12;
  const lines = wrapLines(ctx, text || " ", maxWidth);
  const lineHeight = Math.round(fontSize * 1.2);
  const blockHeight = lines.length * lineHeight;
  let y = Math.max(6, Math.round((height - blockHeight) / 2));
  const x = align === "left" ? 6 : align === "right" ? width - 6 : Math.round(width / 2);

  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines.length ? lines : [""];
}

/** Pack canvas pixels into a 1-bit bitmap (1 = black, 0 = white, MSB first). */
export function canvasToMonoBitmap(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Uint8Array();

  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const bytes = new Uint8Array(Math.ceil((width * height) / 8));
  let bit = 0;

  for (let i = 0; i < image.data.length; i += 4) {
    const luminance =
      0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
    const black = luminance < 128 ? 1 : 0;
    const byteIndex = Math.floor(bit / 8);
    const shift = 7 - (bit % 8);
    bytes[byteIndex] |= black << shift;
    bit += 1;
  }

  return bytes;
}
