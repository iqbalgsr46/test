'use client';
import { useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { matchesSignatureName } from './signature';
export function SignaturePad({
  name,
  onChange,
}: {
  name: string;
  onChange: (value: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef(0);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typed, setTyped] = useState('');
  function point(e: PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * 800) / r.width, y: ((e.clientY - r.top) * 240) / r.height };
  }
  function start(e: PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current = 0;
    const p = point(e);
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineWidth = 2.8;
    c.lineCap = 'round';
    c.strokeStyle = '#24392f';
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = canvas.current?.getContext('2d');
    const p = point(e);
    c?.lineTo(p.x, p.y);
    c?.stroke();
    strokes.current++;
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (strokes.current >= 3 && canvas.current) onChange(canvas.current.toDataURL('image/png'));
  }
  function clear() {
    canvas.current?.getContext('2d')?.clearRect(0, 0, 800, 240);
    setTyped('');
    onChange('');
  }
  function changeMode(next: 'draw' | 'type') {
    clear();
    setMode(next);
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          variant={mode === 'draw' ? 'primary' : 'secondary'}
          onClick={() => changeMode('draw')}
          aria-pressed={mode === 'draw'}
        >
          Gambar tanda tangan
        </Button>
        <Button
          variant={mode === 'type' ? 'primary' : 'secondary'}
          onClick={() => changeMode('type')}
          aria-pressed={mode === 'type'}
        >
          Ketik nama
        </Button>
      </div>
      {mode === 'draw' ? (
        <>
          <canvas
            ref={canvas}
            width={800}
            height={240}
            className="signature-canvas"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label="Area gambar tanda tangan"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="muted text-[10px]">Tanda tangan dengan jari, stylus, atau mouse.</p>
            <Button variant="ghost" onClick={clear}>
              Bersihkan
            </Button>
          </div>
        </>
      ) : (
        <>
          <label htmlFor="signature-name" className="label">
            Nama lengkap sebagai tanda tangan
          </label>
          <input
            id="signature-name"
            className="field"
            value={typed}
            maxLength={100}
            autoComplete="off"
            onChange={(e) => {
              setTyped(e.target.value);
              onChange(matchesSignatureName(e.target.value, name) ? `typed:${name}` : '');
            }}
          />
          <p className="muted mt-2 text-[11px]">
            Ketik persis nama pemilih: {name}. Alternatif aksesibilitas untuk simulasi.
          </p>
        </>
      )}
    </div>
  );
}
