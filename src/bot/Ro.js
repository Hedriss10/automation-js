import "dotenv/config";
import WebDriverManagerRo from "../core/WebDriverManagerRo.js";
import * as fs from "fs";
import csv from "csv-parser";

async function extractCPFsFromCSV(inputFile = "data/examplecpf.csv") {
  return new Promise((resolve, reject) => {
    const cpfs = [];
    fs.createReadStream(inputFile)
      .pipe(csv())
      .on("data", (row) => {
        if (row.CPF) {
          cpfs.push({
            rawCPF: row.CPF.trim(),
            matricula: row.Matricula ? row.Matricula.trim() : "",
          });
        }
      })
      .on("end", () => {
        console.log(`Extraídos ${cpfs.length} CPFs do arquivo`);
        resolve(cpfs);
      })
      .on("error", reject);
  });
}

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

const URL_GOV = meta.env.VITE_URL_GOV;
const URL_CONSULT = meta.env.VITE_URL_CONSULT;
const USERNME_RO = meta.env.VITE_USERNME_RO;
const PASSWORD_RO = meta.env.VITE_PASSWORD_RO;

// interface
async function ExecuteRo() {
  let manager;
  const results = [];

  try {
    const config = {
      urlGov: process.env.URL_RO,
      urlConsult: process.env.URL_CONSULT,
      username: process.env.USERNME_RO,
      password: process.env.PASSWORD_RO,
    };

    console.log("Variaveis de ambiente", config);
    console.log("Iniciando automação...");

    // 1. Ler CPFs do arquivo CSV
    const cpfs = await extractCPFsFromCSV();

    if (cpfs.length === 0) {
      console.log("Nenhum CPF encontrado para processar");
      return;
    }

    // 2. Inicializar o navegador
    manager = new WebDriverManagerRo(
      "chrome",
      config.username,
      config.password,
    );

    // 3. Login e navegação inicial
    await manager.navigateTo(config.urlGov);
    await manager.loginGov();
    await manager.navigateTo(config.urlConsult);
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

        await manager.checkExistsUrlAheadSearch(); // checagem da url
        // Salvar resultado parcial a cada 10 CPFs
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

      // Espera entre consultas
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
    console.log("Processo finalizado.");
  }
}

export default ExecuteRo;
