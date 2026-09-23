import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const projectDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsetsDir = join(projectDir, "docsets");

async function readFeed(name) {
  const response = await fetch(`https://kapeli.com/feeds/${encodeURIComponent(name)}.xml`);
  if (!response.ok) throw new Error(`${name}: no Dash feed found (${response.status} ${response.statusText})`);
  const xml = await response.text();
  return {
    version: /<version>([^<]*)<\/version>/.exec(xml)?.[1] ?? "",
    urls: [...xml.matchAll(/<url>([^<]+)<\/url>/g)].map((match) => match[1]),
  };
}

async function fastestFirst(urls) {
  const timed = await Promise.all(
    urls.map(async (url) => {
      const started = performance.now();
      try {
        const response = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10000) });
        return { url, ms: response.status === 200 ? performance.now() - started : Infinity };
      } catch {
        return { url, ms: Infinity };
      }
    }),
  );
  return timed.sort((a, b) => a.ms - b.ms).map((mirror) => mirror.url);
}

async function download(name, urls, file) {
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`${name}: ${url} answered ${response.status}, trying the next mirror`);
        continue;
      }
      const size = Number(response.headers.get("content-length"));
      console.log(`${name}: downloading ${size ? `${Math.round(size / 1e6)} MB ` : ""}from ${url}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
      return url;
    } catch (error) {
      console.log(`${name}: ${url} failed (${error.cause?.message ?? error.message}), trying the next mirror`);
    }
  }
  throw new Error(`${name}: every mirror failed`);
}

async function installDocset(name) {
  const target = join(docsetsDir, `${name}.docset`);
  const versionFile = join(docsetsDir, `${name}.version`);
  const { version, urls } = await readFeed(name);
  if (existsSync(target) && existsSync(versionFile) && readFileSync(versionFile, "utf8") === version) {
    console.log(`${name}: up to date`);
    return;
  }
  const workDir = join(docsetsDir, `.${name}.download`);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const archive = join(workDir, "docset.tgz");
  await download(name, await fastestFirst(urls), archive);
  execFileSync("tar", ["-xzf", archive, "-C", workDir]);
  const extracted = readdirSync(workDir).find((entry) => entry.endsWith(".docset"));
  if (!extracted) throw new Error(`${name}: the archive has no .docset directory`);
  rmSync(target, { recursive: true, force: true });
  renameSync(join(workDir, extracted), target);
  writeFileSync(versionFile, version);
  rmSync(workDir, { recursive: true, force: true });
  console.log(`${name}: installed`);
}

mkdirSync(docsetsDir, { recursive: true });
for (const name of JSON.parse(readFileSync(join(projectDir, "docsets.json"), "utf8"))) {
  await installDocset(name);
}
