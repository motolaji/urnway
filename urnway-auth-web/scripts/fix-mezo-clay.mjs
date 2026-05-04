import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const targetPath = path.join(
  process.cwd(),
  "node_modules",
  "@mezo-org",
  "passport",
  "node_modules",
  "@mezo-org",
  "mezo-clay",
  "dist",
  "mezo-clay.es.js"
);

const brokenHeader = [
  'import * as te from "react";',
  'import T, { Children as Mn, forwardRef as Te, createContext as Yr, useMemo as Zr, useContext as Jr, cloneElement as H8, useState as gg, useCallback as Rn, Fragment as z8, PureComponent as G8, useRef as fg, useEffect as qy, isValidElement as V8 } from "react";',
  'import ub from "react-dom";',
].join("\n");

const fixedHeader = [
  'import * as T from "react";',
  'import * as ub from "react-dom";',
  "const te = T;",
  "const { Children: Mn, forwardRef: Te, createContext: Yr, useMemo: Zr, useContext: Jr, cloneElement: H8, useState: gg, useCallback: Rn, Fragment: z8, PureComponent: G8, useRef: fg, useEffect: qy, isValidElement: V8 } = T;",
].join("\n");

async function main() {
  const file = await readFile(targetPath, "utf8").catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      console.warn(`[fix-mezo-clay] Skipped: ${targetPath} does not exist yet.`);
      return null;
    }

    throw error;
  });

  if (!file) {
    return;
  }

  if (file.includes(fixedHeader)) {
    console.log("[fix-mezo-clay] mezo-clay is already patched.");
    return;
  }

  if (!file.includes(brokenHeader)) {
    throw new Error(
      "[fix-mezo-clay] Expected mezo-clay header was not found. The published package layout may have changed."
    );
  }

  await writeFile(targetPath, file.replace(brokenHeader, fixedHeader), "utf8");
  console.log("[fix-mezo-clay] Patched mezo-clay React imports.");
}

await main();
