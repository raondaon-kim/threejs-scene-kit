/** 여러 시점의 프레임을 한 장의 콘택트 시트(PNG data URL)로 합성 */
export async function composeSheet(
  renderAt: (t: number) => Promise<void>,
  src: HTMLCanvasElement,
  times: number[],
  cols: number,
): Promise<string> {
  const tw = 360;
  const th = Math.round((tw * src.height) / src.width);
  const pad = 8;
  const labelH = 28;
  const c = Math.max(1, Math.min(cols, times.length));
  const rows = Math.ceil(times.length / c);
  const out = document.createElement('canvas');
  out.width = c * tw + (c + 1) * pad;
  out.height = rows * (th + labelH) + (rows + 1) * pad;
  const g = out.getContext('2d')!;
  g.fillStyle = '#111';
  g.fillRect(0, 0, out.width, out.height);
  for (let i = 0; i < times.length; i++) {
    await renderAt(times[i]);
    const x = pad + (i % c) * (tw + pad);
    const y = pad + Math.floor(i / c) * (th + labelH + pad);
    g.drawImage(src, x, y, tw, th);
    g.fillStyle = '#fff';
    g.font = 'bold 18px sans-serif';
    g.fillText(`t=${times[i].toFixed(2)}s`, x + 4, y + th + 20);
  }
  return out.toDataURL('image/png');
}
