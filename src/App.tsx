import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  bluetoothSupported,
  connectTag,
  disconnectTag,
  type BleSession,
  writeBitmapChunks,
} from "./lib/ble";
import {
  canvasToMonoBitmap,
  DISPLAY_SIZES,
  renderTextToCanvas,
  type Align,
} from "./lib/canvas";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState("HELLO WORLD");
  const [fontSize, setFontSize] = useState(24);
  const [align, setAlign] = useState<Align>("center");
  const [bold, setBold] = useState(false);
  const [sizeId, setSizeId] = useState(DISPLAY_SIZES[0].id);
  const [session, setSession] = useState<BleSession | null>(null);
  const [status, setStatus] = useState("Disconnected");
  const [tone, setTone] = useState<"idle" | "ok" | "busy" | "err">("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(
    null,
  );
  const [sending, setSending] = useState(false);

  const size = useMemo(
    () => DISPLAY_SIZES.find((item) => item.id === sizeId) ?? DISPLAY_SIZES[0],
    [sizeId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderTextToCanvas(canvas, {
      text,
      fontSize,
      align,
      bold,
      width: size.width,
      height: size.height,
    });
  }, [text, fontSize, align, bold, size]);

  const connected = Boolean(session?.server.connected);
  const bleOk = bluetoothSupported();
  const writable = session?.writable[0];

  async function handleConnect() {
    setError("");
    setProgress(null);
    setTone("busy");
    setStatus("Opening Bluetooth picker…");
    try {
      const next = await connectTag(() => {
        setSession(null);
        setTone("idle");
        setStatus("Disconnected");
      });
      setSession(next);
      setTone("ok");
      setStatus(`Connected · ${next.device.name || "unnamed device"}`);
    } catch (err) {
      setTone("err");
      setStatus("Connection failed");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDisconnect() {
    await disconnectTag(session);
    setSession(null);
    setTone("idle");
    setStatus("Disconnected");
  }

  async function handleSend() {
    const canvas = canvasRef.current;
    if (!canvas || !writable) return;

    setError("");
    setSending(true);
    setTone("busy");
    setStatus("Sending bitmap…");
    try {
      const bitmap = canvasToMonoBitmap(canvas);
      await writeBitmapChunks(writable.characteristic, bitmap, setProgress);
      setTone("ok");
      setStatus("Bitmap written to writable characteristic");
    } catch (err) {
      setTone("err");
      setStatus("Send failed");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  function handleClear() {
    setText("");
    setProgress(null);
    setError("");
  }

  const percent = progress
    ? Math.round((progress.sent / progress.total) * 100)
    : 0;

  return (
    <main className="page">
      <section className="card">
        <h1>E-Ink Tag Tool</h1>

        <label className="field">
          <span>Text</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="HELLO WORLD"
          />
        </label>

        <div className="row">
          <label>
            Font size
            <input
              type="number"
              min={10}
              max={72}
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value) || 24)}
            />
          </label>
          <label>
            Align
            <select
              value={align}
              onChange={(event) => setAlign(event.target.value as Align)}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>

        <div className="row">
          <label>
            Display size
            <select value={sizeId} onChange={(event) => setSizeId(event.target.value)}>
              {DISPLAY_SIZES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={bold}
              onChange={(event) => setBold(event.target.checked)}
            />
            Bold
          </label>
        </div>

        <div className="preview-wrap">
          <canvas ref={canvasRef} width={size.width} height={size.height} />
        </div>
        <div className="preview-meta">
          <span>
            Preview · {size.width} × {size.height} px
          </span>
          <span>1-bit black / white</span>
        </div>

        <div className="actions">
          {connected ? (
            <button type="button" onClick={handleDisconnect} disabled={sending}>
              Disconnect
            </button>
          ) : (
            <button type="button" onClick={handleConnect} disabled={!bleOk}>
              Connect Tag
            </button>
          )}
          <button
            className="primary"
            type="button"
            onClick={handleSend}
            disabled={!connected || sending || !writable}
          >
            Send
          </button>
          <button type="button" onClick={handleClear} disabled={sending}>
            Clear
          </button>
        </div>

        <div className="status">
          <div>
            <span className={`dot ${tone === "idle" ? "" : tone}`} />
            Status: {status}
          </div>
          {progress && (
            <>
              <div className="progress" aria-label="send progress">
                <span style={{ width: `${percent}%` }} />
              </div>
              <p className="hint">
                Packet {progress.sent} / {progress.total} ({percent}%)
              </p>
            </>
          )}
          {!bleOk && (
            <p className="error">
              Web Bluetooth needs Chrome, Edge, or Bluefy on iOS, over HTTPS or
              localhost.
            </p>
          )}
          {connected && !writable && (
            <p className="error">
              Connected, but no writable characteristic was discovered. Capture
              Bluefy traffic to identify the image write target.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          {session && (
            <pre className="gatt">
              {session.services
                .map(
                  (service) =>
                    `${service.uuid}\n${service.characteristics
                      .map((char) => `  ${char.uuid} [${char.properties.join(", ")}]`)
                      .join("\n")}`,
                )
                .join("\n")}
            </pre>
          )}
          <p className="hint">
            Send writes the packed 1-bit canvas to the first writable GATT
            characteristic in 20-byte chunks. Packet headers, checksum, and
            refresh commands still need to be captured from Bluefy.
          </p>
        </div>
      </section>
    </main>
  );
}
