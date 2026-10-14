import { readFile } from "node:fs/promises";

export async function loadFile(filePath) {
  let markdown;
  try {
    markdown = await readFile(filePath, "utf8");
  } catch (err) {
    const e = new Error(`Cannot read ${filePath}: ${err.message}`);
    e.code = "LOAD";
    throw e;
  }
  return { markdown, source: { kind: "file", ref: filePath } };
}