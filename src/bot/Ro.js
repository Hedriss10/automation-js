import WebDriverManagerRo from "../core/WebDriverManagerRo.js";
import DataBaseManagerPostgreSQL from "../data/Database.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const URL_GOV = process.env.URL_RO;
const URL_CONSULT = process.env.URL_CONSULT;
const USERNAME_RO = process.env.USERNAME_RO;
const PASSWORD_RO = process.env.PASSWORD_RO;

const config = {
  batchSize: 100,
  retryAttempts: 3,
  retryDelayMs: 2000,
};

async function executeRo() {
  let manager = null;
  let db = null;

  const initializeManager = async () => {
    if (manager) {
      await manager.quit();
    }
    manager = new WebDriverManagerRo("chrome", USERNAME_RO, PASSWORD_RO);
    await manager.navigateTo(URL_GOV);
    await manager.loginGov();
    await manager.navigateTo(URL_CONSULT);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  try {
    console.log("Iniciando automação...");

    const missingVars = [];
    if (!URL_GOV) missingVars.push("URL_RO");
    if (!URL_CONSULT) missingVars.push("URL_CONSULT");
    if (!USERNAME_RO) missingVars.push("USERNAME_RO");
    if (!PASSWORD_RO) missingVars.push("PASSWORD_RO");

    if (missingVars.length > 0) {
      throw new Error(
        `Variáveis de ambiente faltando: ${missingVars.join(", ")}. Verifique o arquivo src/.env`,
      );
    }

    db = new DataBaseManagerPostgreSQL();
    await db.connect();

    const pendingCountQuery = `
      SELECT COUNT(*) AS count
      FROM spreed.ro 
      WHERE has_filter = FALSE OR has_filter IS NULL;
    `;
    const pendingCountResult = await db.client.query(pendingCountQuery);
    const pendingCount = parseInt(pendingCountResult.rows[0].count, 10);
    console.log(`Total de CPFs pendentes: ${pendingCount}`);

    await initializeManager();

    let batchNumber = 0;
    while (true) {
      batchNumber++;
      console.log(`Iniciando lote ${batchNumber}...`);
      const cpfsFromDb = await db.selectRoData(config.batchSize);
      if (cpfsFromDb.length === 0) {
        console.log("Nenhum CPF pendente encontrado no banco.");
        break;
      }

      console.log(`Processando lote de ${cpfsFromDb.length} CPFs...`);

      for (const [index, cpfData] of cpfsFromDb.entries()) {
        const rawCPF = cpfData.cpf_formatado.replace(/[^\d]/g, "");
        console.log(
          `Processando ${index + 1}/${cpfsFromDb.length} (lote ${batchNumber}): CPF ${cpfData.cpf_formatado}`,
        );

        let attempt = 0;
        let success = false;

        while (attempt < config.retryAttempts && !success) {
          try {
            const currentUrl = await manager.driver.getCurrentUrl();
            if (!currentUrl.includes(URL_CONSULT)) {
              console.log(
                `URL atual (${currentUrl}) não é a de consulta. Navegando para ${URL_CONSULT}...`,
              );
              await manager.navigateTo(URL_CONSULT);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            await manager.fillFormFields({ cpf: rawCPF, matricula: "" });
            const tableData = await manager.handleModalWithMargins();

            if (!tableData.rows || tableData.rows.length === 0) {
              console.log(
                `Nenhum dado encontrado para o CPF ${cpfData.cpf_formatado}`,
              );
              await db.insertResultSearchRo(null, rawCPF, null, null);
            } else {
              for (const row of tableData.rows) {
                await db.insertResultSearchRo(
                  row.Nome || null,
                  rawCPF,
                  row["Margem disponível"] || null,
                  row["Margem Cartão"] || null,
                );
              }
            }

            await db.insertHasFilter(cpfData.cpf_raw);
            success = true;
          } catch (error) {
            attempt++;
            console.error(
              `Erro ao processar CPF ${cpfData.cpf_formatado} (tentativa ${attempt}/${config.retryAttempts}):`,
              error.message,
            );
            if (attempt < config.retryAttempts) {
              if (error.message.includes("no such window")) {
                console.log(
                  "Navegador fechado inesperadamente. Reiniciando...",
                );
                await initializeManager();
              } else {
                await new Promise((resolve) =>
                  setTimeout(resolve, config.retryDelayMs),
                );
                await manager.navigateTo(URL_CONSULT);
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            } else {
              console.log(
                `Falha após ${config.retryAttempts} tentativas para CPF ${cpfData.cpf_formatado}. Salvando como erro.`,
              );
              await db.insertResultSearchRo(null, rawCPF, null, null);
              await db.insertHasFilter(cpfData.cpf_raw);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Falha na execução da automação:", error.message);
    throw error;
  } finally {
    if (manager) {
      await manager.quit();
    }
    if (db) {
      await db.disconnect();
    }
    console.log("Automação finalizada.");
  }
}

export default executeRo;
