import winston from "winston";

const logger = winston.createLogger({
  level: "info", // nível mínimo que será logado
  format: winston.format.combine(
    winston.format.colorize(), // adiciona cor
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // adiciona timestamp
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    }),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "result.log",
      format: winston.format.combine(
        winston.format.uncolorize(), // remove cor para o arquivo
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level}: ${message}`;
        }),
      ),
    }),
  ],
});

export default logger;
