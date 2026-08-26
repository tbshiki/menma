import { expect, test, type Page } from "@playwright/test";

/**
 * 原稿の読み直し（FR-40〜FR-42）。
 *
 * File System Access API は Playwright から操作できないため、`showOpenFilePicker` と
 * ファイル参照を偽物へ差し替えて確かめる。差し替えるのはブラウザ側の API だけで、
 * menma のコードはそのまま動かす。
 */

const home = ".mn-home";
const visibleSlide = ".mn-slide:not([hidden])";
const reloadButton = '.mn-hud__button[aria-label^="原稿を読み直す"]';
const status = ".mn-hud__status";

const FIRST = "# 1 枚目\n\n---\n\n# 2 枚目";
const SECOND = "# 書き換えた 1 枚目\n\n---\n\n# 書き換えた 2 枚目";

/** 偽のファイル。中身・更新時刻・読み込みにかかる時間はテストから書き換える */
async function stubFileSystem(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // picks はファイル選択を開いた回数。参照が効いていれば 2 回目以降は増えない
    const state = { text: "", lastModified: 1000, delay: 0, broken: false, picks: 0 };

    const abort = (): Promise<never> => {
      const error = new Error("閉じた");
      error.name = "AbortError";
      return Promise.reject(error);
    };

    Object.assign(window, {
      menmaFile: state,
      // 参照が読めない状態ではここへ落ちる。テストでは常に閉じられたものとして扱う
      showOpenFilePicker: () => {
        state.picks += 1;

        return state.broken
          ? abort()
          : Promise.resolve([
              {
                kind: "file",
                name: "talk.md",
                queryPermission: () => Promise.resolve("granted"),
                requestPermission: () => Promise.resolve("granted"),
                getFile: () =>
                  state.broken
                    ? Promise.reject(new Error("読めない"))
                    : new Promise((resolve) =>
                        setTimeout(
                          () =>
                            resolve(
                              new File([state.text], "talk.md", {
                                lastModified: state.lastModified,
                              }),
                            ),
                          state.delay,
                        ),
                      ),
              },
            ]);
      },
    });
  });
}

async function writeFile(page: Page, text: string, lastModified: number, delay = 0): Promise<void> {
  await page.evaluate(
    ([nextText, nextTime, nextDelay]) => {
      const state = (
        window as unknown as { menmaFile: { text: string; lastModified: number; delay: number } }
      ).menmaFile;
      state.text = nextText as string;
      state.lastModified = nextTime as number;
      state.delay = nextDelay as number;
    },
    [text, lastModified, delay] as const,
  );
}

async function pickCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { menmaFile: { picks: number } }).menmaFile.picks,
  );
}

/** 参照を覚えさせる。1 度読み直せば、以降はファイル選択を通らない */
async function linkHandle(page: Page): Promise<void> {
  await page.locator(reloadButton).click();
  await expect(page.locator(status)).toHaveText("変更はありません。");
}

test.beforeEach(async ({ page }) => {
  await stubFileSystem(page);
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "talk.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(FIRST, "utf8"),
  });
  await expect(page.locator(visibleSlide)).toContainText("1 枚目");
  await writeFile(page, FIRST, 1000);
});

test("入口画面から選んだ原稿は、ファイル選択を通らずに読み直せる（FR-40）", async ({ page }) => {
  await page.goto("/");
  await writeFile(page, FIRST, 1000);

  await page.getByRole("button", { name: "ファイルを選ぶ" }).click();
  await expect(page.locator(visibleSlide)).toContainText("1 枚目");
  expect(await pickCount(page)).toBe(1);

  await writeFile(page, SECOND, 2000);
  await page.locator(reloadButton).click();

  await expect(page.locator(visibleSlide)).toContainText("書き換えた 1 枚目");
  // 開いたときの参照をそのまま使うので、ファイル選択は増えない
  expect(await pickCount(page)).toBe(1);
});

test("貼り付けた原稿には読み直しのボタンを出さない", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Markdown の原稿" }).fill("# 貼り付け");
  await page.getByRole("button", { name: "スライドにする" }).click();

  await expect(page.locator(visibleSlide)).toContainText("貼り付け");
  await expect(page.locator(reloadButton)).toHaveCount(0);
});

test("書き換えた原稿を読み直し、同じページのまま続けられる", async ({ page }) => {
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#\/2$/);

  await writeFile(page, SECOND, 2000);
  await page.locator(reloadButton).click();

  await expect(page.locator(visibleSlide)).toContainText("書き換えた 2 枚目");
  await expect(page).toHaveURL(/#\/2$/);
  await expect(page.locator(status)).toHaveText("読み直しました。");
});

test("2 回目からはファイル選択を通らずに読み直せる", async ({ page }) => {
  await writeFile(page, SECOND, 2000);
  await page.locator(reloadButton).click();
  await expect(page.locator(visibleSlide)).toContainText("書き換えた 1 枚目");

  // 参照を覚えているはずなので、ファイル選択が無くなっても読み直せる
  await page.evaluate(() => {
    delete (window as unknown as Record<string, unknown>)["showOpenFilePicker"];
  });
  await writeFile(page, "# 3 回目の原稿", 3000);
  await page.locator(reloadButton).click();

  await expect(page.locator(visibleSlide)).toContainText("3 回目の原稿");
});

test("中身が同じなら変更が無いことだけを伝える", async ({ page }) => {
  await page.locator(reloadButton).click();

  await expect(page.locator(status)).toHaveText("変更はありません。");
  await expect(page.locator(visibleSlide)).toContainText("1 枚目");
});

test("戻ってきたときに更新を見つけると印を付ける（反映はしない）", async ({ page }) => {
  // 参照を覚えさせるために 1 度読み直す
  await page.locator(reloadButton).click();
  await expect(page.locator(status)).toHaveText("変更はありません。");

  await writeFile(page, SECOND, 2000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });

  await expect(page.locator(reloadButton)).toHaveAttribute("data-updated", "true");
  // 印が付くだけで、画面は変わらない（D-27）
  await expect(page.locator(visibleSlide)).toContainText("1 枚目");
});

test("読み直した内容はリロードしても残る（FR-27）", async ({ page }) => {
  await writeFile(page, SECOND, 2000);
  await page.locator(reloadButton).click();
  await expect(page.locator(visibleSlide)).toContainText("書き換えた 1 枚目");

  await page.reload();

  await expect(page.locator(visibleSlide)).toContainText("書き換えた 1 枚目");
});

test("読み込みの途中で入口へ戻ったら、発表画面へ引き戻さない（FR-28）", async ({ page }) => {
  await linkHandle(page);

  // 読み込みに時間がかかる状態にして、待っている間に戻る
  await writeFile(page, SECOND, 2000, 1500);
  await page.locator(reloadButton).click();
  await page.goBack();
  await expect(page.locator(home)).toBeVisible();

  await page.waitForTimeout(2500);

  await expect(page.locator(home)).toBeVisible();
  await expect(page.locator(visibleSlide)).toHaveCount(0);
});

test("取り消しても更新の印と知らせを消さない（FR-41）", async ({ page }) => {
  await linkHandle(page);

  await writeFile(page, SECOND, 2000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page.locator(reloadButton)).toHaveAttribute("data-updated", "true");
  // 更新を見つけただけで、読みかけの知らせは消さない
  await expect(page.locator(status)).toHaveText("変更はありません。");

  // ファイルが読めなくなり、選び直しも閉じられた状態にする
  await page.evaluate(() => {
    (window as unknown as { menmaFile: { broken: boolean } }).menmaFile.broken = true;
  });
  await page.locator(reloadButton).click();

  // 取り消しても、更新はまだ残っているので印は消さない
  await expect(page.locator(reloadButton)).toHaveAttribute("data-updated", "true");
  await expect(page.locator(reloadButton)).toBeEnabled();
});

test("読み直した原稿が壊れていても表示中のスライドを壊さない", async ({ page }) => {
  await writeFile(page, "---\ntitle: 閉じない Front Matter\n", 2000);
  await page.locator(reloadButton).click();

  await expect(page.locator(status)).not.toBeEmpty();
  await expect(page.locator(visibleSlide)).toContainText("1 枚目");
});
