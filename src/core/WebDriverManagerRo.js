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
      await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", field);
      await this.driver.sleep(100);
      await this.driver.executeScript("arguments[0].value = '';", field);
      await this.driver.sleep(100);
      let value = await field.getAttribute("value");
      if (value) {
        console.warn(`Campo não limpo via JavaScript. Valor atual: ${value}. Tentando método alternativo...`);
        try {
          await field.click();
          await field.sendKeys(Key.chord(Key.CONTROL, "a"));
          await field.sendKeys(Key.DELETE);
          await this.driver.sleep(100);
        } catch (clickError) {
          console.log("Clique falhou, tentando via JavaScript...");
          await this.driver.executeScript("arguments[0].click();", field);
          await this.driver.executeScript("arguments[0].value = '';", field);
        }
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

  async closeModalIfPresent() {
    try {
      console.log("Verificando se há modal aberto...");
      const backdrops = await this.driver.findElements(By.css('div.q-dialog__backdrop'));
      if (backdrops.length > 0 && await backdrops[0].isDisplayed()) {
        console.log("Modal encontrado. Tentando fechar...");

        // Prioridade 1: Clicar no botão "Confirmar"
        try {
          const confirmButton = await this.driver.findElement(
            By.xpath('//button[contains(@class, "q-btn") and .//span[contains(text(), "Confirmar")]]')
          );
          await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", confirmButton);
          await this.driver.sleep(200);
          try {
            await confirmButton.click();
          } catch (clickError) {
            console.log("Clique no botão Confirmar falhou, tentando via JavaScript...");
            await this.driver.executeScript("arguments[0].click();", confirmButton);
          }
          console.log("Modal fechado com botão Confirmar.");
        } catch (e) {
          console.log("Botão Confirmar não encontrado. Tentando outros métodos...");

          // Prioridade 2: Clicar em botão de fechar (ícone "close" ou texto "Fechar")
          try {
            const closeButton = await this.driver.findElement(
              By.xpath('//button[contains(@class, "q-btn") and (.//i[contains(@class, "material-icons") and text()="close"] or .//span[contains(text(), "Fechar")])]')
            );
            await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", closeButton);
            await this.driver.sleep(200);
            try {
              await closeButton.click();
            } catch (clickError) {
              console.log("Clique no botão de fechar falhou, tentando via JavaScript...");
              await this.driver.executeScript("arguments[0].click();", closeButton);
            }
            console.log("Modal fechado com botão de fechar.");
          } catch (e) {
            console.log("Botão de fechar não encontrado. Tentando clicar no backdrop...");
            
            // Prioridade 3: Clicar no backdrop
            try {
              await this.driver.executeScript("document.querySelector('.q-dialog__backdrop').click();");
              console.log("Modal fechado via backdrop.");
            } catch (backdropError) {
              console.log("Clique no backdrop falhou. Removendo modal via JavaScript...");
              
              // Última opção: Remover modal via JavaScript
              await this.driver.executeScript(`
                const dialog = document.querySelector('div.q-dialog');
                const backdrop = document.querySelector('div.q-dialog__backdrop');
                if (dialog) dialog.remove();
                if (backdrop) backdrop.remove();
              `);
              console.log("Modal removido via JavaScript.");
            }
          }
        }

        await this.driver.sleep(1500); // Aguardar o modal fechar completamente
        
        // Verificar se o modal ainda está presente
        const remainingBackdrops = await this.driver.findElements(By.css('div.q-dialog__backdrop'));
        if (remainingBackdrops.length > 0 && await remainingBackdrops[0].isDisplayed()) {
          console.warn("Modal não foi fechado completamente. Tentando novamente com botão Confirmar...");
          const confirmButton = await this.driver.findElement(
            By.xpath('//button[contains(@class, "q-btn") and .//span[contains(text(), "Confirmar")]]')
          );
          await this.driver.executeScript("arguments[0].click();", confirmButton);
          await this.driver.sleep(1000);
        }
      } else {
        console.log("Nenhum modal encontrado.");
      }
    } catch (error) {
      console.error("Erro ao fechar modal:", error.message);
      // Não falhar se o modal não puder ser fechado
    }
  }

  async fillFormFields({ cpf, matricula = "", pensionista = "N" }) {
    try {
      console.log("Preenchendo formulário...");

      // Fechar qualquer modal aberto
      await this.closeModalIfPresent();

      // Verificar se o formulário está acessível
      const cpfField = await this.waitAndFind(By.css('input[name="cpf"]'), 20000);
      await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", cpfField);
      await this.driver.sleep(200);

      const cpfFormatado = await this.formatCPF(cpf);
      console.log(`CPF formatado: ${cpfFormatado}`);

      await this.clearField(cpfField);
      await this.driver.sleep(200);
      try {
        await cpfField.sendKeys(cpfFormatado);
      } catch (sendKeysError) {
        console.log("sendKeys falhou, tentando via JavaScript...");
        await this.driver.executeScript(`arguments[0].value = '${cpfFormatado}';`, cpfField);
      }
      await this.driver.sleep(500);

      // Verificar se o CPF foi preenchido corretamente
      const cpfValue = await cpfField.getAttribute("value");
      if (cpfValue !== cpfFormatado) {
        console.warn(`CPF não preenchido corretamente. Esperado: ${cpfFormatado}, Encontrado: ${cpfValue}`);
        await this.closeModalIfPresent(); // Tentar fechar modal novamente
        await this.clearField(cpfField);
        await this.driver.executeScript(`arguments[0].value = '${cpfFormatado}';`, cpfField);
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

      // Aguardar o modal de resultados
      await this.driver.wait(until.elementLocated(By.css('div.q-dialog')), 40000);
      const modal = await this.waitAndFind(By.css('div.q-dialog'), 40000);

      let table;
      try {
        table = await modal.findElement(By.css('table[cellspacing="0"][cellpadding="0"]'));
        await this.driver.wait(until.elementIsVisible(table), 40000);
      } catch (e) {
        console.log("Tabela não encontrada ou não carregada no modal.");
        return { headers: [], rows: [] };
      }

      const headers = [];
      const headerElements = await table.findElements(By.css('thead th:not([style*="display: none"])'));
      for (const header of headerElements) {
        const text = await header.getText();
        if (text.trim()) headers.push(text.trim());
      }

      const rows = [];
      const rowContainers = await table.findElements(By.xpath('.//tbody//tr[not(contains(@style,"display: none")) and not(.//td[contains(text(), "Nenhum registro encontrado")])]'));
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
      if (rows.length > 0) {
        console.log("Dados extraídos:", JSON.stringify(rows, null, 2));
      }
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
      // Fechar o modal após extrair os dados
      await this.closeModalIfPresent();
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
        // Garantir que o modal esteja fechado após voltar
        await this.closeModalIfPresent();
      } else {
        console.log("Não foi necessário voltar. URL atual é adequada.");
        // Fechar qualquer modal que possa estar aberto
        await this.closeModalIfPresent();
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