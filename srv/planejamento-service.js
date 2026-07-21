const cds = require("@sap/cds");
const { SELECT, UPDATE, INSERT } = cds.ql;

module.exports = class PlanejamentoService extends cds.ApplicationService {
  async init() {
    console.log(">>> PlanejamentoService init carregou");
    const { Ordens, LotesLiberacao } = this.entities;

    //O filtro virtual precisa ser convertido antes dos demais filtros mexerem no where.
    //Se deixarmos o escopo de leitura embrulhar o where primeiro, o campo virtual pode
    //ficar dentro de parênteses e chegar até o banco, onde virtual não é filtrável.
    this.before("READ", Ordens, this.aplicarFiltroDeRiscoEstoque);
    this.before("READ", Ordens.drafts, this.aplicarFiltroDeRiscoEstoque);
    this.before("READ", Ordens, this.aplicarEscopoDeLeitura);
    this.before("READ", Ordens.drafts, this.aplicarEscopoDeLeitura);

    this.before(
      ["CREATE", "UPDATE"],
      Ordens.drafts,
      this.validarPeriodoDaOrdem,
    );
    this.before("SAVE", Ordens, this.validarOrdemAntesDeSalvar);

    this.on("liberarOrdem", Ordens, this.liberarOrdem);
    this.on("cancelarOrdem", Ordens, this.cancelarOrdem);
    this.on("processarLote", LotesLiberacao, this.processarLote);

    return super.init();
  }

  async aplicarEscopoDeLeitura(req) {
    // A ? evita erro se req.user não existir
    //Se req.user não existir ele simplesmente retornar Undefined
    if (req.user?.is("admin")) return;

    const matricula = req.user?.id;
    if (!matricula || matricula === "anonymous") {
      return req.reject(401, "Faça login para consultar ordens");
    }

    if (!req.query?.SELECT) return;

    const alias = this.garantirAlias(req.query, "ordem");
    const filtroAcesso = this.montarExistsAcessoOrdem(matricula, alias);
    const whereAtual = req.query.SELECT.where;

    req.query.SELECT.where =
      Array.isArray(whereAtual) && whereAtual.length
        ? ["(", ...whereAtual, ")", "and", filtroAcesso]
        : [filtroAcesso];
  }
  garantirAlias(query, fallback) {
    const from = query?.SELECT?.from;

    if (!from || typeof from !== "object") return fallback;

    if (!from.as) from.as = fallback;

    return from.as;
  }
  montarExistsAcessoOrdem(matricula, aliasOrdem) {
    return {
      xpr: [
        "exists",
        SELECT.from("desafio.ordens.V_AcessosOrdem")
          .alias("acesso")
          .columns({ val: 1 })
          .where([
            { ref: ["acesso", "ordem_ID"] },
            "=",
            { ref: [aliasOrdem, "ID"] },
            "and",
            { ref: ["acesso", "matricula"] },
            "=",
            { val: matricula },
          ]),
      ],
    };
  }

  async aplicarFiltroDeRiscoEstoque(req) {
    const where = req.query?.SELECT?.where;
    if (!Array.isArray(where)) return;

    const filtroRisco = this.obterFiltroBooleano(where, "comRiscoEstoque");
    if (!filtroRisco) return;

    const alias = this.garantirAlias(req.query, "ordem");
    const whereSemVirtual = this.removerFiltroDoCampo(where, "comRiscoEstoque");
    const existsRisco = this.montarExistsRiscoEstoque(alias);
    const filtroEstoque =
      filtroRisco.valor === true ? existsRisco : { xpr: ["not", existsRisco] };

    req.query.SELECT.where = whereSemVirtual.length
      ? ["(", ...whereSemVirtual, ")", "and", filtroEstoque]
      : [filtroEstoque];
  }

  montarExistsRiscoEstoque(aliasOrdem) {
    return {
      xpr: [
        "exists",
        SELECT.from("desafio.ordens.ReservasMateriais")
          .alias("reserva")
          .columns({ val: 1 })
          .where([
            { ref: ["reserva", "ordem_ID"] },
            "=",
            { ref: [aliasOrdem, "ID"] },
            "and",
            {
              xpr: [
                "exists",
                SELECT.from("desafio.ordens.Estoques")
                  .alias("estoque")
                  .columns({ val: 1 })
                  .where([
                    { ref: ["estoque", "material_ID"] },
                    "=",
                    { ref: ["reserva", "material_ID"] },
                    "and",
                    { ref: ["estoque", "deposito_ID"] },
                    "=",
                    { ref: ["reserva", "deposito_ID"] },
                    "and",
                    { ref: ["estoque", "quantidadeDisponivel"] },
                    "<",
                    { ref: ["reserva", "quantidadeNecessaria"] },
                  ]),
              ],
            },
          ]),
      ],
    };
  }

  obterFiltroBooleano(where, campo) {
    for (let indice = 0; indice <= where.length - 3; indice++) {
      const esquerda = where[indice];
      const operador = where[indice + 1];
      const direita = where[indice + 2];
      const filtro = this.extrairComparacaoBooleana(
        esquerda,
        operador,
        direita,
        campo,
      );

      if (filtro) return { indice, valor: filtro.valor };
    }

    for (const item of where) {
      if (Array.isArray(item?.xpr)) {
        const filtro = this.obterFiltroBooleano(item.xpr, campo);
        if (filtro) return filtro;
      }
    }
  }

  removerFiltroDoCampo(where, campo) {
    const resultado = [];

    for (let indice = 0; indice < where.length; indice++) {
      const trecho = where.slice(indice, indice + 3);
      const [esquerda, operador, direita] = trecho;
      const ehFiltroDoCampo = this.extrairComparacaoBooleana(
        esquerda,
        operador,
        direita,
        campo,
      );

      if (!ehFiltroDoCampo) {
        if (Array.isArray(where[indice]?.xpr)) {
          const xpr = this.removerFiltroDoCampo(where[indice].xpr, campo);
          if (xpr.length) resultado.push({ xpr });
          continue;
        }

        resultado.push(where[indice]);
        continue;
      }

      if (resultado[resultado.length - 1] === "and") resultado.pop();

      indice += 2;

      if (where[indice + 1] === "and") indice += 1;
    }

    return this.limparConectoresDoWhere(resultado);
  }

  extrairComparacaoBooleana(esquerda, operador, direita, campo) {
    if (!this.ehOperadorComparacao(operador)) return;

    const valorDireita = this.obterValorBooleano(direita);
    if (this.ehRefCampo(esquerda, campo) && valorDireita !== undefined) {
      return {
        valor: this.ehOperadorNegacao(operador) ? !valorDireita : valorDireita,
      };
    }

    const valorEsquerda = this.obterValorBooleano(esquerda);
    if (this.ehRefCampo(direita, campo) && valorEsquerda !== undefined) {
      return {
        valor: this.ehOperadorNegacao(operador) ? !valorEsquerda : valorEsquerda,
      };
    }
  }

  limparConectoresDoWhere(where) {
    return where.filter((item, indice, itens) => {
      if (item === "(" && itens[indice + 1] === ")") return false;
      if (item === ")" && itens[indice - 1] === "(") return false;
      if ((item === "and" || item === "or") && indice === 0) return false;
      if ((item === "and" || item === "or") && indice === itens.length - 1) {
        return false;
      }

      return true;
    });
  }

  ehRefCampo(valor, campo) {
    return Array.isArray(valor?.ref) && valor.ref.at(-1) === campo;
  }

  obterValorBooleano(valor) {
    if (typeof valor?.val === "boolean") return valor.val;
    if (valor?.val === "true") return true;
    if (valor?.val === "false") return false;
  }

  ehOperadorComparacao(operador) {
    return ["=", "eq", "!=", "<>", "ne"].includes(operador);
  }

  ehOperadorNegacao(operador) {
    return ["!=", "<>", "ne"].includes(operador);
  }

  async validarPeriodoDaOrdem(req) {
    //No CREATE do draft, o Fiori ainda está abrindo a tela e o registro está incompleto.
    //Por isso não buscamos req.subject aqui: ainda não existe um estado anterior confiável
    //para combinar com o delta. Validamos somente se os dois campos vierem no payload.
    //Payload é o "corpo" de dados que a tela envia para o backend em uma requisição
    //No CAP, normalmente é o que chega em: req.data
    if (req.event === "CREATE") {
      const inicio = req.data.dataInicioPlanejada;
      const fim = req.data.dataFimPlanejada;

      if (!inicio || !fim) return;

      return this.validarDatasPeriodo(req, inicio, fim);
    }

    //Precisamos fazer um select porque o banco sempre possui a ultima versao da
    //atualização do draft.
    //O patch possui somente o delta, o ultimo update feito no draft
    //Ou seja, req.data representa apenas o delta da alteração
    //Enquanto o estado completo está persistido no Draft
    //Req.subject é montado internamente na medida que a tela é alterada
    //No url é passado informações da entidade para o backend
    // informa inclusive IsActiveEntity: False -> É apenas um draft
    const ordemAtual = await SELECT.one.from(req.subject);

    //Mas o select acima virá sem o delta, por isso a validação abaixo:
    //Valida se variavel da tela(req.data.data...) esta preenchida
    //Caso não, então valida se a do banco esta
    const inicio =
      req.data.dataInicioPlanejada ?? ordemAtual?.dataInicioPlanejada;

    const fim = req.data.dataFimPlanejada ?? ordemAtual?.dataFimPlanejada;

    if (!inicio || !fim) return;

    return this.validarDatasPeriodo(req, inicio, fim);
  }

  validarDatasPeriodo(req, inicio, fim) {
    const inicioMs = Date.parse(inicio);
    const fimMs = Date.parse(fim);

    if (fimMs <= inicioMs) {
      //return req.error(
      //  400,
      //  "Fim planejado deve ser maior que início planejado",
      //Não vou amarrar pela data fim, porque:
      // Se após notar que a data de fim ficou inferior, posso ajustar a do inicio e
      //Retira a msg de erro do fim
      //Isso porque estariamos "ancorando" o erro ao campo, estava associado
      //especificamento ao campo dataFimPlanejada
      //Mas então temos o Trade-off:
      //Erro sem Target -> Sai do campos, mas vira pop-up/mensagem geral;
      //Erro com Target -> Marca o campos, mas pode ficar preso nele
      //"dataFimPlanejada",
      // );
      //Alternativa - Também não resolve
      const campoAlterado = req.data.dataInicioPlanejada
        ? "dataInicioPlanejada"
        : "dataFimPlanejada";

      return req.error(
        400,
        "Período planejado inválido: fim deve ser maior que início",
        campoAlterado,
      );
    }
  }

  async validarOrdemAntesDeSalvar(req) {
    await this.validarPeriodoDaOrdem(req);
  }

  async liberarOrdem(req) {}

  async cancelarOrdem(req) {}

  async processarLote(req) {}
};
