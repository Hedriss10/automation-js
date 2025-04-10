import "dotenv/config";

class DataBaseManagerPostgreSQL {
  constructor() {
    this.client = null;
    this.username = null;
    this.port = null;
    this.client = null;
  }

  async connect() {
    this.client = new Client({
      user: "postgres",
      host: "localhost",
      database: "postgres",
      password: "postgres",
      port: 5432,
    });
    await this.client.connect();
  }

  async insert(sql = String) {
    await this.client.query(sql);
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
    }
  }
}
