import { config } from "./config.js";

try {
  const { FoundryLocalManager } = await import("foundry-local-sdk");
  const manager = FoundryLocalManager.create({
    appName: config.appName,
    appDataDir: config.foundryAppDataDir,
    logLevel: "error",
  });
  const embedding = await manager.catalog.getModel(config.embeddingModel);
  const chat = await manager.catalog.getModel(config.chatModel);
  console.log(`✓ Foundry Local SDK ve Windows yerel çekirdeği hazır. (${embedding.alias}, ${chat.alias})`);
} catch (error) {
  console.error("✗ Foundry Local SDK veya Windows yerel çekirdeği başlatılamadı.");
  console.error(error?.stack || error);
  console.error("\nKontrol edin:");
  console.error("- Proje OneDrive/SharePoint altında mı?");
  console.error("- Visual C++ Redistributable kurulu mu?");
  console.error("- npm install yeniden çalıştırıldı mı?");
  console.error("- Gerekirse: npm run repair:foundry");
  process.exitCode = 1;
}
