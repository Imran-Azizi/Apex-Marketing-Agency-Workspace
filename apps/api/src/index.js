import { createApp } from "./app.js";
import { env } from "./config/env.js";

process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("[fatal] unhandledRejection:", err);
  process.exit(1);
});

const app = createApp();

app.listen(env.port, "0.0.0.0", () => {
  console.log(`APEX API listening on 0.0.0.0:${env.port} [${env.nodeEnv}]`);
  console.log(
    `[boot] storage=${env.storageDriver} cors=${env.corsOrigins.join(",")} api=${env.apiUrl}`,
  );
});
