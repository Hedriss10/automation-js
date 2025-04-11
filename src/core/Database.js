import "dotenv/config";
import { Client } from "pg";

class DataBaseManagerPostgreSQL {
  constructor() {
    this.username = process.env.DB_DEV_USERNAME;
    this.host = process.env.DB_HOST;
    this.password = process.env.DB_DEV_PASSWORD;
    this.database = process.env.DB_DEV_DATABASE;
    this.port = process.env.DB_PORT;
    this.client = null; // Inicializa client como null
  }

  async connect() {
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
      throw error; // Propaga o erro para ser tratado pelo chamador
    }
  }

  async insertResultSearchRo(data) {
    const query = `
      INSERT INTO spree.results (campo1, campo2, campo3)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const values = [data.campo1, data.campo2, data.campo3];

    try {
      const result = await this.client.query(query, values);
      return result.rows[0]; // Retorna o registro inserido
    } catch (error) {
      console.error("Erro ao inserir dados:", error.message);
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

export default DataBaseManagerPostgreSQL;
