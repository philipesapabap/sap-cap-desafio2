/**
 * Executa as jornadas OPA5 dos aplicativos Fiori elements em Chrome headless.
 *
 * Comandos:
 *
 *     npm run test:fiori
 *     npm run test:fiori:ordens
 *     npm run test:fiori:lotes
 *
 * O runner inicia um servidor CAP com SQLite em memória para cada aplicativo.
 * Assim, as mutações feitas por uma suíte não contaminam a outra. O Chrome usa
 * o usuário `admin` da autenticação mocked e abre a página QUnit servida pelo
 * próprio cds-plugin-ui5.
 */

const { existsSync } = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const CDS_EXECUTABLE = path.join(
  PROJECT_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "cds.cmd" : "cds",
);
const PORT = 4004;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTHORIZATION = `Basic ${Buffer.from("admin:admin").toString("base64")}`;
const APPLICATIONS = Object.freeze({
  ordens: {
    label: "Ordens",
    readyUrl: `${BASE_URL}/treinamento.cap.ordens/test/flp.html`,
    testUrl: `${BASE_URL}/treinamento.cap.ordens/test/Test.qunit.html?testsuite=test-resources/treinamento/cap/ordens/testsuite.qunit&test=integration`,
  },
  lotes: {
    label: "Lotes",
    readyUrl: `${BASE_URL}/treinamento.cap.lotes/test/flp.html`,
    testUrl: `${BASE_URL}/treinamento.cap.lotes/test/Test.qunit.html?testsuite=test-resources/treinamento/cap/lotes/testsuite.qunit&test=integration`,
  },
});

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

/**
 * Seleciona as suítes solicitadas, executa cada uma isoladamente e consolida
 * o código de saída do processo.
 *
 * @returns {Promise<void>} Conclui depois que todas as suítes terminarem.
 */
async function main() {
  const requestedApplication = process.argv[2];
  const selectedApplications = requestedApplication
    ? [[requestedApplication, APPLICATIONS[requestedApplication]]]
    : Object.entries(APPLICATIONS);

  if (selectedApplications.some(([, configuration]) => !configuration)) {
    throw new Error(
      `Aplicativo desconhecido: ${requestedApplication}. Use "ordens" ou "lotes".`,
    );
  }

  const executablePath = findChromeExecutable();
  const results = [];

  for (const [applicationName, configuration] of selectedApplications) {
    results.push(
      await runApplicationSuite(applicationName, configuration, executablePath),
    );
  }

  const failedTests = results.reduce(
    (total, result) => total + result.failed,
    0,
  );
  const totalTests = results.reduce((total, result) => total + result.total, 0);
  const passedTests = totalTests - failedTests;

  console.log(`\nFiori elements: ${passedTests}/${totalTests} asserções QUnit passaram.`);

  if (failedTests > 0) {
    process.exitCode = 1;
  }
}

/**
 * Executa uma suíte em banco novo: inicia o CAP, abre o QUnit, coleta as
 * falhas e encerra servidor e navegador mesmo quando ocorre erro.
 *
 * @param {string} applicationName Nome técnico usado apenas nos logs.
 * @param {{label: string, readyUrl: string, testUrl: string}} configuration URLs da suíte.
 * @param {string} executablePath Caminho do Chrome instalado na máquina.
 * @returns {Promise<{applicationName: string, failed: number, total: number}>} Resultado resumido.
 */
async function runApplicationSuite(
  applicationName,
  configuration,
  executablePath,
) {
  const server = startCapServer();
  let browser;

  try {
    await waitForServer(configuration.readyUrl, server);
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.authenticate({ username: "admin", password: "admin" });
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.error(`[${applicationName}:browser] ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      console.error(`[${applicationName}:page] ${error.message}`);
    });

    await page.goto(configuration.testUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForFunction(
      () => window.__opaResult?.finished === true,
      { timeout: 240_000 },
    );

    const result = await page.evaluate(() => ({
      ...window.__opaResult,
      failures: window.__opaFailures || [],
    }));

    console.log(
      `${configuration.label}: ${result.passed}/${result.total} asserções QUnit passaram.`,
    );
    result.failures.forEach((failure) => {
      console.error(
        `  - ${failure.module}: ${failure.name}\n    ${failure.message}`,
      );
    });

    return {
      applicationName,
      failed: result.failed,
      total: result.total,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopCapServer(server);
  }
}

/**
 * Inicia o CAP por processo filho. A saída fica retida e só é exibida quando
 * o servidor encerra antes de ficar disponível, reduzindo ruído no terminal.
 *
 * @returns {import("node:child_process").ChildProcess} Processo CAP iniciado.
 */
function startCapServer() {
  const server = spawn(CDS_EXECUTABLE, ["serve", "--in-memory"], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(PORT), NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.output = "";
  server.stdout.on("data", (chunk) => {
    server.output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    server.output += chunk.toString();
  });
  return server;
}

/**
 * Aguarda o endpoint do preview Fiori responder. A autenticação é enviada
 * porque o mesmo servidor também protege o serviço OData usado pelo iframe.
 *
 * @param {string} url Endpoint que indica que CAP e UI5 estão prontos.
 * @param {import("node:child_process").ChildProcess} server Processo observado.
 * @returns {Promise<void>} Resolve quando o endpoint responde.
 */
async function waitForServer(url, server) {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`O servidor CAP encerrou antes de iniciar.\n${server.output}`);
    }

    try {
      const response = await fetch(url, {
        headers: { Authorization: AUTHORIZATION },
        redirect: "manual",
      });
      if (response.status >= 200 && response.status < 400) {
        return;
      }
    } catch {
      // O servidor ainda está subindo; a próxima iteração tenta novamente.
    }

    await delay(250);
  }

  throw new Error(`Tempo excedido ao iniciar o servidor CAP.\n${server.output}`);
}

/**
 * Encerra o processo CAP de forma graciosa e aplica SIGKILL somente se ele
 * não responder ao primeiro sinal.
 *
 * @param {import("node:child_process").ChildProcess} server Processo CAP.
 * @returns {Promise<void>} Resolve depois do encerramento.
 */
async function stopCapServer(server) {
  if (server.exitCode !== null || server.killed) {
    return;
  }

  server.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => server.once("exit", () => resolve(true))),
    delay(5_000).then(() => false),
  ]);

  if (!exited && server.exitCode === null) {
    server.kill("SIGKILL");
  }
}

/**
 * Localiza o Chrome sem baixar outro navegador. `CHROME_BIN` permite
 * sobrescrever os caminhos padrão em estações e pipelines diferentes.
 *
 * @returns {string} Primeiro executável encontrado.
 */
function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const executablePath = candidates.find((candidate) => existsSync(candidate));

  if (!executablePath) {
    throw new Error(
      "Chrome não encontrado. Informe o executável pela variável CHROME_BIN.",
    );
  }

  return executablePath;
}

/**
 * Pausa assíncrona curta usada no polling e no encerramento gracioso.
 *
 * @param {number} milliseconds Duração em milissegundos.
 * @returns {Promise<void>} Promessa resolvida após o intervalo.
 */
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
