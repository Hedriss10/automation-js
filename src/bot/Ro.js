import WebDriverManagerRo from "../core/WebDriverManagerRo.js";
import DataBaseManagerPostgreSQL from "../data/Database.js";
import * as fs from "fs";
import csv from "csv-parser";
import { stringify } from "csv-stringify/sync";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), "../..");
dotenv.config({ path: path.resolve(__dirname, ".env") });

const URL_GOV = process.env.URL_RO;
const URL_CONSULT = process.env.URL_CONSULT;
const USERNAME_R0 = process.env.USERNAME_R0;
const PASSWORD_RO = process.env.PASSWORD_RO;

async function saveCpfsToSchema(results = Array) {
  ///
}

async function executeRo() {
  let manager;
  let db;
  const results = [];

  try {
    console.log("Iniciando automação...");

    if (!URL_GOV || !URL_CONSULT || !USERNAME_R0 || !PASSWORD_RO) {
      throw new Error(
        "Variáveis de ambiente faltando. Verifique o arquivo src/.env",
      );
    }

    db = new DataBaseManagerPostgreSQL();
    await db.connect();

    const cpfsFromDb = await db.selectRoData(5);
    const cpfs = cpfsFromDb.map((row) => ({
      rawCPF: row.cpf_formatado.replace(/[^\d]/g, ""),
      matricula: "",
    }));

    if (cpfs.length === 0) {
      console.log("Nenhum CPF encontrado no banco para processar");
      return;
    }

    // 2. Inicializar o navegador
    manager = new WebDriverManagerRo("chrome", USERNAME_R0, PASSWORD_RO);

    // 3. Login e navegação inicial
    await manager.navigateTo(URL_GOV);
    await manager.loginGov();
    await manager.navigateTo(URL_CONSULT);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 4. Processar cada CPF
    for (const [index, cpfData] of cpfs.entries()) {
      const resultEntry = {
        cpf: cpfData.rawCPF,
        matricula: cpfData.matricula,
      };

      try {
        console.log(
          `\nProcessando ${index + 1}/${cpfs.length}: CPF ${cpfData.rawCPF}`,
        );

        await manager.fillFormFields({
          cpf: cpfData.rawCPF,
          matricula: cpfData.matricula,
        });

        const tableData = await manager.handleModalWithMargins();
        resultEntry.data = tableData;

        if (!tableData.rows || tableData.rows.length === 0) {
          console.log(`Nenhum dado encontrado para o CPF ${cpfData.rawCPF}`);
          resultEntry.data = null;
        } else {
          resultEntry.data = tableData;
        }

        await manager.checkExistsUrlAheadSearch();
        if ((index + 1) % 10 === 0 || index === cpfs.length - 1) {
          await saveResultsToCSV(
            results,
            `resultados/parciais_${index + 1}.csv`,
          );
        }
      } catch (error) {
        console.error(
          `Erro ao processar CPF ${cpfData.rawCPF}:`,
          error.message,
        );
        resultEntry.error = error.message;
      }

      results.push(resultEntry);

      if (index < cpfs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // 5. Salvar resultados finais
    await saveResultsToCSV(results);
  } catch (error) {
    console.error("Falha na execução:", error);
  } finally {
    if (manager) {
      await manager.quit();
    }
    if (db) {
      await db.disconnect();
    }
    console.log("Processo finalizado.");
  }
}

// Função saveResultsToCSV (mantida como no seu código original)
async function saveResultsToCSV(
  results,
  filename = "resultados/resultados_finais.csv",
) {
  try {
    if (!fs.existsSync("resultados")) {
      fs.mkdirSync("resultados");
    }
    const csvData = [];
    const headers = [
      "CPF Consultado",
      "Matrícula",
      "Nome",
      "CPF Encontrado",
      "Sequencial",
      "Margem Disponível",
      "Margem Cartão",
      "Status",
    ];
    csvData.push(headers);

    for (const result of results) {
      if (result.error) {
        csvData.push([
          result.cpf,
          result.matricula || "",
          "",
          "",
          "",
          "",
          "",
          `ERRO: ${result.error}`,
        ]);
        continue;
      }
      if (!result.data || result.data.rows.length === 0) {
        csvData.push([
          result.cpf,
          result.matricula || "",
          "",
          "",
          "",
          "",
          "",
          "Nenhum resultado encontrado",
        ]);
        continue;
      }
      for (const row of result.data.rows) {
        csvData.push([
          result.cpf,
          result.matricula || "",
          row.Nome || "",
          row.CPF || "",
          row.Seq || row.Sequencial || "",
          row["Margem disponível"] || "",
          row["Margem Cartão"] || "",
          "SUCESSO",
        ]);
      }
    }

    const csvContent = stringify(csvData, {
      delimiter: ";",
      quoted: true,
      bom: true,
      cast: {
        number: (value) => value.replace(".", ","), // Formata números para padrão brasileiro
      },
    });

    fs.writeFileSync(filename, csvContent);
    console.log(`Resultados salvos em ${filename}`);
  } catch (error) {
    console.error("Erro ao salvar resultados:", error);
    throw error;
  }
}

export default executeRo;
