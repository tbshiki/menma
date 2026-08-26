import { expect, test, type Page } from "@playwright/test";

/**
 * 画像も含めた読み直し（FR-42）。
 *
 * 右クリック（と Shift + クリック）でだけ画像を読み直す。差し替わったかどうかは、
 * 大きさの違う画像を返して `naturalWidth` で見る。
 */

const visibleSlide = ".mn-slide:not([hidden])";
const reloadButton = '.mn-hud__button[aria-label^="原稿を読み直す"]';
const status = ".mn-hud__status";

/** 原稿 1 つと画像 1 枚を返す偽のファイル選択。画像の大きさと権限はテストから変える */
async function stubFiles(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { imageSize: 4, allowImage: true };

    Object.assign(window, { menmaFiles: state });

    const makeImage = (): Promise<File> =>
      new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = state.imageSize;
        canvas.height = state.imageSize;
        canvas.toBlob((blob) => {
          resolve(new File([blob as Blob], "a.png", { type: "image/png" }));
        });
      });

    Object.assign(window, {
      showOpenFilePicker: () =>
        Promise.resolve([
          {
            kind: "file",
            name: "talk.md",
            queryPermission: () => Promise.resolve("granted"),
            requestPermission: () => Promise.resolve("granted"),
            getFile: () =>
              Promise.resolve(
                new File(["# 図のあるスライド\n\n![図](./img/a.png)"], "talk.md", {
                  lastModified: 1000,
                }),
              ),
          },
          {
            kind: "file",
            name: "a.png",
            // 許可されていない画像は読み直せない（設計 16.2）
            queryPermission: () => Promise.resolve(state.allowImage ? "granted" : "prompt"),
            requestPermission: () => Promise.resolve(state.allowImage ? "granted" : "denied"),
            getFile: () => makeImage(),
          },
        ]),
    });
  });
}

async function imageWidth(page: Page): Promise<number> {
  return page
    .locator(`${visibleSlide} img`)
    .evaluate((element) => (element as HTMLImageElement).naturalWidth);
}

async function changeImage(page: Page, size: number, allow = true): Promise<void> {
  await page.evaluate(
    ([nextSize, nextAllow]) => {
      const state = (
        window as unknown as { menmaFiles: { imageSize: number; allowImage: boolean } }
      ).menmaFiles;
      state.imageSize = nextSize as number;
      state.allowImage = nextAllow as boolean;
    },
    [size, allow] as const,
  );
}

test.beforeEach(async ({ page }) => {
  await stubFiles(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ファイルを選ぶ" }).click();
  await expect(page.locator(`${visibleSlide} img`)).toBeVisible();
  expect(await imageWidth(page)).toBe(4);
});

test("右クリックすると画像も読み直す（FR-42）", async ({ page }) => {
  await changeImage(page, 16);
  await page.locator(reloadButton).click({ button: "right" });

  await expect(page.locator(status)).toHaveText("読み直しました。");
  expect(await imageWidth(page)).toBe(16);
});

test("Shift + クリックでも画像を読み直す（FR-42）", async ({ page }) => {
  await changeImage(page, 16);
  await page.locator(reloadButton).click({ modifiers: ["Shift"] });

  await expect(page.locator(status)).toHaveText("読み直しました。");
  expect(await imageWidth(page)).toBe(16);
});

test("ふつうのクリックでは画像を読み直さない", async ({ page }) => {
  await changeImage(page, 16);
  await page.locator(reloadButton).click();

  await expect(page.locator(status)).toHaveText("変更はありません。");
  expect(await imageWidth(page)).toBe(4);
});

test("読み直せなかった画像は名前を伝え、結果も一緒に出す", async ({ page }) => {
  await changeImage(page, 16, false);
  await page.locator(reloadButton).click({ button: "right" });

  await expect(page.locator(status)).toContainText("a.png");
  // ただし書きだけにせず、読み直しの結果も残す
  await expect(page.locator(status)).toContainText("変更はありません。");
  expect(await imageWidth(page)).toBe(4);
});

test("右クリックしてもキーでページを送れる（FR-14）", async ({ page }) => {
  await page.locator(reloadButton).click({ button: "right" });
  await expect(page.locator(status)).not.toBeEmpty();

  const focused = await page.evaluate(() => document.activeElement?.tagName ?? "?");
  expect(focused).toBe("BODY");
});
