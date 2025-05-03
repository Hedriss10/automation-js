import { Builder, By, Key, until } from "selenium-webdriver";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import chrome from "selenium-webdriver/chrome.js";
import logger from "../log/Log.js";

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

  async waitAndFind(locator, timeout = 1500) {
    try {
      await this.driver.wait(until.elementLocated(locator), timeout);
      const element = await this.driver.findElement(locator);
      await this.driver.wait(until.elementIsVisible(element), timeout);
      await this.driver.wait(until.elementIsEnabled(element), timeout);
      return element;
    } catch (error) {
      console.error(
        `Elemento não encontrado com locator ${locator}:`,
        error.message,
      );
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
        console.warn(
          `CPF com tamanho inválido (${cleaned.length} dígitos): ${cpf}`,
        );
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
      await this.driver.executeScript(
        "arguments[0].scrollIntoView({block: 'center'});",
        field,
      );
      await this.driver.sleep(100);
      await this.driver.executeScript("arguments[0].value = '';", field);
      await this.driver.sleep(100);
      let value = await field.getAttribute("value");
      if (value) {
        console.warn(
          `Campo não limpo via JavaScript. Valor atual: ${value}. Tentando método alternativo...`,
        );
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
          console.warn(
            `Campo ainda não limpo. Valor atual: ${value}. Tentando clear()...`,
          );
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
      const backdrops = await this.driver.findElements(
        By.css("div.q-dialog__backdrop"),
      );
      if (backdrops.length > 0 && (await backdrops[0].isDisplayed())) {
        console.log("Modal encontrado. Tentando fechar...");

        // Prioridade 1: Clicar no botão "Confirmar"
        try {
          const confirmButton = await this.driver.findElement(
            By.xpath(
              '//button[contains(@class, "q-btn") and .//span[contains(text(), "Confirmar")]]',
            ),
          );
          await this.driver.executeScript(
            "arguments[0].scrollIntoView({block: 'center'});",
            confirmButton,
          );
          await this.driver.sleep(200);
          try {
            await confirmButton.click();
          } catch (clickError) {
            console.log(
              "Clique no botão Confirmar falhou, tentando via JavaScript...",
            );
            await this.driver.executeScript(
              "arguments[0].click();",
              confirmButton,
            );
          }
          console.log("Modal fechado com botão Confirmar.");
        } catch (e) {
          console.log(
            "Botão Confirmar não encontrado. Tentando outros métodos...",
          );

          // Prioridade 2: Clicar em botão de fechar (ícone "close" ou texto "Fechar")
          try {
            const closeButton = await this.driver.findElement(
              By.xpath(
                '//button[contains(@class, "q-btn") and (.//i[contains(@class, "material-icons") and text()="close"] or .//span[contains(text(), "Fechar")])]',
              ),
            );
            await this.driver.executeScript(
              "arguments[0].scrollIntoView({block: 'center'});",
              closeButton,
            );
            await this.driver.sleep(200);
            try {
              await closeButton.click();
            } catch (clickError) {
              console.log(
                "Clique no botão de fechar falhou, tentando via JavaScript...",
              );
              await this.driver.executeScript(
                "arguments[0].click();",
                closeButton,
              );
            }
            console.log("Modal fechado com botão de fechar.");
          } catch (e) {
            console.log(
              "Botão de fechar não encontrado. Tentando clicar no backdrop...",
            );

            // Prioridade 3: Clicar no backdrop
            try {
              await this.driver.executeScript(
                "document.querySelector('.q-dialog__backdrop').click();",
              );
              console.log("Modal fechado via backdrop.");
            } catch (backdropError) {
              console.log(
                "Clique no backdrop falhou. Removendo modal via JavaScript...",
              );

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
        const remainingBackdrops = await this.driver.findElements(
          By.css("div.q-dialog__backdrop"),
        );
        if (
          remainingBackdrops.length > 0 &&
          (await remainingBackdrops[0].isDisplayed())
        ) {
          console.warn(
            "Modal não foi fechado completamente. Tentando novamente com botão Confirmar...",
          );
          const confirmButton = await this.driver.findElement(
            By.xpath(
              '//button[contains(@class, "q-btn") and .//span[contains(text(), "Confirmar")]]',
            ),
          );
          await this.driver.executeScript(
            "arguments[0].click();",
            confirmButton,
          );
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
      const cpfField = await this.waitAndFind(
        By.css('input[name="cpf"]'),
        20000,
      );
      await this.driver.executeScript(
        "arguments[0].scrollIntoView({block: 'center'});",
        cpfField,
      );
      await this.driver.sleep(200);

      const cpfFormatado = await this.formatCPF(cpf);
      console.log(`CPF formatado: ${cpfFormatado}`);

      await this.clearField(cpfField);
      await this.driver.sleep(200);
      try {
        await cpfField.sendKeys(cpfFormatado);
      } catch (sendKeysError) {
        console.log("sendKeys falhou, tentando via JavaScript...");
        await this.driver.executeScript(
          `arguments[0].value = '${cpfFormatado}';`,
          cpfField,
        );
      }
      await this.driver.sleep(500);

      // Verificar se o CPF foi preenchido corretamente
      const cpfValue = await cpfField.getAttribute("value");
      if (cpfValue !== cpfFormatado) {
        console.warn(
          `CPF não preenchido corretamente. Esperado: ${cpfFormatado}, Encontrado: ${cpfValue}`,
        );
        await this.closeModalIfPresent(); // Tentar fechar modal novamente
        await this.clearField(cpfField);
        await this.driver.executeScript(
          `arguments[0].value = '${cpfFormatado}';`,
          cpfField,
        );
        await this.driver.sleep(500);
      }

      if (matricula) {
        const matriculaField = await this.waitAndFind(
          By.css('input[name="matricula"]'),
          2000,
        );
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
        throw new Error(
          'Opção inválida para pensionista. Use "S" para Sim ou "N" para Não',
        );
      }

      const label = option === "S" ? "Sim" : "Não";
      console.log(`Selecionando pensionista: ${label}`);

      const selector = `div.q-radio[aria-label="${label}"]`;
      const pensionistaOption = await this.waitAndFind(By.css(selector), 1000);

      await this.driver.executeScript(
        "arguments[0].scrollIntoView({block: 'center'});",
        pensionistaOption,
      );
      await this.driver.sleep(500);

      try {
        await pensionistaOption.click();
      } catch (clickError) {
        console.log("Tentando clique via JavaScript...");
        await this.driver.executeScript(
          "arguments[0].click();",
          pensionistaOption,
        );
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
        buscarBtn = await this.waitAndFind(
          By.xpath('//button[.//span[contains(., "Buscar Servidor")]]'),
          1000,
        );
      } catch (e) {
        buscarBtn = await this.waitAndFind(
          By.css("button.q-btn.bg-primary.text-white"),
          1000,
        );
      }

      await this.driver.executeScript(
        "arguments[0].scrollIntoView({block: 'center'});",
        buscarBtn,
      );
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

  async scrapeMargins() {
    try {
      logger.info("Coletando dados das margens");

      // Localizar os elementos das margens usando seletores CSS
      const margemDisponivelElement = await this.waitAndFind(
        By.css("div.q-badge.bg-blue"),
        1000,
      );
      const margemCartaoElement = await this.waitAndFind(
        By.css("div.q-badge.bg-red:nth-of-type(1)"),
        1000,
      );
      const margemCartaoBeneficioElement = await this.waitAndFind(
        By.css("div.q-badge.bg-red:nth-of-type(2)"),
        1000,
      );

      // Extrair os textos
      const margemDisponivel = await margemDisponivelElement.getText();
      const margemCartao = await margemCartaoElement.getText();
      const margemCartaoBeneficio =
        await margemCartaoBeneficioElement.getText();

      // Coletar outros dados
      const nomeElement = await this.waitAndFind(
        By.css("span.text-weight-bold"),
        1000,
      );
      const cpfElement = await this.waitAndFind(
        By.xpath('//span[contains(text(), "CPF:")]/following-sibling::text()'),
        1000,
      );
      const matriculaElement = await this.waitAndFind(
        By.xpath(
          '//span[contains(text(), "Matrícula:")]/following-sibling::text()',
        ),
        1000,
      );

      const nome = await nomeElement.getText();
      const cpf = await cpfElement.getText();
      const matricula = await matriculaElement.getText();

      // Validar margens (ignorar se "Sem Margem")
      if (
        margemDisponivel === "Sem Margem" ||
        margemCartao === "Sem Margem" ||
        margemCartaoBeneficio === "Sem Margem"
      ) {
        logger.info("Ignorando dados com 'Sem Margem' na página de detalhes.");
        return null;
      }

      return {
        nome: nome.trim(),
        cpf: cpf.trim(),
        matricula: matricula.trim(),
        margemDisponivel: margemDisponivel.trim(),
        margemCartao: margemCartao.trim(),
        margemCartaoBeneficio: margemCartaoBeneficio.trim(),
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error("Ignorando dados com 'Sem Margem' na página de detalhes.");
      return null;
    }
  }

  async extractTableData() {
    try {
      console.log("Extraindo dados da tabela...");

      // Aguardar o modal de resultados
      let modal;
      try {
        await this.driver.wait(
          until.elementLocated(By.css("div.q-dialog")),
          1000,
        );
        modal = await this.waitAndFind(By.css("div.q-dialog"), 1000);
      } catch (error) {
        console.log("Modal não encontrado ou não carregado.");
        return { headers: [], rows: [] };
      }

      let table;
      try {
        table = await modal.findElement(
          By.css('table[cellspacing="0"][cellpadding="0"]'),
        );
        await this.driver.wait(until.elementIsVisible(table), 1000);
      } catch (error) {
        console.log("Tabela não encontrada ou não carregada no modal.");
        return { headers: [], rows: [] };
      }

      // Extrair cabeçalhos
      const headers = [];
      const headerElements = await table.findElements(
        By.css('thead th:not([style*="display: none"])'),
      );
      for (const header of headerElements) {
        const text = await header.getText();
        if (text.trim()) headers.push(text.trim());
      }
      console.log("Cabeçalhos encontrados:", headers);

      // Extrair linhas
      const rows = [];
      const rowContainers = await table.findElements(
        By.xpath(
          './/tbody//tr[not(contains(@style,"display: none")) and not(.//td[contains(text(), "Nenhum registro encontrado")])]',
        ),
      );

      for (const row of rowContainers) {
        const rowData = {};
        const cells = await row.findElements(
          By.css('td:not([style*="display: none"])'),
        );

        for (let i = 0; i < cells.length && i < headers.length; i++) {
          try {
            const cellText = await cells[i].getText();
            rowData[headers[i]] = cellText.trim();
          } catch (error) {
            console.warn(`Erro ao ler célula ${i}:`, error.message);
            rowData[headers[i]] = "";
          }
        }

        // Ignorar linhas com "Sem Margem" em "Margem Disponível" ou "Margem Cartão"
        if (
          rowData["Margem disponível"] === "Sem Margem" ||
          rowData["Margem Cartão"] === "Sem Margem"
        ) {
          console.log(
            `Ignorando linha com matrícula ${rowData["Matricula"]} por conter "Sem Margem"`,
          );
          continue;
        }

        if (Object.keys(rowData).length > 0) {
          rows.push(rowData);
        }
      }

      console.log(`Encontrados ${rows.length} registros válidos na tabela`);
      if (rows.length > 0) {
        console.log("Dados extraídos:", JSON.stringify(rows, null, 2));
      } else {
        console.log(
          "Nenhuma linha válida encontrada (todas com 'Sem Margem' ou vazias).",
        );
      }

      return { headers, rows };
    } catch (error) {
      console.error("Erro ao extrair dados da tabela:", error.message);
      return { headers: [], rows: [] }; // Retornar vazio em caso de erro
    }
  }

  async handleModalWithMargins() {
    try {
      console.log("Processando modal com margens...");
      const tableData = await this.extractTableData();

      // Se houver dados na tabela, processá-los
      if (tableData.rows && tableData.rows.length > 0) {
        console.log("Dados da tabela encontrados:", tableData);
        // Clicar na primeira linha válida para acessar a página de detalhes
        const validRows = tableData.rows;
        if (validRows.length > 0) {
          const firstRowMatricula = validRows[0]["Matricula"];
          console.log(
            `Selecionando linha com matrícula ${firstRowMatricula}...`,
          );
          const radioButton = await this.waitAndFind(
            By.xpath(
              `//tr[td[contains(text(), "${firstRowMatricula}")]]//div[@role="radio"]`,
            ),
            5000,
          );
          await radioButton.click();
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const marginsData = await this.checkExistsUrlAheadSearch();
          return marginsData ? { margins: marginsData } : tableData;
        }
      }

      console.log(
        "Nenhuma tabela válida encontrada, verificando URL para margens...",
      );
      const marginsData = await this.checkExistsUrlAheadSearch();
      await this.closeModalIfPresent();
      return marginsData ? { margins: marginsData } : { headers: [], rows: [] };
    } catch (error) {
      console.error("Erro ao processar modal:", error.message);
      return { headers: [], rows: [] };
    }
  }

  async checkExistsUrlAheadSearch() {
    try {
      const currentUrl = await this.driver.getCurrentUrl();
      console.log("URL atual:", currentUrl);

      if (currentUrl.includes(process.env.URL_RO_CHECK)) {
        console.log(
          "Redirecionado para página de resultado. Coletando dados...",
        );

        // Coletar os dados das margens
        const marginsData = await this.scrapeMargins();

        // Voltar para a URL de consulta
        await this.driver.navigate().to(process.env.URL_CONSULT);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log("Retornou para:", await this.driver.getCurrentUrl());

        // Garantir que o modal esteja fechado após voltar
        await this.closeModalIfPresent();

        return marginsData; // Retornar os dados coletados ou null
      } else {
        console.log("Não foi necessário voltar. URL atual é adequada.");
        await this.closeModalIfPresent();
        return null;
      }
    } catch (error) {
      console.error("Erro ao verificar ou redirecionar URL:", error.message);
      return null;
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
