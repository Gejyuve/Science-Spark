// Хоёр хувилбарын догол мөрийн ялгаа (LCS). Өөрчлөгдсөн хэсгийг л буцаана, хооронд нь «…».
export function paraDiff(before = "", after = "") {
  const a = String(before || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const b = String(after || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0, gap = false;
  const push = (op, text) => {
    if (gap && out.length) out.push({ op: "gap" });
    gap = false;
    out.push({ op, text });
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { gap = true; i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) push("add", b[j++]);
    else push("del", a[i++]);
  }
  return out;
}
