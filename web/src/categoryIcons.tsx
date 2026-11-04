import type { ReactNode } from 'react'
import { iconProps } from './icons'

/**
 * 分类图标：20×20 细线条，与主题图标同一套笔触（1.6px 圆头）。
 * key 为 dishes/ 下的目录名；“全部”用 'all'。
 */
const PATHS: Record<string, ReactNode> = {
  // 全部：四宫格
  all: (
    <>
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" />
      <rect x="11" y="3.5" width="5.5" height="5.5" rx="1" />
      <rect x="3.5" y="11" width="5.5" height="5.5" rx="1" />
      <rect x="11" y="11" width="5.5" height="5.5" rx="1" />
    </>
  ),
  // 素菜：叶子
  vegetable_dish: (
    <>
      <path d="M16.5 3.5C9 3.5 4 7 4 12.5c0 2.3 1.6 4 3.9 4C13.5 16.5 16.5 11 16.5 3.5z" />
      <path d="M3.5 17.5c2.5-4.5 6-8 10-10.5" />
    </>
  ),
  // 荤菜：鸡腿（椭圆的肉 + 骨头 + 两个骨节）
  meat_dish: (
    <>
      <ellipse cx="12.4" cy="7.6" rx="5" ry="4" transform="rotate(-45 12.4 7.6)" />
      <path d="M9.2 10.8 5.6 14.4" />
      <circle cx="4.3" cy="14" r="1.4" />
      <circle cx="6" cy="15.7" r="1.4" />
    </>
  ),
  // 水产：鱼
  aquatic: (
    <>
      <path d="M2.5 10c2.2-3.2 5-4.8 8.2-4.8 3.1 0 5.4 1.9 6.8 4.8-1.4 2.9-3.7 4.8-6.8 4.8-3.2 0-6-1.6-8.2-4.8z" />
      <path d="M2.5 10 1 7.2M2.5 10 1 12.8" />
      <circle cx="13.8" cy="9.2" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  // 早餐：煎蛋（横向舒展的不规则蛋白 + 实心偏心蛋黄）
  breakfast: (
    <>
      <path d="M6.6 4.6c1.6-1.5 4-1.4 5.5-.3 1 .7 2 .5 3.2 1.2 1.9 1.1 2.4 3.4 1.5 5.2-.6 1.2-.4 2.3-1.2 3.6-1.3 2-4 2.6-6.1 1.9-1.1-.4-2-.2-3.3-.5C4 15.2 2.4 13.2 2.6 10.8c.1-1.4.8-2.2 1.6-3 .9-.9 1.3-2.2 2.4-3.2z" />
      <circle cx="11.4" cy="9.4" r="2.3" fill="currentColor" stroke="none" />
    </>
  ),
  // 主食：米饭配筷子
  staple: (
    <>
      <path d="M3 10.5h14a7 7 0 0 1-14 0z" />
      <path d="M5.2 10.5C5.6 8.4 7.6 7 10 7s4.4 1.4 4.8 3.5" />
      <path d="M11.5 2.5 9.8 7M15.5 3.2 12.4 7.3" />
      <path d="M8 17.5h4" />
    </>
  ),
  // 半成品加工：包装盒
  'semi-finished': (
    <>
      <path d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5z" />
      <path d="M3 6.5 10 10l7-3.5M10 10v7M6.5 4.8l7 3.5" />
    </>
  ),
  // 汤与粥：冒热气的汤碗
  soup: (
    <>
      <path d="M3 10.5h14a7 7 0 0 1-14 0z" />
      <path d="M7 3.2c-.9 1 .9 1.8 0 3.3M10 2.5c-.9 1 .9 1.8 0 3.3M13 3.2c-.9 1 .9 1.8 0 3.3" />
      <path d="M8 17.5h4" />
    </>
  ),
  // 饮料：带吸管的杯子
  drink: (
    <>
      <path d="M4.5 6.5h11M5.5 6.5l1 10.2a.9.9 0 0 0 .9.8h5.2a.9.9 0 0 0 .9-.8l1-10.2" />
      <path d="M11 6.5 12.6 2.5h2.4" />
      <path d="M6 11h8" />
    </>
  ),
  // 酱料和其它材料：酱料瓶
  condiment: (
    <>
      <path d="M8.2 2.5h3.6v2.7l1.7 2.1v9.6a.6.6 0 0 1-.6.6H7.1a.6.6 0 0 1-.6-.6V7.3l1.7-2.1z" />
      <path d="M6.5 10.5h7v3.5h-7z" />
    </>
  ),
  // 甜品：插蜡烛的蛋糕
  dessert: (
    <>
      <path d="M3.5 11.5h13v5.5h-13zM5 11.5V8.5h10v3" />
      <path d="M3.5 14c1.1 0 1.1-.9 2.2-.9s1.1.9 2.1.9 1.1-.9 2.2-.9 1.1.9 2.2.9 1.1-.9 2.1-.9 1.1.9 2.2.9" />
      <path d="M10 8.5V6" />
      <path d="M10 2.8c.7.7.7 1.4 0 1.9-.7-.5-.7-1.2 0-1.9z" fill="currentColor" />
    </>
  ),
}

export function CategoryIcon({ id, size = 14 }: { id: string; size?: number }) {
  const body = PATHS[id]
  if (!body) return null
  return (
    <svg {...iconProps} width={size} height={size}>
      {body}
    </svg>
  )
}
