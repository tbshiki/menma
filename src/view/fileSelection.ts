import {
  MAX_ASSETS_TOTAL_BYTES,
  MAX_ASSET_BYTES,
  isSupportedFileName,
  isSupportedImageName,
} from "../deck/source";

/**
 * 選ばれたファイルを原稿と画像へ振り分ける（FR-30、FR-33）。
 *
 * 判断はファイル名と大きさだけで行うので、DOM に触れずに検証できる。
 */

export type RejectedFile = {
  name: string;
  reason: "unsupported" | "too-large" | "total-exceeded";
};

export type FileSelection = {
  /** 原稿。複数選ばれた場合は 1 つ目（FR-25） */
  markdown: File | undefined;
  assets: File[];
  rejected: RejectedFile[];
};

export function selectFiles(files: readonly File[]): FileSelection {
  const selection: FileSelection = { markdown: undefined, assets: [], rejected: [] };
  let total = 0;

  for (const file of files) {
    if (isSupportedFileName(file.name)) {
      // 2 つ目以降の原稿は黙って捨てず、選ばれなかったことを伝える
      if (selection.markdown) {
        selection.rejected.push({ name: file.name, reason: "unsupported" });
        continue;
      }
      selection.markdown = file;
      continue;
    }

    if (!isSupportedImageName(file.name)) {
      selection.rejected.push({ name: file.name, reason: "unsupported" });
      continue;
    }

    if (file.size > MAX_ASSET_BYTES) {
      selection.rejected.push({ name: file.name, reason: "too-large" });
      continue;
    }

    if (total + file.size > MAX_ASSETS_TOTAL_BYTES) {
      selection.rejected.push({ name: file.name, reason: "total-exceeded" });
      continue;
    }

    total += file.size;
    selection.assets.push(file);
  }

  return selection;
}

/** 受け付けなかったファイルを 1 文にまとめる */
export function describeRejected(rejected: readonly RejectedFile[]): string | undefined {
  if (rejected.length === 0) {
    return undefined;
  }

  const groups: Record<RejectedFile["reason"], string[]> = {
    unsupported: [],
    "too-large": [],
    "total-exceeded": [],
  };

  for (const file of rejected) {
    groups[file.reason].push(file.name);
  }

  const parts: string[] = [];

  if (groups.unsupported.length > 0) {
    parts.push(`対応していない形式: ${groups.unsupported.join(" / ")}`);
  }
  if (groups["too-large"].length > 0) {
    parts.push(
      `1 枚 ${formatMegabytes(MAX_ASSET_BYTES)} を超える: ${groups["too-large"].join(" / ")}`,
    );
  }
  if (groups["total-exceeded"].length > 0) {
    parts.push(
      `合計 ${formatMegabytes(MAX_ASSETS_TOTAL_BYTES)} を超えるため見送り: ${groups["total-exceeded"].join(" / ")}`,
    );
  }

  return `次のファイルは取り込みませんでした。${parts.join("、")}`;
}

function formatMegabytes(bytes: number): string {
  return `${String(Math.round(bytes / 1024 / 1024))}MB`;
}
