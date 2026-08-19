import { expect, test, type Page } from "@playwright/test";

/**
 * 発表コアの E2E（設計 11 章のシナリオ 1〜8）。
 *
 * 「いま何枚目か」は DOM の `data-index` から読む。ページ番号表示は Front Matter で
 * 消せるため、それに依存すると原稿の設定を変えただけでテストが壊れる。
 */

const visibleSlide = ".mn-slide:not([hidden])";
const counter = ".mn-hud__counter";

/** 表示中スライドのページ番号（1 始まり） */
async function currentPage(page: Page): Promise<number> {
  const index = await page.locator(visibleSlide).getAttribute("data-index");
  return Number(index) + 1;
}

async function totalPages(page: Page): Promise<number> {
  return page.locator(".mn-slide").count();
}

/**
 * 開いた状態からハッシュだけを書き換える（アドレスバー編集や共有リンクの踏み直しに相当）。
 * ページはリロードされず hashchange だけが起きる経路で、full load とは別物。
 */
async function changeHash(page: Page, hash: string): Promise<void> {
  await page.evaluate((value) => {
    window.location.hash = value;
  }, hash);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(visibleSlide)).toHaveCount(1);
});

test("初期表示は 1 ページ目で、ハッシュが #/1 になる", async ({ page }) => {
  await expect(page.locator(visibleSlide)).toHaveAttribute("data-index", "0");
  expect(page.url()).toContain("#/1");
});

test("表示中のスライドは常に 1 枚だけ", async ({ page }) => {
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(visibleSlide)).toHaveCount(1);

  await page.keyboard.press("End");
  await expect(page.locator(visibleSlide)).toHaveCount(1);
});

test("ArrowRight で次へ、ArrowLeft で前へ移動する", async ({ page }) => {
  await page.keyboard.press("ArrowRight");
  expect(await currentPage(page)).toBe(2);

  await page.keyboard.press("ArrowLeft");
  expect(await currentPage(page)).toBe(1);
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

test("#/N で任意のページを直接開ける", async ({ page }) => {
  const total = await totalPages(page);
  expect(total).toBeGreaterThanOrEqual(5);

  await page.goto("/#/5");
  expect(await currentPage(page)).toBe(5);
});

test("ハッシュを書き換えるとページが移動する", async ({ page }) => {
  await changeHash(page, "#/4");

  expect(await currentPage(page)).toBe(4);
  await expect(page).toHaveURL(/#\/4$/);
});

test("表示中のページと同じ位置になる不正ハッシュでも URL を正規形へ直す", async ({ page }) => {
  const total = await totalPages(page);

  for (const hash of ["#/0", "#/abc", "#/-1"]) {
    await changeHash(page, hash);

    expect(await currentPage(page)).toBe(1);
    await expect(page).toHaveURL(/#\/1$/);
  }

  await page.keyboard.press("End");
  await changeHash(page, "#/9999");

  expect(await currentPage(page)).toBe(total);
  await expect(page).toHaveURL(new RegExp(`#/${String(total)}$`));
});

test("端でループしない", async ({ page }) => {
  await page.keyboard.press("ArrowLeft");
  expect(await currentPage(page)).toBe(1);

  const total = await totalPages(page);
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowRight");
  expect(await currentPage(page)).toBe(total);
});

test("不正なハッシュで開いても壊れない", async ({ page }) => {
  const total = await totalPages(page);

  for (const hash of ["#/0", "#/-1", "#/abc", "#/"]) {
    await page.goto(`/${hash}`);
    expect(await currentPage(page)).toBe(1);
    await expect(page).toHaveURL(/#\/1$/);
  }

  await page.goto("/#/9999");
  expect(await currentPage(page)).toBe(total);
  await expect(page).toHaveURL(new RegExp(`#/${String(total)}$`));
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

test("ページ番号が現在位置を示す", async ({ page }) => {
  const total = await totalPages(page);

  await expect(page.locator(counter)).toHaveText(`1 / ${String(total)}`);

  await page.keyboard.press("ArrowRight");
  await expect(page.locator(counter)).toHaveText(`2 / ${String(total)}`);
});

/**
 * ページを読み込み直す経路。`beforeEach` の後にハッシュだけ変えると hashchange しか起きず、
 * 初期化コードを通らない。共有 URL を新しいタブで開く場合はこちらが本番の経路になる。
 */
test.describe("読み込み直後の初期位置", () => {
  test("#/5 を新規に読み込むと 5 ページ目から始まる", async ({ page }) => {
    await page.goto("/#/5");
    await page.reload();

    expect(await currentPage(page)).toBe(5);
    await expect(page).toHaveURL(/#\/5$/);
  });

  test("不正なハッシュを新規に読み込んでも 1 ページ目から始まる", async ({ page }) => {
    await page.goto("/#/abc");
    await page.reload();

    expect(await currentPage(page)).toBe(1);
    await expect(page).toHaveURL(/#\/1$/);
  });

  test("ハッシュ無しで読み込むと #/1 へ正規化される", async ({ page }) => {
    await page.goto("/");
    await page.reload();

    expect(await currentPage(page)).toBe(1);
    await expect(page).toHaveURL(/#\/1$/);
  });
});

test("スライドの layout がそのまま DOM へ出る", async ({ page }) => {
  // サンプル原稿の 1 枚目は cover、3 枚目は center
  await expect(page.locator('.mn-slide[data-index="0"]')).toHaveAttribute("data-layout", "cover");
  await expect(page.locator('.mn-slide[data-index="2"]')).toHaveAttribute("data-layout", "center");
  await expect(page.locator('.mn-slide[data-index="1"]')).toHaveAttribute("data-layout", "default");
});
