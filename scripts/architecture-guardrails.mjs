#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, "src");
const ALLOW_BARREL_MARK = "guardrail:allow-barrel";

const violations = [];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function walkTsFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(fullPath));
      continue;
    }

    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    files.push(fullPath);
  }

  return files;
}

function lineFromIndex(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function addViolation(rule, file, line, message) {
  violations.push({ rule, file: toPosix(path.relative(ROOT_DIR, file)), line, message });
}

function checkNoAnyInContracts(file, content, normalizedPath) {
  const isContractFile =
    normalizedPath.includes("/src/types/") ||
    normalizedPath.includes("/interfaces/") ||
    /DTO\.ts$/u.test(path.basename(file));

  if (!isContractFile) return;

  const checks = [
    {
      rule: "no-any-in-contracts",
      regex: /:\s*any\b/gu,
      message: "Avoid `any` in contracts/interfaces/DTOs; use `unknown` or explicit literals.",
    },
    {
      rule: "no-any-in-contracts",
      regex: /\bas\s+any\b/gu,
      message: "Avoid `as any` in contracts/interfaces/DTOs; use a safe narrowing strategy.",
    },
    {
      rule: "no-any-in-contracts",
      regex: /<\s*any\s*>/gu,
      message: "Avoid generic `any` in contracts/interfaces/DTOs.",
    },
    {
      rule: "no-any-in-contracts",
      regex: /\bany\[\]/gu,
      message: "Avoid `any[]` in contracts/interfaces/DTOs.",
    },
    {
      rule: "no-any-in-contracts",
      regex: /\bArray<any>\b/gu,
      message: "Avoid `Array<any>` in contracts/interfaces/DTOs.",
    },
    {
      rule: "no-any-in-contracts",
      regex: /\bRecord<[^>]+,\s*any\s*>/gu,
      message: "Avoid `Record<..., any>` in contracts/interfaces/DTOs.",
    },
  ];

  for (const check of checks) {
    for (const match of content.matchAll(check.regex)) {
      addViolation(check.rule, file, lineFromIndex(content, match.index ?? 0), check.message);
    }
  }
}

function checkNoBarrelWithoutJustification(file, content, normalizedPath) {
  if (!normalizedPath.startsWith("src/")) return;
  if (!normalizedPath.endsWith("/index.ts")) return;

  if (!content.includes(ALLOW_BARREL_MARK)) {
    addViolation(
      "no-unjustified-barrel",
      file,
      1,
      `Barrel index.ts requires explicit justification marker (${ALLOW_BARREL_MARK}).`
    );
  }
}

function checkNoInfraImportsInUseCasesAndServices(file, content, normalizedPath) {
  if (!/^src\/modules\/[^/]+\/(useCases|services)\//u.test(normalizedPath)) return;

  const checks = [
    {
      rule: "no-infra-in-domain-layers",
      regex: /from\s+["']pg["']/gu,
      message: "UseCases/Services cannot import `pg` directly.",
    },
    {
      rule: "no-infra-in-domain-layers",
      regex: /from\s+["'][^"']*config\/database["']/gu,
      message: "UseCases/Services cannot import `config/database` directly.",
    },
    {
      rule: "no-infra-in-domain-layers",
      regex: /from\s+["'][^"']*types\/database["']/gu,
      message: "UseCases/Services cannot import database executor types.",
    },
    {
      rule: "no-infra-in-domain-layers",
      regex: /\bPoolClient\b/gu,
      message: "UseCases/Services cannot reference `PoolClient`.",
    },
    {
      rule: "no-infra-in-domain-layers",
      regex: /\bQueryExecutor\b/gu,
      message: "UseCases/Services cannot reference `QueryExecutor`.",
    },
    {
      rule: "no-infra-in-domain-layers",
      regex: /\bQueryResult(Row)?\b/gu,
      message: "UseCases/Services cannot reference SQL result types directly.",
    },
  ];

  for (const check of checks) {
    for (const match of content.matchAll(check.regex)) {
      addViolation(check.rule, file, lineFromIndex(content, match.index ?? 0), check.message);
    }
  }
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error("Guardrails failed: src directory not found.");
    process.exit(1);
  }

  const files = walkTsFiles(SRC_DIR).filter((file) => !toPosix(file).includes("/__tests__/"));

  for (const file of files) {
    const normalizedPath = toPosix(path.relative(ROOT_DIR, file));
    const content = fs.readFileSync(file, "utf8");

    checkNoAnyInContracts(file, content, normalizedPath);
    checkNoBarrelWithoutJustification(file, content, normalizedPath);
    checkNoInfraImportsInUseCasesAndServices(file, content, normalizedPath);
  }

  if (violations.length > 0) {
    console.error("\nArchitecture guardrails failed:\n");
    for (const violation of violations) {
      console.error(
        `- [${violation.rule}] ${violation.file}:${violation.line} ${violation.message}`
      );
    }
    process.exit(1);
  }

  console.log(`Architecture guardrails passed (${files.length} files checked).`);
}

main();
