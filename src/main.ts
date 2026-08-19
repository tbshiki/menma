import "./styles/reset.css";
import "./styles/home.css";
import "./styles/deck.css";
import "./styles/layouts.css";
import "./styles/themes/default.css";

import { startApp } from "./app";

const mount = document.querySelector<HTMLElement>("#app");

if (!mount) {
  throw new Error("[menma] マウント先 #app が見つかりません。");
}

void startApp(mount, window);
