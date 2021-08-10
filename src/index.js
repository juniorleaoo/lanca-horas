const playwright = require('playwright');
const inquirer = require('inquirer');
require('dotenv').config();

const init = async () => {
    try {
        const browser = await playwright.chromium.launch({headless: true});
        const context = await browser.newContext();
        const page = await context.newPage();

        await acessarVMulti(page);
        await logar(page);
        await irParaTelaCalendario(page);
        await abrirModalParaLancamentoDeHoras(page);
        await preencherFormulario(page);
        await salvarFormulario(page);

        await page.close();
        await browser.close();

    } catch (e) {
        console.error(e);
    }
};

init();

const obterInformacoesNecessarias = async (page, isDefault) => {
    await selecionarCliente(page, isDefault);
    await preencherData(page, isDefault);
    await selecionarProjeto(page, isDefault);
    await selecionarFase(page, isDefault);
    await selecionarAtividade(page, isDefault);

    const formulario = {};

    const {
        DEFAULT_HORA_INICIO,
        DEFAULT_HORA_INICIO_INTERVALO,
        DEFAULT_HORA_FIM_INTERVALO,
        DEFAULT_HORA_FIM,
        DEFAULT_NARRATIVA
    } = process.env;
    formulario.horaInicio = DEFAULT_HORA_INICIO;
    formulario.horaInicioIntervalo = DEFAULT_HORA_INICIO_INTERVALO;
    formulario.horaFimIntervalo = DEFAULT_HORA_FIM_INTERVALO;
    formulario.horaFim = DEFAULT_HORA_FIM;
    formulario.narrativaPrincipal = DEFAULT_NARRATIVA;

    if (!isDefault) {
        formulario.horaInicio = await getHoraInicio(page);
        formulario.horaInicioIntervalo = await getHoraInicioIntervalo(page);
        formulario.horaFimIntervalo = await getHoraFimIntervalo(page);
        formulario.horaFim = await getHoraFim(page);
        formulario.narrativaPrincipal = await getNarrativaPrincipal(page);
    }

    return formulario;
}

const acessarVMulti = async (page) => {
    console.log('== Acessando VMulti');

    await page.goto(process.env.URL_VMULTI);
}

const logar = async (page) => {
    console.log('== Logando');

    await page.fill('//*[@id="login"]', process.env.LOGIN);
    await page.fill('//*[@id="password_sem_md5"]', process.env.PASSWORD);
    await page.click('//*[@id="login_portal"]/div[5]/button');
}

const irParaTelaCalendario = async (page) => {
    console.log('== Acessando calendário');

    await page.waitForSelector('css=a >> text=ServiceDesk');

    await page.goto(process.env.URL_VMULTI_CALENDARIO);

    await page.waitForSelector('css=b >> text=VISUALIZAÇÃO DIÁRIA');
}

const abrirModalParaLancamentoDeHoras = async (page) => {
    console.log('== Abrindo modal para preenchimento do formulário');

    await page.dblclick('body > table:nth-child(30) > tbody > tr > td:nth-child(2) > table > tbody > tr > td > table.list-table > tbody > tr:nth-child(4)');
    await page.waitForSelector('css=span >> text=Realizando Lançamento');
}

const selecionarCliente = async (page, isDefault) => {
    await page.click('//*[@id="namecliente_form_lanctos"]');
    await page.waitForSelector('css=th >> text=Nome do Cliente');

    if (isDefault) {
        await page.click('css=td >> text=' + process.env.DEFAULT_CLIENTE);
        return;
    }

    const {codigoCliente} = await inquirer.prompt([{
        type: 'list',
        message: 'Selecione o cliente',
        name: 'codigoCliente',
        default: process.env.DEFAULT_CLIENTE,
        choices: await extrairEscolhasDaTabela(page)
    }]);

    await page.click('css=td >> text=' + codigoCliente);
}

const preencherData = async (page, isDefault) => {
    const dataHoje = new Date().toLocaleDateString();

    if (isDefault) {
        await page.fill('//*[@id="f_data_b"]', dataHoje);
        return;
    }

    const {data} = await inquirer.prompt([{
        type: 'input',
        message: 'Digite a data',
        default: dataHoje,
        name: 'data'
    }]);

    await page.fill('//*[@id="f_data_b"]', data);
}

const selecionarProjeto = async (page, isDefault) => {
    await page.click('//*[@id="nameprojeto_form_lanctos"]');
    await page.waitForSelector('css=th >> text=Nome do Projeto');

    if (isDefault) {
        await page.click('css=td >> text=' + process.env.DEFAULT_PROJETO);
        return;
    }

    const {codigoProjeto} = await inquirer.prompt([{
        type: 'list',
        message: 'Selecione o projeto',
        name: 'codigoProjeto',
        default: process.env.DEFAULT_PROJETO,
        choices: await extrairEscolhasDaTabela(page)
    }]);

    await page.click('css=td >> text=' + codigoProjeto);
}

const extrairEscolhasDaTabela = async (page) => {
    return await page.evaluate(() => {
        const rows = document.querySelector('table[class=realceLinha] > tbody').children;

        const result = [];

        for (let row of rows) {
            const [codigoTag, nomeClienteTag, nomeProjetoTag] = row.children;

            const codigo = codigoTag.innerHTML;
            const nomeCliente = nomeClienteTag.innerHTML;
            const nomeProjeto = nomeProjetoTag.innerHTML;

            result.push({
                name: `${codigo} | ${nomeCliente} | ${nomeProjeto}`,
                value: codigo
            });
        }
        result.shift();

        return result;
    });
}

const listarFases = async (page) => {
    return await page.evaluate(() => {
        const options = document.getElementById('idtarefa_utbms').children;

        const result = [];

        for (let option of options) {
            const name = option.innerHTML;
            const value = {id: option.getAttribute('value'), name: name};

            result.push({name, value});
        }

        return result;
    });
}

const selecionarFase = async (page, isDefault) => {
    if (isDefault) {
        await page.selectOption('//*[@id="idtarefa_utbms"]', process.env.DEFAULT_FASE);
        return;
    }

    const {escolha: fase} = await inquirer.prompt([{
        type: 'list',
        message: 'Selecione a fase',
        name: 'escolha',
        choices: await listarFases(page)
    }]);

    await page.selectOption('//*[@id="idtarefa_utbms"]', fase.id);
}

const listarAtividades = async (page) => {
    return await page.evaluate(() => {
        const options = document.getElementById('idatividade_utbms').children;

        const result = [];

        for (let option of options) {
            const name = option.innerHTML;
            const value = {id: option.getAttribute('value'), name: option.innerHTML};
            result.push({name, value});
        }

        return result;
    });
}

const selecionarAtividade = async (page, isDefault) => {
    if (isDefault) {
        await page.selectOption('//*[@id="idatividade_utbms"]', process.env.DEFAULT_ATIVIDADE);
        return;
    }

    const {escolha: atividade} = await inquirer.prompt([{
        type: 'list',
        message: 'Selecione a atividade',
        name: 'escolha',
        choices: await listarAtividades(page)
    }]);

    await page.selectOption('//*[@id="idatividade_utbms"]', atividade.id);
}

const preencherFormulario = async (page) => {
    let formulario = {};

    const {isDefault} = await inquirer.prompt([{
        type: 'confirm',
        message: 'Preencher com informações default?',
        name: 'isDefault',
        default: true
    }]);

    let formularioValido = true;

    do {
        formulario = await obterInformacoesNecessarias(page, isDefault);

        if (isDefault) {
            formularioValido = true;

        } else {
            const {confirmacao} = await inquirer.prompt([{
                type: 'confirm',
                message: 'Formulário está correto?',
                name: 'confirmacao',
                default: true
            }]);
            formularioValido = confirmacao;
        }

    } while (!formularioValido);

    await page.fill('//*[@id="hora"]', formulario.horaInicio);
    await page.fill('//*[@id="intervalo_hr_inicial"]', formulario.horaInicioIntervalo);
    await page.fill('//*[@id="intervalo_hr_final"]', formulario.horaFimIntervalo);
    await page.fill('//*[@id="hora_fim"]', formulario.horaFim);
    await page.fill('//*[@id="narrativa_principal"]', formulario.narrativaPrincipal);
};

const getHoraInicio = async () => {
    return await getInput({message: 'Hora início', defaultValue: '08:00'});
}

const getHoraInicioIntervalo = async () => {
    return await getInput({message: 'Hora Início Intervalo', required: false, defaultValue: '12:00'});
}

const getHoraFimIntervalo = async () => {
    return await getInput({message: 'Hora Fim Intervalo', required: false, defaultValue: '13:00'});
}

const getHoraFim = async () => {
    return await getInput({message: 'Hora Fim', defaultValue: '17:00'});
}

const getNarrativaPrincipal = async () => {
    return await getInput({message: 'Narrativa Principal', defaultValue: process.env.DEFAULT_NARRATIVA});
}

const getInput = async ({message, required = true, defaultValue}) => {
    const {input} = await inquirer.prompt([{
        type: 'input',
        name: 'input',
        message: message,
        default: defaultValue,
        validate: async (input) => {
            return required ? input ? true : 'obrigatório' : true;
        }
    }]);
    return input;
}

const salvarFormulario = async (page) => {
    console.log('== Salvando');

    await page.click('css=span >> text=Salvar');
}
