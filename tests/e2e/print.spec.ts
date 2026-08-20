import { expect, test } from "@playwright/test";

/**
 * 印刷と PDF 出力（FR-12、D-23）。
 *
 * PDF はブラウザの印刷機能そのものなので、確認するのは menma 側の CSS が
 * 「全スライドを 1 枚 1 ページで出し、操作 UI を消す」ところまで。
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルスライドを見る" }).click();
  await expect(page.locator(".mn-slide:not([hidden])")).toHaveCount(1);
});

test("印刷では全スライドが出て、操作 UI は消える（FR-12）", async ({ page }) => {
  const total = await page.locator(".mn-slide").count();

  await page.emulateMedia({ media: "print" });

  // 画面では 1 枚だけだが、印刷では hidden のスライドも見せる
  await expect(page.locator(".mn-slide")).toHaveCount(total);
  expect(
    await page
      .locator(".mn-slide")
      .evaluateAll((elements) => elements.filter((element) => element.checkVisibility()).length),
  ).toBe(total);

  await expect(page.locator(".mn-hud")).toBeHidden();
  await expect(page.locator(".mn-progress")).toBeHidden();

  // 画面用の拡縮を解いていないと、1 ページに縮んだスライドが載る
  const transform = await page
    .locator(".mn-stage")
    .evaluate((element) => getComputedStyle(element).transform);
  expect(transform).toBe("none");
});

test("PDF は 1 ページ 1 スライドで、ページの大きさが 16:9 になる（FR-12）", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "page.pdf() は Chromium だけの機能");

  const total = await page.locator(".mn-slide").count();
  const pdf = await page.pdf({ preferCSSPageSize: true });
  const text = pdf.toString("latin1");

  expect(text.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(total);

  // 1600x900 px = 1200x675 pt（1px = 0.75pt）。Chrome は端数を丸めるので幅と比率で見る
  const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text);
  const width = Number(box?.[1]);
  const height = Number(box?.[2]);

  expect(width).toBe(1200);
  expect(width / height).toBeCloseTo(16 / 9, 2);
});
