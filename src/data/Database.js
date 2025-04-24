import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { Client } = pg;

/**
 * Gerencia a conexão e operações com o banco de dados PostgreSQL.
 * @class
 */
class DataBaseManagerPostgreSQL {
  constructor() {
    this.username = process.env.DB_DEV_USERNAME;
    this.host = process.env.DB_HOST;
    this.password = process.env.DB_DEV_PASSWORD;
    this.database = process.env.DB_DEV_DATABASE;
    this.port = process.env.DB_PORT;
    this.client = null;
  }

  /**
   * Estabelece conexão com o banco de dados.
   * @throws {Error} Se variáveis de ambiente estiverem faltando ou a conexão falhar.
   */
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

  /**
   * Busca CPFs da tabela spreed.ro que ainda não foram processados.
   * @param {number} [batchSize=100] - Número de CPFs a retornar por vez.
   * @returns {Promise<Array<{cpf_formatado: string}>>} - Lista de CPFs formatados.
   */
  async selectRoData(batchSize = 100) {
    const limit = Math.max(1, Math.floor(Number(batchSize)));
    const query = `
      SELECT 
        regexp_replace(cpf, '(\\d{3})(\\d{3})(\\d{3})(\\d{2})', '\\1.\\2.\\3-\\4') AS cpf_formatado,
        cpf AS cpf_raw
      FROM 
        spreed.ro 
      WHERE 
        has_filter = FALSE
      LIMIT $1;
    `;

    try {
      const result = await this.client.query(query, [limit]);
      console.log(
        `Selecionados ${result.rows.length} CPFs para processamento.`,
      );
      return result.rows;
    } catch (error) {
      console.error("Erro ao executar SELECT:", error.message);
      throw error;
    }
  }

  /**
   * Insere um resultado de busca na tabela spreed.result_search_ro.
   * @param {string} name - Nome retornado pela busca.
   * @param {string} cpf_search - CPF consultado.
   * @param {string} margem - Margem disponível.
   * @param {string} margem_cartao - Margem do cartão.
   * @returns {Promise<Object>} - Resultado da query.
   */
  async insertResultSearchRo(name, cpf_search, margem, margem_cartao) {
    const stmt = `
      INSERT INTO spreed.result_search_ro (name, cpf_search, margem, margem_cartao)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    try {
      const result = await this.client.query(stmt, [
        name,
        cpf_search,
        margem,
        margem_cartao,
      ]);
      return result.rows[0];
    } catch (error) {
      console.error("Erro ao executar INSERT:", error.message);
      throw error;
    }
  }

  /**
   * Marca um CPF como processado na tabela spreed.ro.
   * @param {string} cpf - CPF a ser marcado.
   * @returns {Promise<Object>} - Resultado da query.
   */
  async insertHasFilter(cpf) {
    const stmt = `
      UPDATE spreed.ro 
      SET has_filter = true
      WHERE cpf = $1
      RETURNING *;
    `;

    try {
      const result = await this.client.query(stmt, [cpf]);
      return result.rows[0];
    } catch (error) {
      console.error("Erro ao executar UPDATE:", error.message);
      throw error;
    }
  }

  /**
   * Encerra a conexão com o banco de dados.
   * @throws {Error} Se houver erro ao desconectar.
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.end();
        this.client = null;
        console.log("Conexão com o banco de dados encerrada.");
      } catch (error) {
        console.error("Erro ao desconectar:", error.message);
        throw error;
      }
    }
  }
}

export default DataBaseManagerPostgreSQL;
