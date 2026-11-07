import { connectionPoints } from './blueprint'
import type { Graph, GraphNode } from './blueprint'

/** Geometry-only SVG: no text, external references, fonts or network requests. */
export function connectionsSvg(graph: Graph, top: number, height: number, scale: number, activeIndex: number): string {
  const nodes = new Map<string, GraphNode>(graph.nodes.map(node => [node.id, node]))
  const edges = [...graph.edges].sort((a, b) => Number(a.stepIndex === activeIndex) - Number(b.stepIndex === activeIndex))
  const paths: string[] = []
  const rounded = (value: number) => Number(value.toFixed(3))
  for (const edge of edges) {
    const source = nodes.get(edge.source), target = nodes.get(edge.target)
    if (!source || !target) continue
    const { x, y, tx, ty } = connectionPoints(edge, source, target)
    if (Math.max(y, ty) + 40 < top || Math.min(y, ty) - 40 > top + height) continue
    const active = edge.stepIndex === activeIndex
    const color = edge.kind === 'flow' ? active ? '#a7843f' : '#8d7a5f' : source.wireColor
    // H5 visual hierarchy, with a restrained width in screen pixels at all zooms.
    const width = rounded((active ? 2.1 : edge.kind === 'flow' ? 1.6 : 1.2) / scale)
    const a = rounded(3.5 / scale)
    const curve = edge.kind === 'flow'
      ? `M ${x} ${y} C ${x} ${y + 32} ${tx} ${ty - 32} ${tx} ${ty}`
      : `M ${x} ${y} C ${x + 42} ${y} ${tx - 42} ${ty} ${tx} ${ty}`
    const arrow = edge.kind === 'flow'
      ? `M ${rounded(tx - a)} ${rounded(ty - a)} L ${tx} ${ty} L ${rounded(tx + a)} ${rounded(ty - a)}`
      : `M ${rounded(tx - a)} ${rounded(ty - a)} L ${tx} ${ty} L ${rounded(tx - a)} ${rounded(ty + a)}`
    paths.push(`<path d="${curve} ${arrow}" fill="none" stroke="${color}" stroke-opacity="${active || edge.kind === 'flow' ? 1 : .9}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${graph.width}" height="${height}" viewBox="0 ${top} ${graph.width} ${height}">${paths.join('')}</svg>`
}

/** SVG above contains ASCII only, so no TextEncoder or browser globals needed. */
export function svgDataUrl(svg: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let encoded = ''
  for (let i = 0; i < svg.length; i += 3) {
    const a = svg.charCodeAt(i), b = svg.charCodeAt(i + 1) || 0, c = svg.charCodeAt(i + 2) || 0
    encoded += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b >> 4)]
      + (i + 1 < svg.length ? alphabet[((b & 15) << 2) | (c >> 6)] : '=')
      + (i + 2 < svg.length ? alphabet[c & 63] : '=')
  }
  return 'data:image/svg+xml;base64,' + encoded
}
