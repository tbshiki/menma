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

/** 最後に書き込まれたカスタムプロパティを読む */
function lastValue(element: FakeElement, name: string): string | undefined {
  const calls = vi.mocked(element.style.setProperty).mock.calls;
  return calls.filter((call) => call[0] === name).at(-1)?.[1];
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
  it("幅の比率だけで倍率を決める（余白を作らない）", () => {
    const stage = createElement({ width: 1600, height: 900 });
    const container = createElement({ width: 800, height: 1200 });

    connect(stage, container);

    // 高さに余裕があっても幅へ合わせる。16:9 だった頃は min() で 0.5 未満になっていた
    expect(lastValue(stage, "--mn-scale")).toBe(String(0.5));
  });

  it("画面が横長でも幅いっぱいに広げる", () => {
    const stage = createElement({ width: 1600, height: 900 });
    const container = createElement({ width: 3200, height: 900 });

    connect(stage, container);

    expect(lastValue(stage, "--mn-scale")).toBe(String(2));
  });

  it("余った縦をキャンバスの高さに使う", () => {
    const stage = createElement({ width: 1600, height: 900 });
    const container = createElement({ width: 800, height: 1200 });

    connect(stage, container);

    // 倍率 0.5 なので、拡大後に 1200px となる高さは 2400px
    expect(lastValue(stage, "--mn-canvas-height")).toBe("2400px");
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

    expect(lastValue(stage, "--mn-scale")).toBe(String(1));
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

    // 1 回の計算につき倍率と高さの 2 つを書き込む
    expect(vi.mocked(stage.style.setProperty).mock.calls.length).toBe(initialCalls + 2);
  });

  it("解除すると監視をやめる", () => {
    const stage = createElement({ width: 1600, height: 900 });
    const container = createElement({ width: 1600, height: 900 });

    const disconnect = connect(stage, container);
    disconnect();

    expect(disconnected).toBe(1);
  });
});
