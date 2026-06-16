/* Split.js v1.6.5 — type declarations for ./split.js */

export interface SplitInstance {
  getSizes(): number[];
  setSizes(sizes: number[]): void;
  destroy(): void;
}

export interface SplitOptions {
  sizes?: number[];
  minSize?: number | number[];
  maxSize?: number | number[];
  direction?: 'horizontal' | 'vertical';
  gutterSize?: number;
  snapOffset?: number;
  dragInterval?: number;
  onDragEnd?: (sizes: number[]) => void;
  elementStyle?: (dimension: string, size: number, gs: number) => Record<string, string>;
  gutterStyle?: (dimension: string, gs: number) => Record<string, string>;
}

declare function Split(ids: string[], options?: SplitOptions): SplitInstance;
export = Split;
