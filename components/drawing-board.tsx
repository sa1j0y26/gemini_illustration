"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface DrawingBoardProps {
  disabled?: boolean;
  onSnapshot: (imageDataUrl: string) => Promise<void>;
  canvasHeight?: string;
}

export function DrawingBoard({ disabled = false, onSnapshot, canvasHeight = "min(56vh, 480px)" }: DrawingBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const context = useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1f2b";
    return ctx;
  }, [canvasRef.current]);

  function markDirty(): void {
    dirtyRef.current = true;
  }

  async function sendSnapshot(): Promise<void> {
    if (disabled || pendingRef.current || !dirtyRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    pendingRef.current = true;
    setIsSubmitting(true);

    try {
      await onSnapshot(canvas.toDataURL("image/png"));
      dirtyRef.current = false;
    } finally {
      pendingRef.current = false;
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      void sendSnapshot();
    }, 1400);

    return () => clearInterval(timer);
  }, [disabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1f2b";
  }, []);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (disabled || !context) {
      return;
    }

    const point = getPoint(event);
    isDrawingRef.current = true;
    pointerIdRef.current = event.pointerId;

    context.beginPath();
    context.moveTo(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (disabled || !context || !isDrawingRef.current || pointerIdRef.current !== event.pointerId) {
      return;
    }

    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    markDirty();
  }

  function endDrawing(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (!isDrawingRef.current || pointerIdRef.current !== event.pointerId) {
      return;
    }
    isDrawingRef.current = false;
    pointerIdRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    void sendSnapshot();
  }

  function clearCanvas(): void {
    const canvas = canvasRef.current;
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    dirtyRef.current = true;
  }

  return (
    <section style={{ marginBottom: 0 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3>キャンバス</h3>
        <div className="row">
          <button onClick={clearCanvas} disabled={disabled}>
            クリア
          </button>
          <button onClick={() => void sendSnapshot()} disabled={disabled || isSubmitting}>
            {isSubmitting ? "送信中..." : "今すぐ判定"}
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={880}
        height={560}
        style={{
          width: "100%",
          height: canvasHeight,
          border: "1px solid #d8deea",
          borderRadius: 12,
          background: "#fff",
          touchAction: "none",
          marginTop: 10
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrawing}
        onPointerCancel={endDrawing}
        onPointerLeave={endDrawing}
      />
    </section>
  );
}
