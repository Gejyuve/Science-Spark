// Монгол зөв бичгийн толь (Hunspell mn_MN, zuv.bichig.dev) хөтөч дотор ажиллана; текст сервер рүү явахгүй.
import { loadModule } from "hunspell-asm";

async function load(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url);
  let buf = new Uint8Array(await r.arrayBuffer());
  // .gz файлыг өөрсдөө задална (сервер аль хэдийн задалсан бол шууд ашиглана)
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
    buf = new Uint8Array(await new Response(s).arrayBuffer());
  }
  return buf;
}

async function init() {
  const [f, aff, dic] = await Promise.all([loadModule(), load("/spell/mn_MN.aff.gz"), load("/spell/mn_MN.dic.gz")]);
  return f.create(f.mountBuffer(aff, "mn.aff"), f.mountBuffer(dic, "mn.dic"));
}

let ready = null;
self.onmessage = async (e) => {
  const { id, type, words, word } = e.data;
  try {
    const h = await (ready ||= init());
    if (type === "check") self.postMessage({ id, bad: words.filter((w) => !h.spell(w)) });
    else if (type === "suggest") self.postMessage({ id, list: h.suggest(word).slice(0, 6) });
    else self.postMessage({ id });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
