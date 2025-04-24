import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { deflate } from "zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { Client } = pg;

class DataBaseManagerPostgreSQL {
  constructor() {
    this.username = process.env.DB_DEV_USERNAME;
    this.host = process.env.DB_HOST;
    this.password = process.env.DB_DEV_PASSWORD;
    this.database = process.env.DB_DEV_DATABASE;
    this.port = process.env.DB_PORT;
    this.client = null; //
  }

  async connect() {
    if (
      !this.username ||
      !this.host ||
      !this.database ||
      !this.password ||
      !this.port
    ) {
      throw new Error(
        "Variáveis de ambiente do banco de dados estão faltando. Verifique o arquivo src/.env",
      );
    }

    this.client = new Client({
      user: this.username,
      host: this.host,
      database: this.database,
      password: this.password,
      port: this.port,
    });
    try {
      await this.client.connect();
      console.log("Conexão com o banco de dados estabelecida com sucesso!");
    } catch (error) {
      console.error("Erro ao conectar ao banco de dados:", error.message);
      throw error;
    }
  }

  async selectRoData(count = 1) {
    const limit = Math.max(1, Math.floor(Number(count)));
    const query = `
      SELECT 
        regexp_replace(cpf, '(\\d{3})(\\d{3})(\\d{3})(\\d{2})', '\\1.\\2.\\3-\\4') AS cpf_formatado
      FROM 
        spreed.ro 
      LIMIT $1;
    `;

    try {
      const result = await this.client.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error("Erro ao executar SELECT:", error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.end();
        console.log("Conexão com o banco de dados encerrada.");
      } catch (error) {
        console.error("Erro ao desconectar:", error.message);
        throw error;
      }
    }
  }
}

function main() {
  const databaseManager = new DataBaseManagerPostgreSQL();
  databaseManager
    .connect()
    .then(() => {
      return databaseManager.selectRoData(3); // testando limti 3
    })
    .then((result) => {
      console.log("Dados obtidos do banco de dados:", result);
      return databaseManager.disconnect();
    })
    .then(() => {
      console.log("Conexão com o banco de dados encerrada.");
    })
    .catch((error) => {
      console.error("Erro:", error);
    })
    .finally(() => {
      console.log("Conexão com o banco de dados encerrada.");
    });
}

main();


