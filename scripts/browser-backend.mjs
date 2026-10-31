/* Local-only browser test harness: runs the compiled app with an in-memory
 * mail transport. Never imported by application code or deployed builds. */
import path from "node:path";
import { fileURLToPath } from "node:url";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
import http from "node:http";
import { createRequire } from "node:module";
const backend = path.resolve(scriptDirectory, "../../rtn-backend");
const load = createRequire(path.join(backend, "package.json"));
const database = process.env.DATABASE_URL;
if (
  process.env.NODE_ENV !== "production" ||
  process.env.BROWSER_RELEASE_CHECK !== "1" ||
  !database ||
  !["localhost", "127.0.0.1"].includes(new URL(database).hostname) ||
  !process.env.BROWSER_OUTBOX_TOKEN
)
  throw new Error(
    "Browser harness requires production-cookie release-check mode, a local database and an outbox token.",
  );
load("reflect-metadata");
const { Test } = load("@nestjs/testing");
const { AppModule } = load("./dist/app.module.js");
const { MailService } = load("./dist/mail/mail.service.js");
const { configureApplication } = load("./dist/bootstrap.js");
const messages = [];
(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue({
      send: async (message) => {
        messages.push(message);
      },
    })
    .compile();
  const app = moduleRef.createNestApplication();
  configureApplication(app);
  await app.listen(Number(process.env.PORT), "127.0.0.1");
  const outbox = http.createServer((request, response) => {
    if (
      request.method !== "GET" ||
      request.url !== "/outbox" ||
      request.headers.authorization !==
        `Bearer ${process.env.BROWSER_OUTBOX_TOKEN}`
    ) {
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      })
      .end(JSON.stringify(messages));
  });
  outbox.listen(3102, "127.0.0.1");
  const stop = () => {
    outbox.close();
    void app.close().then(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
