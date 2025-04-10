const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const { stringify } = require('csv-stringify/sync');
const csv = require('csv-parser');



class WebDriverManager {
    constructor(browser = 'chrome', username, password) {
        /// se for necessário visualizar o fluxo de execução remover ``--headless``, se não deixa ``--headless``
        this.driver = new Builder()
            .forBrowser(browser)
            .setChromeOptions(new chrome.Options().addArguments(
                '--start-maximized',
                '--disable-infobars',
                '--disable-extensions',
                '--disable-gpu',
                '--no-sandbox',
                '--handless'
            ))
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
                script: 30000
            });
            console.log(`Navegado para: ${url}`);
        } catch (error) {
            console.error('Erro ao navegar para URL:', error);
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
            console.error(`Elemento não encontrado com locator: ${locator}`, error);
            throw error;
        }
    }

    async loginGov() {
        try {
            console.log('Efetuando login...');
            const usuarioField = await this.waitAndFind(By.name('usuario'));
            await usuarioField.sendKeys(this.username);
            
            const senhaField = await this.waitAndFind(By.name('senha'));
            await senhaField.sendKeys(this.password);
            await senhaField.sendKeys(Key.ENTER);
            
            console.log('Login realizado com sucesso');
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            console.error('Erro no login:', error);
            throw error;
        }
    }

    async formatCPF(cpf) {
        try {
            // Remove todos os caracteres não numéricos
            let cleaned = cpf.replace(/\D/g, '');
            
            // Adiciona zeros à esquerda se necessário
            while (cleaned.length < 11) {
                cleaned = '0' + cleaned;
            }
            
            // Verifica se tem 11 dígitos
            if (cleaned.length !== 11) {
                console.warn(`CPF com tamanho inválido (${cleaned.length} dígitos): ${cpf}`);
                return cpf; // Retorna o original para tentativa
            }
            
            // Formata como 000.000.000-00
            return `${cleaned.substring(0, 3)}.${cleaned.substring(3, 6)}.${cleaned.substring(6, 9)}-${cleaned.substring(9)}`;
        } catch (error) {
            console.error(`Erro ao formatar CPF ${cpf}:`, error);
            return cpf; // Retorna o original em caso de erro
        }
    }

    async clearField(field) {
        try {
            await field.click();
            await this.driver.sleep(100);
            await field.sendKeys(Key.chord(Key.CONTROL, 'a'));
            await this.driver.sleep(100);
            await field.sendKeys(Key.DELETE);
            await this.driver.sleep(100);
        } catch (error) {
            console.error('Erro ao limpar campo:', error);
            // Tenta alternativa se o método acima falhar
            await field.clear();
            await this.driver.sleep(100);
        }
    }

    async fillFormFields({ cpf, matricula = '', pensionista = 'N' }) {
        try {
            console.log('Preenchendo formulário...');
            
            // Formatar CPF
            const cpfFormatado = await this.formatCPF(cpf);
            console.log(`CPF formatado: ${cpfFormatado}`);

            // Localizar e limpar campo CPF
            const cpfField = await this.waitAndFind(By.css('input[name="cpf"]'));
            await this.clearField(cpfField);
            await cpfField.sendKeys(cpfFormatado);
            await this.driver.sleep(200); // Espera para garantir o preenchimento

            // Preencher Matrícula (se fornecida)
            if (matricula) {
                const matriculaField = await this.waitAndFind(By.css('input[name="matricula"]'));
                await this.clearField(matriculaField);
                await matriculaField.sendKeys(matricula);
                await this.driver.sleep(200);
            }

            // Selecionar Pensionista
            await this.selectPensionista(pensionista);

            // Clicar em Buscar
            await this.clickBuscarServidor();
            
            return true;
        } catch (error) {
            console.error('Erro no preenchimento do formulário:', error);
            throw error;
        }
    }

    async selectPensionista(option = 'N') {
        try {
            option = option.toUpperCase();
            if (!['S', 'N'].includes(option)) {
                throw new Error('Opção inválida para pensionista. Use "S" para Sim ou "N" para Não');
            }

            const label = option === 'S' ? 'Sim' : 'Não';
            console.log(`Selecionando pensionista: ${label}`);
            
            const selector = `div.q-radio[aria-label="${label}"]`;
            const pensionistaOption = await this.waitAndFind(By.css(selector));
            
            await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", pensionistaOption);
            await this.driver.sleep(500);
            
            try {
                await pensionistaOption.click();
            } catch (clickError) {
                console.log('Tentando clique via JavaScript...');
                await this.driver.executeScript("arguments[0].click();", pensionistaOption);
            }
            
            console.log(`Pensionista "${label}" selecionado com sucesso`);
        } catch (error) {
            console.error('Erro ao selecionar pensionista:', error);
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
                    5000
                );
            } catch (e) {
                buscarBtn = await this.waitAndFind(
                    By.css('button.q-btn.bg-primary.text-white'),
                    5000
                );
            }
            
            await this.driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", buscarBtn);
            await this.driver.sleep(200);
            
            try {
                await buscarBtn.click();
            } catch (clickError) {
                console.log('Tentando clique via JavaScript...');
                await this.driver.executeScript("arguments[0].click();", buscarBtn);
            }
            
            console.log('Botão "Buscar Servidor" clicado com sucesso');
            await new Promise(resolve => setTimeout(resolve, 7000)); // Aguardar resultados
        } catch (error) {
            console.error('Erro ao clicar no botão Buscar Servidor:', error);
            throw error;
        }
    }

    async extractTableData() {
        try {
            console.log('Extraindo dados da tabela...');
            
            let table;
            try {
                table = await this.waitAndFind(By.css('table[cellspacing="0"][cellpadding="0"]'), 12000);
            } catch (e) {
                console.log('Tablea não encontrada ou não carregada pelo o cpf.')
                return {headers: [], rows: []}
            }
            // const table = await this.waitAndFind(By.css('table[cellspacing="0"][cellpadding="0"]'), 25000);
            
            // Coletar cabeçalhos visíveis
            const headers = [];
            const headerElements = await table.findElements(
                By.css('thead th:not([style*="display: none"])')
            );
            
            for (const header of headerElements) {
                const text = await header.getText();
                if (text.trim()) headers.push(text.trim());
            }
            
            // Coletar linhas de dados (incluindo dentro de divs com display: contents)
            const rows = [];
            const rowContainers = await this.driver.findElements(
                By.xpath('//tbody/tr[not(contains(@style,"display: none"))] | //tbody/div[@style="display: contents;"]/tr[not(contains(@style,"display: none"))]')
            );
            
            for (const row of rowContainers) {
                const rowData = {};
                const cells = await row.findElements(
                    By.css('td:not([style*="display: none"])')
                );
                
                for (let i = 0; i < cells.length && i < headers.length; i++) {
                    try {
                        const cellText = await cells[i].getText();
                        rowData[headers[i]] = cellText.trim();
                    } catch (error) {
                        console.warn(`Erro ao ler célula ${i}:`, error);
                        rowData[headers[i]] = '';
                    }
                }
                
                if (Object.keys(rowData).length > 0) {
                    rows.push(rowData);
                }
            }
            
            console.log(`Encontrados ${rows.length} registros na tabela`);
            return { headers, rows };
        } catch (error) {
            console.error('Erro ao extrair dados da tabela:', error);
            throw error;
        }
    }

    async handleModalWithMargins() {
        try {
            console.log('Processando modal com margens...');
            
            const tableData = await this.extractTableData();
            await this.actionRefreshDriverKeys();
            return tableData;
        } catch (error) {
            console.error('Erro ao processar modal:', error);
            throw error;
        }
    }

    async actionRefreshDriverKeys() {
        try {
            console.log('Atualizando os campos...');
            await this.driver.navigate().refresh(); // Atualiza a página diretamente
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('Erro ao atualizar o driver:', error);
            throw error;
        }
    }

    async checkExistsUrlAheadSearch() {
        try {
            const currentUrl = await this.driver.getCurrentUrl();
            console.log("currentUrl", currentUrl);

            if (currentUrl === 'https://consignacao.sistemas.ro.gov.br/#/privado/averbacao/resultado') {
                console.log('Redirecionado para página de resultado. Voltando...');
                await this.driver.navigate().back();
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log('Voltou para:', await this.driver.getCurrentUrl());
            } else {
                console.log('Não foi necessário voltar. URL atual é adequada.');
            }
        } catch (error) {
            console.error('Erro ao verificar ou redirecionar URL:', error);
            throw error;
        }
    }

    async quit() {
        try {
            await this.driver.quit();
            console.log('Navegador fechado com sucesso');
        } catch (error) {
            console.error('Erro ao fechar o navegador:', error);
            throw error;
        }
    }
}

module.exports = WebDriverManager;