import { expect, test, type Page } from "@playwright/test";

/**
 * 原稿と一緒に選んだ画像の取り込み（FR-30〜FR-34）。
 *
 * blob URL と IndexedDB は実ブラウザでしか確かめられないため、ここで押さえる（D-20）。
 */

const visibleSlide = ".mn-slide:not([hidden])";

/** 1x1 の PNG。中身は問わないので最小のものを使う */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type UploadFile = { name: string; mimeType: string; buffer: Buffer };

function markdown(text: string, name = "talk.md"): UploadFile {
  return { name, mimeType: "text/markdown", buffer: Buffer.from(text, "utf8") };
}

function png(name: string, bytes = PNG): UploadFile {
  return { name, mimeType: "image/png", buffer: bytes };
}

async function open(page: Page, files: UploadFile[]): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(files);
}

/** 表示されている画像が実際に読み込めたか（壊れた画像でないか） */
async function imageLoaded(page: Page): Promise<boolean> {
  return page
    .locator(`${visibleSlide} img`)
    .first()
    .evaluate((image) => {
      const element = image as HTMLImageElement;
      return element.complete && element.naturalWidth > 0;
    });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("相対パスの画像が取り込んだ画像で表示される", async ({ page }) => {
  await open(page, [markdown("# 図\n\n![図](./img/flow.png)"), png("flow.png")]);

  const image = page.locator(`${visibleSlide} img`);
  await expect(image).toHaveAttribute("src", /^blob:/);
  expect(await imageLoaded(page)).toBe(true);
});

test("階層が違ってもファイル名で結び付く", async ({ page }) => {
  await open(page, [markdown("![深い](../../assets/deep.png)"), png("deep.png")]);

  await expect(page.locator(`${visibleSlide} img`)).toHaveAttribute("src", /^blob:/);
});

test("絶対 URL の画像は取り込みの対象にしない", async ({ page }) => {
  await open(page, [markdown("![外部](https://example.com/remote.png)")]);

  await expect(page.locator(`${visibleSlide} img`)).toHaveAttribute(
    "src",
    "https://example.com/remote.png",
  );
});

test("選ばれていない画像を開く前に知らせ、そのまま開ける（FR-34）", async ({ page }) => {
  await open(page, [markdown("![無い](./missing.png)")]);

  await expect(page.getByRole("status")).toContainText("missing.png");
  await expect(page.locator(visibleSlide)).toHaveCount(0);

  await page.getByRole("button", { name: "このまま開く" }).click();

  await expect(page.locator(visibleSlide)).toHaveCount(1);
});

test("10MB を超える画像は取り込まず、理由を伝える（FR-33）", async ({ page }) => {
  const huge = png("huge.png", Buffer.alloc(10 * 1024 * 1024 + 1));
  await open(page, [markdown("![大きい](./huge.png)"), huge]);

  const notice = page.getByRole("status");
  await expect(notice).toContainText("huge.png");
  await expect(notice).toContainText("10MB");
  await expect(page.locator(visibleSlide)).toHaveCount(0);
});

test("画像でないファイルは取り込まず、理由を伝える", async ({ page }) => {
  await open(page, [
    markdown("# 見出し"),
    { name: "movie.mp4", mimeType: "video/mp4", buffer: Buffer.from("x") },
  ]);

  await expect(page.getByRole("status")).toContainText("movie.mp4");

  await page.getByRole("button", { name: "このまま開く" }).click();
  await expect(page.locator(visibleSlide)).toHaveCount(1);
});

test("リロードしても画像ごと再開できる（FR-32）", async ({ page }) => {
  await open(page, [markdown("# 図\n\n![図](./flow.png)"), png("flow.png")]);
  await expect(page.locator(`${visibleSlide} img`)).toHaveAttribute("src", /^blob:/);

  await page.reload();

  await expect(page.locator(`${visibleSlide} img`)).toHaveAttribute("src", /^blob:/);
  expect(await imageLoaded(page)).toBe(true);
});

test("背景画像も取り込んだ画像で表示される", async ({ page }) => {
  await open(page, [
    markdown("@slide layout=cover background=./hero.png\n\n# 表紙"),
    png("hero.png"),
  ]);

  const background = await page
    .locator(visibleSlide)
    .evaluate((slide) => getComputedStyle(slide).backgroundImage);

  expect(background).toContain("blob:");
});

test("画像を URL へ載せない（D-19）", async ({ page }) => {
  await open(page, [markdown("![図](./secret-name.png)"), png("secret-name.png")]);
  await expect(page.locator(visibleSlide)).toHaveCount(1);

  expect(page.url()).not.toContain("secret-name");
  expect(page.url()).not.toContain("blob:");
  await expect(page).toHaveURL(/#\/1$/);
});
