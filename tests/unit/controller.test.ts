import { describe, expect, it, vi } from "vitest";

import { NavigationController } from "../../src/navigation/controller";

describe("NavigationController", () => {
  it("先頭ページから始まる", () => {
    const controller = new NavigationController(5);

    expect(controller.state).toEqual({ current: 0, total: 5 });
  });

  it("初期位置を指定できる", () => {
    expect(new NavigationController(5, 2).state.current).toBe(2);
  });

  it("初期位置が範囲外なら端へ丸める", () => {
    expect(new NavigationController(5, -3).state.current).toBe(0);
    expect(new NavigationController(5, 99).state.current).toBe(4);
  });

  it("スライドが 0 枚なら作れない", () => {
    expect(() => new NavigationController(0)).toThrow();
  });

  it("next / previous / first / last が動く", () => {
    const controller = new NavigationController(4);

    controller.next();
    expect(controller.state.current).toBe(1);
    controller.previous();
    expect(controller.state.current).toBe(0);
    controller.last();
    expect(controller.state.current).toBe(3);
    controller.first();
    expect(controller.state.current).toBe(0);
  });

  it("端でループしない", () => {
    const controller = new NavigationController(3);

    controller.previous();
    expect(controller.state.current).toBe(0);

    controller.last();
    controller.next();
    expect(controller.state.current).toBe(2);
  });

  it("範囲外の goTo を端へ丸める", () => {
    const controller = new NavigationController(3);

    controller.goTo(99);
    expect(controller.state.current).toBe(2);
    controller.goTo(-99);
    expect(controller.state.current).toBe(0);
  });

  it("購読時に現在の状態を 1 度渡す", () => {
    const controller = new NavigationController(3, 1);
    const listener = vi.fn();

    controller.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith({ current: 1, total: 3 });
  });

  it("同じ位置への移動では通知しない", () => {
    const controller = new NavigationController(3);
    const listener = vi.fn();
    controller.subscribe(listener);
    listener.mockClear();

    controller.goTo(0);
    controller.previous();
    controller.first();

    expect(listener).not.toHaveBeenCalled();
  });

  it("位置が変わったときだけ通知する", () => {
    const controller = new NavigationController(3);
    const listener = vi.fn();
    controller.subscribe(listener);
    listener.mockClear();

    controller.next();
    controller.next();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith({ current: 2, total: 3 });
  });

  it("購読を解除できる", () => {
    const controller = new NavigationController(3);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    listener.mockClear();

    unsubscribe();
    controller.next();

    expect(listener).not.toHaveBeenCalled();
  });
});
