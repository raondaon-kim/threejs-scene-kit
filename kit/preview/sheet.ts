/** [스토리보드 | 렌더] 비교 시트: 행마다 한 샷, 높이 360으로 맞춤 */
export async function composeCompare(
  renderAt: (t: number) => Promise<void>,
  src: HTMLCanvasElement,
  pairs: Array<{ t: number; src: string; label: string }>,
): Promise<string> {
  const rowH = 360;
  const pad = 10;
  const labelW = 120;
  const imgs: HTMLImageElement[] = [];
  for (const p of pairs) {
    const img = new Image();
    img.src = p.src;
    await img.decode();
    imgs.push(img);
  }
  const widths = imgs.map((img) => Math.round((img.naturalWidth / img.naturalHeight) * rowH));
  const renderW = Math.round((src.width / src.height) * rowH);
  const out = document.createElement('canvas');
  out.width = labelW + Math.max(0, ...widths) + renderW + pad * 4;
  out.height = pairs.length * (rowH + pad) + pad + 30;
  const g = out.getContext('2d')!;
  g.fillStyle = '#111';
  g.fillRect(0, 0, out.width, out.height);
  g.fillStyle = '#aaa';
  g.font = 'bold 18px sans-serif';
  g.fillText('storyboard', labelW + pad * 2, 22);
  g.fillText('render', labelW + Math.max(0, ...widths) + pad * 3, 22);
  for (let i = 0; i < pairs.length; i++) {
    const y = 30 + pad + i * (rowH + pad);
    g.fillStyle = '#fff';
    g.font = 'bold 20px sans-serif';
    g.fillText(pairs[i].label, pad, y + 28);
    g.font = '16px sans-serif';
    g.fillText(`t=${pairs[i].t.toFixed(2)}s`, pad, y + 52);
    g.drawImage(imgs[i], labelW + pad * 2, y, widths[i], rowH);
    await renderAt(pairs[i].t);
    g.drawImage(src, labelW + Math.max(0, ...widths) + pad * 3, y, renderW, rowH);
  }
  return out.toDataURL('image/png');
}

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
