import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectScaler } from "../../src/view/scaler";

/**
 * scaler は渡された要素の実寸しか見ないので、本物の DOM を用意しなくても検証できる。
 * ブラウザでしか起きない事象（スタイル適用の遅れ）を E2E で再現するのは難しいため、
 * 監視対象と倍率の決め方をここで固定する。
 */

type FakeElement = {
  offsetWidth: number;
  offsetHeight: number;
  clientWidth: number;
  clientHeight: number;
  style: { setProperty: (name: string, value: string) => void };
};

function createElement(size: { width: number; height: number }): FakeElement {
  return {
    offsetWidth: size.width,
    offsetHeight: size.height,
    clientWidth: size.width,
    clientHeight: size.height,
    style: { setProperty: vi.fn() },
  };
}

const observed: unknown[] = [];
let notify: (() => void) | undefined;
let disconnected = 0;
let frames: (() => void)[] = [];

class FakeResizeObserver {
  constructor(callback: () => void) {
    notify = callback;
  }
  observe(target: unknown): void {
    observed.push(target);
  }
  disconnect(): void {
    disconnected += 1;
  }
}

/** 溜まっている rAF コールバックを実行する */
function runFrames(): void {
  const pending = frames;
  frames = [];
  for (const frame of pending) {
    frame();
  }
}

beforeEach(() => {
  observed.length = 0;
  notify = undefined;
  disconnected = 0;
  frames = [];

  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function connect(stage: FakeElement, container: FakeElement): () => void {
  return connectScaler(stage as unknown as HTMLElement, container as unknown as HTMLElement);
}

describe("connectScaler", () => {
  it("幅と高さのうち小さいほうの比率を倍率にする", () => {
    const stage = createElement({ width: 1600, height: 900 });
    const container = createElement({ width: 1568, height: 744 });

    connect(stage, container);

    expect(stage.style.setProperty).toHaveBeenLastCalledWith("--mn-scale", String(744 / 900));
  });

  it("横に余裕がない場合は幅の比率を使う", () => {
    const stage = createElement({ width: 1600, height: 900 });
    const container = createElement({ width: 800, height: 1200 });

    connect(stage, container);

    expect(stage.style.setProperty).toHaveBeenLastCalledWith("--mn-scale", String(0.5));
  });

  it("収める先とキャンバスの両方を監視する", () => {
    const stage = createElement({ width: 1600, height: 900 });
    const container = createElement({ width: 1600, height: 900 });

    connect(stage, container);

    // キャンバス側も見ないと、スタイル適用が遅れたときに誤った倍率が残る
    expect(observed).toContain(stage);
    expect(observed).toContain(container);
  });

  it("基準の実寸が取れないうちは倍率を書き込まない", () => {
    const stage = createElement({ width: 0, height: 0 });
    const container = createElement({ width: 1600, height: 900 });

    connect(stage, container);

    expect(stage.style.setProperty).not.toHaveBeenCalled();
  });

  it("基準の実寸が後から決まったら計算し直す", () => {
    const stage = createElement({ width: 0, height: 0 });
    const container = createElement({ width: 1600, height: 900 });

    connect(stage, container);
    expect(stage.style.setProperty).not.toHaveBeenCalled();

    stage.offsetWidth = 1600;
    stage.offsetHeight = 900;
    notify?.();
    runFrames();

    expect(stage.style.setProperty).toHaveBeenLastCalledWith("--mn-scale", String(1));
  });

  it("通知が続けて来ても 1 フレームに 1 回だけ計算する", () => {
    const stage = createElement({ width: 1600, height: 900 });
    const container = createElement({ width: 1600, height: 900 });

    connect(stage, container);
    const initialCalls = vi.mocked(stage.style.setProperty).mock.calls.length;

    notify?.();
    notify?.();
    notify?.();
    runFrames();

    expect(vi.mocked(stage.style.setProperty).mock.calls.length).toBe(initialCalls + 1);
  });

  it("解除すると監視をやめる", () => {
    const stage = createElement({ width: 1600, height: 900 });
    const container = createElement({ width: 1600, height: 900 });

    const disconnect = connect(stage, container);
    disconnect();

    expect(disconnected).toBe(1);
  });
});
