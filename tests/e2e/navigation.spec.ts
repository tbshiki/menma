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
 * サンプルを開いて発表画面まで進める。入口画面が挟まるようになったため、
 * スライドの検証はどれもここから始める。
 */
async function openSample(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルスライドを見る" }).click();
  await expect(page.locator(visibleSlide)).toHaveCount(1);
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
  await openSample(page);
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
 * ページを読み込み直す経路。開いた状態でハッシュだけ変えると hashchange しか起きず、
 * 初期化コードを通らない。共有 URL を新しいタブで開く場合はこちらが本番の経路になる。
 *
 * 原稿はブラウザに保存されているものを使うため、先にサンプルを開いておく。
 */
test.describe("読み込み直後の初期位置", () => {
  test("#/5 を新規に読み込むと 5 ページ目から始まる", async ({ page }) => {
    await openSample(page);
    await page.goto("/#/5");
    await page.reload();

    expect(await currentPage(page)).toBe(5);
    await expect(page).toHaveURL(/#\/5$/);
  });

  test("不正なハッシュを新規に読み込んでも 1 ページ目から始まる", async ({ page }) => {
    await openSample(page);
    await page.goto("/#/abc");
    await page.reload();

    expect(await currentPage(page)).toBe(1);
    await expect(page).toHaveURL(/#\/1$/);
  });

  test("ハッシュ無しで読み込むと入口画面へ戻る", async ({ page }) => {
    await openSample(page);
    await page.goto("/");
    await page.reload();

    await expect(page.locator(".mn-home")).toBeVisible();
    await expect(page.locator(visibleSlide)).toHaveCount(0);
  });
});

test.describe("表示", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("最初の描画から 16:9 を保って表示領域に収まっている", async ({ page }) => {
    // リサイズを挟まずに確認する。初回の倍率計算が誤っていても、
    // 画面サイズを変えたあとに直ってしまうと気づけないため
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    const box = await page.locator(".mn-stage").boundingBox();
    expect(box).not.toBeNull();

    if (!viewport || !box) {
      return;
    }

    expect(box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
  });

  test("ウィンドウの比率を変えても 16:9 のまま、縦か横がいっぱいになる", async ({ page }) => {
    for (const size of [
      { width: 1280, height: 720 },
      { width: 800, height: 1200 },
      { width: 1600, height: 600 },
    ]) {
      await page.setViewportSize(size);

      // 倍率の再計算は ResizeObserver → 次フレームの順で走るので、反映を待つ
      await expect(async () => {
        const box = await page.locator(".mn-stage").boundingBox();

        expect(box).not.toBeNull();
        if (!box) {
          return;
        }

        // 1px は端数の丸め分
        expect(box.width).toBeLessThanOrEqual(size.width + 1);
        expect(box.height).toBeLessThanOrEqual(size.height + 1);
        expect(box.width / box.height).toBeCloseTo(16 / 9, 2);

        // どちらか一方は画面ぴったりに埋まる（FR-09）
        const fillsWidth = box.width >= size.width - 1;
        const fillsHeight = box.height >= size.height - 1;
        expect(fillsWidth || fillsHeight).toBe(true);
      }).toPass({ timeout: 2000 });
    }
  });

  test("ページ番号は左下、操作ボタンは右下に出る（FR-18）", async ({ page }) => {
    const viewport = page.viewportSize();
    const counterBox = await page.locator(".mn-hud__counter").boundingBox();
    const actionsBox = await page.locator(".mn-hud__actions").boundingBox();

    expect(viewport).not.toBeNull();
    expect(counterBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();

    if (!viewport || !counterBox || !actionsBox) {
      return;
    }

    // 左半分と右半分に分かれている
    expect(counterBox.x).toBeLessThan(viewport.width / 2);
    expect(actionsBox.x).toBeGreaterThan(viewport.width / 2);

    // どちらも画面下部
    expect(counterBox.y).toBeGreaterThan(viewport.height / 2);
    expect(actionsBox.y).toBeGreaterThan(viewport.height / 2);
  });

  test("操作 UI と進み具合のバーは画面基準で置かれる（FR-18、FR-35）", async ({ page }) => {
    // キャンバスの中に入れるとスライドと一緒に拡縮されて位置が動く
    await expect(page.locator(".mn-deck > .mn-hud")).toHaveCount(1);
    await expect(page.locator(".mn-deck > .mn-progress")).toHaveCount(1);

    await expect(page.locator(".mn-hud")).toHaveCSS("position", "fixed");

    // cover の背景画像などに埋もれないよう、重なり順も明示している
    const hudZ = await page
      .locator(".mn-hud")
      .evaluate((element) => getComputedStyle(element).zIndex);
    expect(Number(hudZ)).toBeGreaterThan(0);
  });

  test("進み具合のバーが位置に応じて伸びる（FR-35）", async ({ page }) => {
    const bar = page.locator(".mn-progress__bar");
    const ratio = async (): Promise<number> =>
      bar.evaluate((element) =>
        Number(getComputedStyle(element).getPropertyValue("--mn-progress")),
      );

    await expect(page.locator(".mn-progress")).toBeVisible();
    expect(await ratio()).toBe(0);

    await page.keyboard.press("ArrowRight");
    expect(await ratio()).toBeGreaterThan(0);

    await page.keyboard.press("End");
    expect(await ratio()).toBe(1);
  });

  test("操作ボタンから移動でき、端では無効になる", async ({ page }) => {
    const nextButton = page.getByRole("button", { name: "次のスライド" });
    const previousButton = page.getByRole("button", { name: "前のスライド" });

    await expect(previousButton).toBeDisabled();

    await nextButton.click();
    expect(await currentPage(page)).toBe(2);
    await expect(page).toHaveURL(/#\/2$/);

    await previousButton.click();
    expect(await currentPage(page)).toBe(1);

    await page.keyboard.press("End");
    await expect(nextButton).toBeDisabled();
  });

  test("ボタンをクリックしたあともキーで操作を続けられる", async ({ page }) => {
    // ボタンにフォーカスが残ると、入力要素と見なされてキー操作が効かなくなる（FR-14）
    await page.getByRole("button", { name: "次のスライド" }).click();
    expect(await currentPage(page)).toBe(2);

    await page.keyboard.press("ArrowRight");
    expect(await currentPage(page)).toBe(3);

    await page.keyboard.press("ArrowLeft");
    expect(await currentPage(page)).toBe(2);
  });

  test("HUD が本文のクリックを遮らない", async ({ page }) => {
    // HUD はスライドの上に重なる。ボタン以外は操作を透過させる
    const hud = page.locator(".mn-hud");
    await expect(hud).toHaveCSS("pointer-events", "none");
    await expect(page.getByRole("button", { name: "次のスライド" })).toHaveCSS(
      "pointer-events",
      "auto",
    );
  });

  test("全画面ボタンに読み上げ用の名前がある", async ({ page }) => {
    await expect(page.getByRole("button", { name: "全画面表示" })).toBeVisible();
  });

  test("@slide の色指定がスライドへ反映される", async ({ page }) => {
    const total = await totalPages(page);
    await page.goto(`/#/${String(total)}`);

    const slide = page.locator(visibleSlide);
    await expect(slide).toHaveCSS("background-color", "rgb(16, 20, 24)");
    await expect(slide).toHaveCSS("color", "rgb(242, 245, 248)");
  });

  test("どのレイアウトでも実際に見えるスライドは 1 枚だけ", async ({ page }) => {
    // hidden 属性の有無だけでなく、CSS 上も本当に隠れているかを見る。
    // レイアウト CSS が display を上書きすると、隠したはずのスライドが重なって見えてしまう
    const total = await totalPages(page);

    for (let page1 = 1; page1 <= total; page1 += 1) {
      await page.goto(`/#/${String(page1)}`);
      await expect(page.locator(".mn-slide:visible")).toHaveCount(1);
      await expect(page.locator(".mn-slide:visible")).toHaveAttribute(
        "data-index",
        String(page1 - 1),
      );
    }
  });
});

test("スライドの layout がそのまま DOM へ出る", async ({ page }) => {
  // サンプル原稿の 1 枚目は cover、3 枚目は center
  await expect(page.locator('.mn-slide[data-index="0"]')).toHaveAttribute("data-layout", "cover");
  await expect(page.locator('.mn-slide[data-index="2"]')).toHaveAttribute("data-layout", "center");
  await expect(page.locator('.mn-slide[data-index="1"]')).toHaveAttribute("data-layout", "default");
});
