/* Test-only loopback TLS terminator for production Secure-cookie verification. */
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
if (
  process.env.BROWSER_RELEASE_CHECK !== "1" ||
  !process.env.BROWSER_TLS_CERT ||
  !process.env.BROWSER_TLS_KEY
)
  throw new Error("Local browser release configuration is required.");
const server = https.createServer(
  {
    cert: fs.readFileSync(process.env.BROWSER_TLS_CERT),
    key: fs.readFileSync(process.env.BROWSER_TLS_KEY),
  },
  (request, response) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 3100,
        path: request.url,
        method: request.method,
        headers: { ...request.headers, "x-forwarded-proto": "https" },
      },
      (incoming) => {
        response.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.pipe(response);
      },
    );
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.pipe(upstream);
  },
);
server.listen(3443, "127.0.0.1");
process.on("SIGTERM", () => server.close(() => process.exit(0)));
