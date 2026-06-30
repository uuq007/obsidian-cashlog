// 金额计算工具

// 将金额四舍五入到分（2 位小数），消除浮点累加误差（如 0.1 + 0.2 → 0.3）
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
