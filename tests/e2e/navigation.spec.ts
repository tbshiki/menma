import { expect, test, type Page } from "@playwright/test";

/**
 * 発表コアの E2E（設計 11 章のシナリオ 1〜8）。
 *
 * 枚数はサンプル原稿に依存するため、ページ番号表示から総数を読み取って組み立てる。
 */

const counter = ".mn-hud__counter";
const visibleSlide = ".mn-slide:not([hidden])";

async function currentPage(page: Page): Promise<number> {
  const text = (await page.locator(counter).textContent()) ?? "";
  return Number(text.split("/")[0]?.trim());
}

async function totalPages(page: Page): Promise<number> {
  const text = (await page.locator(counter).textContent()) ?? "";
  return Number(text.split("/")[1]?.trim());
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(counter)).toBeVisible();
});

test("初期表示は 1 ページ目で、ハッシュが #/1 になる", async ({ page }) => {
  await expect(page.locator(visibleSlide)).toHaveCount(1);
  await expect(page.locator(visibleSlide)).toHaveAttribute("data-index", "0");
  expect(await currentPage(page)).toBe(1);
  expect(page.url()).toContain("#/1");
});

test("ArrowRight で次へ、ArrowLeft で前へ移動する", async ({ page }) => {
  await page.keyboard.press("ArrowRight");
  expect(await currentPage(page)).toBe(2);
  await expect(page.locator(visibleSlide)).toHaveAttribute("data-index", "1");

  await page.keyboard.press("ArrowLeft");
  expect(await currentPage(page)).toBe(1);
  await expect(page.locator(visibleSlide)).toHaveAttribute("data-index", "0");
});

test("Space で次へ、Shift + Space で前へ移動する", async ({ page }) => {
  await page.keyboard.press("Space");
  expect(await currentPage(page)).toBe(2);

  await page.keyboard.press("Shift+Space");
  expect(await currentPage(page)).toBe(1);
});

test("ArrowDown / ArrowUp / PageDown / PageUp / Home / End が効く", async ({ page }) => {
  const total = await totalPages(page);

  await page.keyboard.press("ArrowDown");
  expect(await currentPage(page)).toBe(2);
  await page.keyboard.press("PageDown");
  expect(await currentPage(page)).toBe(3);
  await page.keyboard.press("PageUp");
  expect(await currentPage(page)).toBe(2);
  await page.keyboard.press("ArrowUp");
  expect(await currentPage(page)).toBe(1);

  await page.keyboard.press("End");
  expect(await currentPage(page)).toBe(total);
  await page.keyboard.press("Home");
  expect(await currentPage(page)).toBe(1);
});

test("ページ移動でハッシュが更新され、戻る・進むが機能する", async ({ page }) => {
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#\/2$/);

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#\/3$/);

  await page.goBack();
  await expect(page).toHaveURL(/#\/2$/);
  expect(await currentPage(page)).toBe(2);

  await page.goForward();
  await expect(page).toHaveURL(/#\/3$/);
  expect(await currentPage(page)).toBe(3);
});

test("#/5 を直接開くと 5 ページ目が表示される", async ({ page }) => {
  await page.goto("/#/5");
  await expect(page.locator(visibleSlide)).toHaveAttribute("data-index", "4");
  expect(await currentPage(page)).toBe(5);
});

test("端でループしない", async ({ page }) => {
  await page.keyboard.press("ArrowLeft");
  expect(await currentPage(page)).toBe(1);

  const total = await totalPages(page);
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowRight");
  expect(await currentPage(page)).toBe(total);
});

test("不正なハッシュを安全に正規化する", async ({ page }) => {
  const total = await totalPages(page);

  for (const hash of ["#/0", "#/-1", "#/abc", "#/"]) {
    await page.goto(`/${hash}`);
    expect(await currentPage(page)).toBe(1);
  }

  await page.goto("/#/9999");
  expect(await currentPage(page)).toBe(total);
});

test("入力要素にフォーカスしている間はページが動かない", async ({ page }) => {
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "probe";
    document.body.append(input);
    input.focus();
  });

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");

  expect(await currentPage(page)).toBe(1);
  await expect(page.locator("#probe")).toBeFocused();
});
