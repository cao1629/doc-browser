import { execFileSync } from "node:child_process";

function libTargetName(pkg) {
  return pkg.targets.find((target) => target.kind.some((kind) => ["lib", "rlib", "proc-macro"].includes(kind)))?.name;
}

export function listedCrates(manifestPath) {
  const output = execFileSync(
    "cargo",
    ["metadata", "--frozen", "--format-version", "1", "--manifest-path", manifestPath],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
  );
  const metadata = JSON.parse(output);
  const libNames = new Map(metadata.packages.map((pkg) => [pkg.name, libTargetName(pkg)]));
  const manifest = metadata.packages.find((pkg) => pkg.id === metadata.resolve.root);
  return manifest.dependencies
    .filter((dependency) => dependency.kind === null)
    .map((dependency) => libNames.get(dependency.name))
    .filter((name) => name !== undefined);
}
