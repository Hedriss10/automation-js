import { Builder, By, Key, until } from "selenium-webdriver";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import chrome from "selenium-webdriver/chrome.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

class WebDriverManagerRo {
  constructor(browser = "chrome", username, password) {
    const chromeOptions = new chrome.Options().addArguments(
      "--start-maximized",
      "--disable-infobars",
      "--disable-extensions",
      "--disable-gpu",
      "--no-sandbox",
      "--ignore-certificate-errors",
      "--disable-dev-shm-usage",
      // "--headless", // Descomente para produção
    );

    this.driver = new Builder()
      .forBrowser(browser)
      .setChromeOptions(chromeOptions)
      .build();

    this.username = username;
    this.password = password;
  }

  async navigateTo(url) {
    try {
      await this.driver.get(url);
      await this.driver.manage().window().maximize();
      await this.driver.manage().setTimeouts({
        implicit: 15000,
        pageLoad: 30000,
        script: 30000,
      });
      console.log(`Navegado para: ${url}`);
    } catch (error) {
      console.error("Erro ao navegar para URL:", error.message);
      throw error;
    }
  }

  async waitAndFind(locator, timeout = 15000) {
    try {
      await this.driver.wait(until.elementLocated(locator), timeout);
      const element = await this.driver.findElement(locator);
      await this.driver.wait(until.elementIsVisible(element), timeout);
      await this.driver.wait(until.elementIsEnabled(element), timeout);
      return element;
    } catch (error) {
      console.error(`Elemento não encontrado com locator ${locator}:`, error.message);
      throw error;
    }
  }

  async loginGov() {
    try {
      console.log("Efetuando login...");
      const usuarioField = await this.waitAndFind(By.name("usuario"));
      await usuarioField.sendKeys(this.username);

      const senhaField = await this.waitAndFind(By.name("senha"));
      await senhaField.sendKeys(this.password);
      await senhaField.sendKeys(Key.ENTER);

      console.log("Login realizado com sucesso");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error("Erro no login:", error.message);
      throw error;
    }
  }

  async formatCPF(cpf) {
    try {
      let cleaned = cpf.replace(/\D/g, "");
      while (cleaned.length < 11) {
        cleaned = "0" + cleaned;
      }
      if (cleaned.length !== 11) {
        console.warn(`CPF com tamanho inválido (${cleaned.length} dígitos): ${cpf}`);
        return cpf;
      }
      return `${cleaned.substring(0, 3)}.${cleaned.substring(3, 6)}.${cleaned.substring(6, 9)}-${cleaned.substring(9)}`;
    } catch (error) {
      console.error(`Erro ao formatar CPF ${cpf}:`, error.message);
      return cpf;
    }
  }

  async clearField(field) {
    try {
      await field.click();
      await this.driver.sleep(100);
      // Tentar limpar via JavaScript primeiro
      await this.driver.executeScript("arguments[0].value = '';", field);
      await this.driver.sleep(100);
      // Verificar se o campo está vazio
      let value = await field.getAttribute("value");
      if (value) {
        console.warn(`Campo não limpo via JavaScript. Valor atual: ${value}. Tentando método alternativo...`);
        await field.sendKeys(Key.chord(Key.CONTROL, "a"));
        await field.sendKeys(Key.DELETE);
        await this.driver.sleep(100);
        value = await field.getAttribute("value");
        if (value) {
          console.warn(`Campo ainda não limpo. Valor atual: ${value}. Tentando clear()...`);
          await field.clear();
          await this.driver.sleep(100);
        }
      }
      console.log("Campo limpo com sucesso.");
    } catch (error) {
      console.error("Erro ao limpar campo:", error.message);
      throw error;
    }
  }

  async fillFormFields({ cpf, matricula = "", pensionista = "N" }) {
    try {
      console.log("Preenchendo formulário...");

      const cpfFormatado = await this.formatCPF(cpf);
      console.log(`CPF formatado: ${cpfFormatado}`);

      const cpfField = await this.waitAndFind(By.css('input[name="cpf"]'), 20000);
      await this.clearField(cpfField);
      await cpfField.sendKeys(cpfFormatado);
      await this.driver.sleep(500);

      // Verificar se o CPF foi preenchido corretamente
      const cpfValue = await cpfField.getAttribute("value");
      if (cpfValue !== cpfFormatado) {
        console.warn(`CPF não preenchido corretamente. Esperado: ${cpfFormatado}, Encontrado: ${cpfValue}`);
        await this.clearField(cpfField);
        await cpfField.sendKeys(cpfFormatado);
        await this.driver.sleep(500);
      }

      if (matricula) {
        const matriculaField = await this.waitAndFind(By.css('input[name="matricula"]'), 20000);
        await this.clearField(matriculaField);
        await matriculaField.sendKeys(matricula);
        await this.driver.sleep(200);
      }

      await this.selectPensionista(pensionista);
      await this.clickBuscarServidor();

      return true;
    } catch (error) {
      console.error("Erro no preenchimento do formulário:", error.message);
      throw error;
    }
  }

  async selectPensionista(option = "N") {
    try {
      option = option.toUpperCase();
      if (!["S", "N"].includes(option)) {
        throw new Error('Opção inválida para pensionista. Use "S" para Sim ou "N" para Não');
      }

      const label = option === "S" ? "Sim" : "Não";
      console.log(`Selecionando pensionista: ${label}`);

      const selector = `div.q-radio[aria-label="${label}"]`;
      const pensionistaOption = await this.waitAndFind(By.css(selector), 20000);

      await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", pensionistaOption);
      await this.driver.sleep(500);

      try {
        await pensionistaOption.click();
      } catch (clickError) {
        console.log("Tentando clique via JavaScript...");
        await this.driver.executeScript("arguments[0].click();", pensionistaOption);
      }

      console.log(`Pensionista "${label}" selecionado com sucesso`);
    } catch (error) {
      console.error("Erro ao selecionar pensionista:", error.message);
      throw error;
    }
  }

  async clickBuscarServidor() {
    try {
      console.log('Clicando no botão "Buscar Servidor"...');

      let buscarBtn;
      try {
        buscarBtn = await this.waitAndFind(By.xpath('//button[.//span[contains(., "Buscar Servidor")]]'), 10000);
      } catch (e) {
        buscarBtn = await this.waitAndFind(By.css("button.q-btn.bg-primary.text-white"), 10000);
      }

      await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", buscarBtn);
      await this.driver.sleep(200);

      try {
        await buscarBtn.click();
      } catch (clickError) {
        console.log("Tentando clique via JavaScript...");
        await this.driver.executeScript("arguments[0].click();", buscarBtn);
      }

      console.log('Botão "Buscar Servidor" clicado com sucesso');
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } catch (error) {
      console.error("Erro ao clicar no botão Buscar Servidor:", error.message);
      throw error;
    }
  }

  async extractTableData() {
    try {
      console.log("Extraindo dados da tabela...");

      let table;
      try {
        table = await this.waitAndFind(By.css('table.q-table'), 40000); // Alterado para seletor mais genérico e timeout maior
      } catch (e) {
        console.log("Tabela não encontrada ou não carregada para o CPF.");
        return { headers: [], rows: [] };
      }

      const headers = [];
      const headerElements = await table.findElements(By.css('thead th:not([style*="display: none"])'));
      for (const header of headerElements) {
        const text = await header.getText();
        if (text.trim()) headers.push(text.trim());
      }

      const rows = [];
      const rowContainers = await this.driver.findElements(
        By.xpath('//tbody/tr[not(contains(@style,"display: none"))] | //tbody/div[@style="display: contents;"]/tr[not(contains(@style,"display: none"))]'),
      );

      for (const row of rowContainers) {
        const rowData = {};
        const cells = await row.findElements(By.css('td:not([style*="display: none"])'));
        for (let i = 0; i < cells.length && i < headers.length; i++) {
          try {
            const cellText = await cells[i].getText();
            rowData[headers[i]] = cellText.trim();
          } catch (error) {
            console.warn(`Erro ao ler célula ${i}:`, error.message);
            rowData[headers[i]] = "";
          }
        }
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData);
        }
      }

      console.log(`Encontrados ${rows.length} registros na tabela`);
      return { headers, rows };
    } catch (error) {
      console.error("Erro ao extrair dados da tabela:", error.message);
      throw error;
    }
  }

  async handleModalWithMargins() {
    try {
      console.log("Processando modal com margens...");
      const tableData = await this.extractTableData();
      return tableData;
    } catch (error) {
      console.error("Erro ao processar modal:", error.message);
      throw error;
    }
  }

  async checkExistsUrlAheadSearch() {
    try {
      const currentUrl = await this.driver.getCurrentUrl();
      console.log("URL atual:", currentUrl);

      if (currentUrl.includes(process.env.URL_RO_CHECK)) {
        console.log("Redirecionado para página de resultado. Voltando...");
        await this.driver.navigate().to(process.env.URL_CONSULT);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log("Retornou para:", await this.driver.getCurrentUrl());
      } else {
        console.log("Não foi necessário voltar. URL atual é adequada.");
      }
    } catch (error) {
      console.error("Erro ao verificar ou redirecionar URL:", error.message);
      throw error;
    }
  }

  async quit() {
    try {
      await this.driver.quit();
      console.log("Navegador fechado com sucesso");
    } catch (error) {
      console.error("Erro ao fechar o navegador:", error.message);
      throw error;
    }
  }
}

export default WebDriverManagerRo;