import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";
import { readDocuments } from "../src/ingest.js";

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("Paket ve kaynak bütünlüğü", async (t) => {
  await t.test("sürüm ve model mimarisi teslim paketine uygundur", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(config.rootDir, "package.json"), "utf8"));
    assert.equal(pkg.version, "4.0.6");
    assert.equal(pkg.dependencies["foundry-local-sdk"], "1.2.0");
    assert.equal(pkg.scripts["install:foundry"], "npm install && npm run diagnose:foundry");
    assert.equal(pkg.scripts["diagnose:foundry"], "node src/checkFoundryInstall.js");
    assert.equal(pkg.scripts["check:foundry"], "npm run diagnose:foundry");
    assert.equal(config.chatModel, "qwen2.5-0.5b");
    assert.equal(config.embeddingModel, "qwen3-embedding-0.6b");
    assert.equal(config.sequentialModels, true);
    assert.equal(path.isAbsolute(config.foundryAppDataDir), true);
  });

  await t.test("17 yapılandırılmış belge ve 30 pasaj bulunur", () => {
    const docs = readDocuments(config.docsDir);
    assert.equal(docs.length, 17);
    assert.equal(docs.flatMap((item) => item.passages).length, 30);
  });

  await t.test("beş orijinal kaynak SHA-256 manifestiyle eşleşir", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(config.rootDir, "sources", "manifest.json"), "utf8")
    );
    assert.equal(manifest.files.length, 5);
    for (const item of manifest.files) {
      const file = path.join(config.rootDir, "sources", "original", item.filename);
      assert.equal(fs.existsSync(file), true, `Eksik kaynak: ${item.filename}`);
      assert.equal(sha256(file), item.sha256, `Kaynak değişmiş: ${item.filename}`);
    }
  });

  await t.test("Foundry Local planı teslim paketinde bulunur", () => {
    assert.equal(
      fs.existsSync(path.join(config.rootDir, "project-docs", "Summer School Foundry Local Plan.pdf")),
      true
    );
  });
  await t.test("kurulum dosyası genel npm kayıt defterini ve SDK betiğini kullanır", () => {
    const setup = fs.readFileSync(path.join(config.rootDir, "KURULUM.cmd"), "utf8");
    const npmrc = fs.readFileSync(path.join(config.rootDir, ".npmrc"), "utf8");
    assert.match(setup, /registry=https:\/\/registry\.npmjs\.org/);
    assert.match(setup, /npm(?:\.cmd)? run install:foundry/);
    assert.match(npmrc, /registry=https:\/\/registry\.npmjs\.org\//);
  });

});
