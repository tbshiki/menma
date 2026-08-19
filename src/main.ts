import "./styles/reset.css";
import source from "../slides.md?raw";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("[menma] マウント先 #app が見つかりません。");
}

// M0 では読み込みの疎通確認だけを行う。原稿を解析せず、そのまま表示する。
// 解析は M1（deck/）、スライドとしての描画は M2（view/）で実装する。
const preview = document.createElement("pre");
preview.textContent = source;
app.append(preview);
