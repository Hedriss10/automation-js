import WebDriverManagerRo from "../core/WebDriverManagerRo";

function startBot() {
  // Inicializa o bot
  const bot = new WebDriverManagerRo("chrome");
  bot.start();
}

startBot();
