import { expect, test, type Page } from "@playwright/test";

/**
 * 発表中の設定（FR-43、D-28）。
 *
 * 変えられるのはこの端末での見え方だけで、原稿は書き換えない。
 */

const visibleSlide = ".mn-slide:not([hidden])";
const panel = ".mn-settings";
const gear = '.mn-hud__button[aria-label="表示の設定"]';

async function open(page: Page, markdown = "# 設定の確認\n\n---\n\n# 2 枚目"): Promise<void> {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Markdown の原稿" }).fill(markdown);
  await page.getByRole("button", { name: "スライドにする" }).click();
  await expect(page.locator(visibleSlide)).toBeVisible();
}

test("設定は既定で閉じていて、⚙ で開閉できる", async ({ page }) => {
  await open(page);

  await expect(page.locator(panel)).toBeHidden();

  await page.locator(gear).click();
  await expect(page.locator(panel)).toBeVisible();

  await page.locator(gear).click();
  await expect(page.locator(panel)).toBeHidden();
});

test("Esc と外側のクリックで閉じる", async ({ page }) => {
  await open(page);

  await page.locator(gear).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(panel)).toBeHidden();

  await page.locator(gear).click();
  await expect(page.locator(panel)).toBeVisible();
  await page.locator(visibleSlide).click({ position: { x: 10, y: 10 } });
  await expect(page.locator(panel)).toBeHidden();
});

test("進み具合のバーをその場で消せる（FR-43）", async ({ page }) => {
  await open(page);
  await expect(page.locator(".mn-progress")).toBeVisible();

  await page.locator(gear).click();
  await page.getByLabel("進み具合のバーを出す").uncheck();

  await expect(page.locator(".mn-progress")).toBeHidden();
  // 原稿は書き換えない。スライドはそのまま
  await expect(page.locator(visibleSlide)).toContainText("設定の確認");
});

test("原稿が消しているバーを出すこともできる（優先順位は UI → 原稿）", async ({ page }) => {
  await open(page, ["---", "showProgress: false", "---", "# バー無しの原稿"].join("\n"));
  await expect(page.locator(".mn-progress")).toBeHidden();

  await page.locator(gear).click();
  await page.getByLabel("進み具合のバーを出す").check();

  await expect(page.locator(".mn-progress")).toBeVisible();
});

test("色をその場で変えられ、操作 UI の文字色も付いてくる（D-21）", async ({ page }) => {
  await open(page);

  await page.locator(gear).click();
  await page.getByLabel("スライドの外側の色").fill("#101418");
  await page.getByLabel("バーの色").fill("#f97316");

  await expect(page.locator(".mn-deck")).toHaveCSS("background-color", "rgb(16, 20, 24)");
  await expect(page.locator(".mn-progress__bar")).toHaveCSS(
    "background-color",
    "rgb(249, 115, 22)",
  );
  await expect(page.locator(".mn-hud")).toHaveCSS("color", "rgb(244, 246, 248)");
});

test("暗い色から明るい色へ戻すと、操作 UI の文字色も戻る（D-21）", async ({ page }) => {
  await open(page);
  const light = "rgb(244, 246, 248)";

  await page.locator(gear).click();
  await page.getByLabel("スライドの外側の色").fill("#101418");
  await expect(page.locator(".mn-hud")).toHaveCSS("color", light);

  // 当て直しではなく足すだけにすると、ここで明るい文字色が残ってしまう
  await page.getByLabel("スライドの外側の色").fill("#ffffff");

  await expect(page.locator(".mn-hud")).not.toHaveCSS("color", light);
});

test("発表中に変えた設定は次に開いたときも残る", async ({ page }) => {
  await open(page);

  await page.locator(gear).click();
  await page.getByLabel("スライドの外側の色").fill("#102030");
  await page.getByLabel("進み具合のバーを出す").uncheck();

  await page.reload();

  await expect(page.locator(".mn-deck")).toHaveCSS("background-color", "rgb(16, 32, 48)");
  await expect(page.locator(".mn-progress")).toBeHidden();
});

test("原稿の指定に戻すと、原稿とテーマの値へ帰る", async ({ page }) => {
  await open(
    page,
    ["---", "pageBackground: rgb(255, 238, 238)", "---", "# 色つきの原稿"].join("\n"),
  );

  await page.locator(gear).click();
  await page.getByLabel("スライドの外側の色").fill("#102030");
  await expect(page.locator(".mn-deck")).toHaveCSS("background-color", "rgb(16, 32, 48)");

  await page.getByRole("button", { name: "原稿の指定に戻す" }).click();

  await expect(page.locator(".mn-deck")).toHaveCSS("background-color", "rgb(255, 238, 238)");
  await expect(page.locator(".mn-progress")).toBeVisible();
});

test("開いたときは、いま出ている色が入っている", async ({ page }) => {
  await open(page, ["---", "pageBackground: rgb(18, 52, 86)", "---", "# 原稿の色"].join("\n"));

  await page.locator(gear).click();

  await expect(page.getByLabel("スライドの外側の色")).toHaveValue("#123456");
});

test("入口画面で設定した値が発表画面の設定にも出る", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("スライドの外側").fill("#204060");
  await page.getByRole("textbox", { name: "Markdown の原稿" }).fill("# 入口で決めた色");
  await page.getByRole("button", { name: "スライドにする" }).click();

  await page.locator(gear).click();

  await expect(page.getByLabel("スライドの外側の色")).toHaveValue("#204060");
});
