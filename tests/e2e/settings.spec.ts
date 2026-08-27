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
  await page.getByLabel("進み具合のバー").selectOption("出さない");

  await expect(page.locator(".mn-progress")).toBeHidden();
  // 原稿は書き換えない。スライドはそのまま
  await expect(page.locator(visibleSlide)).toContainText("設定の確認");
});

test("原稿が消しているバーを出すこともできる（優先順位は UI → 原稿）", async ({ page }) => {
  await open(page, ["---", "showProgress: false", "---", "# バー無しの原稿"].join("\n"));
  await expect(page.locator(".mn-progress")).toBeHidden();

  await page.locator(gear).click();
  await page.getByLabel("進み具合のバー").selectOption("出す");

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
  await page.getByLabel("進み具合のバー").selectOption("出さない");

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

test("入口画面の「原稿の指定に戻す」はバーの設定も戻す", async ({ page }) => {
  await open(page);

  await page.locator(gear).click();
  await page.getByLabel("進み具合のバー").selectOption("出さない");
  await expect(page.locator(".mn-progress")).toBeHidden();

  // 入口へ戻って、まとめて戻す
  await page.goBack();
  await expect(page.locator(".mn-home")).toBeVisible();
  await page.getByRole("button", { name: "原稿の指定に戻す" }).click();

  await page.getByRole("textbox", { name: "Markdown の原稿" }).fill("# 戻したあと");
  await page.getByRole("button", { name: "スライドにする" }).click();

  await expect(page.locator(".mn-progress")).toBeVisible();
});

test("設定ボタンが開閉の状態を持つ（FR-22）", async ({ page }) => {
  await open(page);

  await expect(page.locator(gear)).toHaveAttribute("aria-expanded", "false");

  await page.locator(gear).click();
  await expect(page.locator(gear)).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(page.locator(gear)).toHaveAttribute("aria-expanded", "false");
});

test("Esc で閉じたあともキーでページを送れる（FR-14）", async ({ page }) => {
  await open(page);

  await page.locator(gear).click();
  // 中の入力までフォーカスを進めてから閉じる
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(page.locator(panel)).toBeHidden();

  // 隠れた入力にフォーカスが残ると、以降キーがそこへ届き続けて移動できなくなる
  const stuck = await page.evaluate(() => {
    const element = document.querySelector(".mn-settings");
    return element !== null && element.contains(document.activeElement);
  });
  expect(stuck).toBe(false);

  await page.keyboard.press("ArrowRight");

  await expect(page).toHaveURL(/#\/2$/);
});

test("パネルの外にフォーカスがあっても Esc で閉じる", async ({ page }) => {
  await open(page);

  await page.locator(gear).click();
  await expect(page.locator(panel)).toBeVisible();

  // 全画面ボタンなど、パネルの外へフォーカスを移してから閉じる
  await page.locator('.mn-hud__button[aria-label="全画面表示"]').focus();
  await page.keyboard.press("Escape");

  await expect(page.locator(panel)).toBeHidden();
});

test("原稿に従う状態へ戻せる（3 状態）", async ({ page }) => {
  await open(page, ["---", "showProgress: false", "---", "# バー無しの原稿"].join("\n"));

  await page.locator(gear).click();
  await page.getByLabel("進み具合のバー").selectOption("出す");
  await expect(page.locator(".mn-progress")).toBeVisible();

  // 原稿に従う へ戻すと、色の指定は残したままバーだけ原稿の指定に帰る
  await page.getByLabel("スライドの外側の色").fill("#102030");
  await page.getByLabel("進み具合のバー").selectOption({ value: "" });

  await expect(page.locator(".mn-progress")).toBeHidden();
  await expect(page.locator(".mn-deck")).toHaveCSS("background-color", "rgb(16, 32, 48)");
});

test("読み直しの知らせが設定パネルに隠れない", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Markdown の原稿" }).fill("# 重なりの確認");
  await page.getByRole("button", { name: "スライドにする" }).click();

  await page.locator(gear).click();
  await expect(page.locator(panel)).toBeVisible();

  // 知らせの居場所を作るため、直接出す代わりに位置関係だけを見る
  const panelBox = await page.locator(panel).boundingBox();
  const actionsBox = await page.locator(".mn-hud__actions").boundingBox();

  expect(panelBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  // パネルは操作ボタンの上にあり、重なっていない
  expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual(actionsBox?.y ?? 0);
});

test("入口画面からもバーの表示を決められる（FR-43）", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("進み具合のバー").selectOption("出さない");

  await page.getByRole("textbox", { name: "Markdown の原稿" }).fill("# 入口で消したバー");
  await page.getByRole("button", { name: "スライドにする" }).click();

  await expect(page.locator(".mn-progress")).toBeHidden();
});
