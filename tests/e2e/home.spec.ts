import { expect, test, type Page } from "@playwright/test";

/**
 * 入口画面から原稿を渡す経路（FR-24〜FR-29）。
 */

const home = ".mn-home";
const visibleSlide = ".mn-slide:not([hidden])";

async function pasteAndOpen(page: Page, markdown: string): Promise<void> {
  await page.getByRole("textbox", { name: "Markdown の原稿" }).fill(markdown);
  await page.getByRole("button", { name: "スライドにする" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("原稿を渡していないときは入口画面が出る", async ({ page }) => {
  await expect(page.locator(home)).toBeVisible();
  await expect(page.locator(visibleSlide)).toHaveCount(0);

  await expect(page.getByRole("button", { name: "サンプルスライドを見る" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Markdown の原稿" })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toBeAttached();
});

test("サンプルを開くとスライドになる", async ({ page }) => {
  await page.getByRole("button", { name: "サンプルスライドを見る" }).click();

  await expect(page.locator(visibleSlide)).toHaveCount(1);
  await expect(page.locator(home)).toHaveCount(0);
  await expect(page).toHaveURL(/#\/1$/);
});

test("貼り付けた原稿がスライドになる", async ({ page }) => {
  await pasteAndOpen(page, "# 貼り付けた見出し\n\n---\n\n# 2 枚目");

  await expect(page.locator(visibleSlide)).toContainText("貼り付けた見出し");
  await expect(page.locator(".mn-slide")).toHaveCount(2);
});

test("ファイルを読み込むとスライドになる", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "talk.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# ファイルの見出し\n\n本文", "utf8"),
  });

  await expect(page.locator(visibleSlide)).toContainText("ファイルの見出し");
});

test("対応していない拡張子は理由を出して受け付けない", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "slides.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4", "utf8"),
  });

  await expect(page.getByRole("alert")).toContainText("slides.pdf");
  await expect(page.locator(visibleSlide)).toHaveCount(0);
});

test("空の原稿は理由を出して受け付けない", async ({ page }) => {
  await pasteAndOpen(page, "   \n  \n");

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(visibleSlide)).toHaveCount(0);
});

test("スライドにできない原稿は理由を出して受け付けない", async ({ page }) => {
  // Front Matter が閉じていない
  await pasteAndOpen(page, "---\ntitle: 未完\n\n# 本文");

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(visibleSlide)).toHaveCount(0);
});

test("リロードしても同じ原稿・同じページから再開できる", async ({ page }) => {
  await pasteAndOpen(page, "# 1 枚目\n\n---\n\n# 2 枚目\n\n---\n\n# 3 枚目");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#\/2$/);

  await page.reload();

  await expect(page.locator(visibleSlide)).toContainText("2 枚目");
  await expect(page).toHaveURL(/#\/2$/);
});

test("ブラウザの戻るで入口画面へ帰れる", async ({ page }) => {
  await page.getByRole("button", { name: "サンプルスライドを見る" }).click();
  await expect(page.locator(visibleSlide)).toHaveCount(1);

  await page.goBack();

  await expect(page.locator(home)).toBeVisible();
  await expect(page.locator(visibleSlide)).toHaveCount(0);
});

test("原稿が URL へ載らない（D-19）", async ({ page }) => {
  await pasteAndOpen(page, "# 秘密の見出し\n\n本文");
  await expect(page.locator(visibleSlide)).toContainText("秘密の見出し");

  expect(page.url()).not.toContain("秘密");
  expect(decodeURIComponent(page.url())).not.toContain("秘密");
  await expect(page).toHaveURL(/#\/1$/);
});

test("Front Matter で余白とバーの色を変えられる（FR-36）", async ({ page }) => {
  await pasteAndOpen(
    page,
    [
      "---",
      "pageBackground: rgb(18, 52, 86)",
      "progressColor: rgb(171, 205, 239)",
      "---",
      "# 色",
    ].join("\n"),
  );

  await expect(page.locator(".mn-deck")).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await expect(page.locator(".mn-progress__bar")).toHaveCSS(
    "background-color",
    "rgb(171, 205, 239)",
  );
});

test("色を指定しなければテーマの値を使う", async ({ page }) => {
  await pasteAndOpen(page, "# 指定なし");

  await expect(page.locator(".mn-deck")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("入口画面で選んだ色が原稿の指定より優先される（FR-37）", async ({ page }) => {
  // 入口で色を変えてから、別の色を書いた原稿を開く
  await page.getByLabel("スライドの外側").fill("#102030");
  await pasteAndOpen(page, ["---", "pageBackground: #ffeeee", "---", "# 優先順位"].join("\n"));

  await expect(page.locator(".mn-deck")).toHaveCSS("background-color", "rgb(16, 32, 48)");
});

test("原稿の指定に戻すと UI の色を使わなくなる", async ({ page }) => {
  await page.getByLabel("スライドの外側").fill("#102030");
  await page.getByRole("button", { name: "原稿の指定に戻す" }).click();

  await pasteAndOpen(
    page,
    ["---", "pageBackground: rgb(255, 238, 238)", "---", "# 戻した"].join("\n"),
  );

  await expect(page.locator(".mn-deck")).toHaveCSS("background-color", "rgb(255, 238, 238)");
});

test("入口画面で選んだ色は次に開いたときも残る", async ({ page }) => {
  await page.getByLabel("進み具合のバー").fill("#f97316");
  await page.reload();

  await expect(page.getByLabel("進み具合のバー")).toHaveValue("#f97316");

  await pasteAndOpen(page, "# 保存の確認");
  await expect(page.locator(".mn-progress__bar")).toHaveCSS(
    "background-color",
    "rgb(249, 115, 22)",
  );
});

test("外側が暗いときは操作 UI を明るい文字にする（D-21）", async ({ page }) => {
  await pasteAndOpen(
    page,
    ["---", "pageBackground: rgb(16, 20, 24)", "---", "# 暗い余白"].join("\n"),
  );

  // 濃い余白の上でページ番号が埋もれないこと
  await expect(page.locator(".mn-hud")).toHaveCSS("color", "rgb(244, 246, 248)");
});

test("保存した原稿を消すと次回は入口から始まる", async ({ page }) => {
  await pasteAndOpen(page, "# 消される原稿");
  await expect(page.locator(visibleSlide)).toHaveCount(1);

  await page.goBack();
  await page.getByRole("button", { name: "保存した原稿を消す" }).click();
  await page.goto("/");
  await page.reload();

  await expect(page.locator(home)).toBeVisible();
  await expect(page.getByRole("button", { name: "前回の原稿を開く" })).toHaveCount(0);
});
