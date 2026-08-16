const cds = require("@sap/cds");
const { SELECT, UPDATE, INSERT } = cds.ql;

/**
 * Representa uma falha esperada de regra de negócio.
 *
 * Permite que cada handler decida como tratar a falha:
 * a liberação individual rejeita a requisição, enquanto o lote
 * registra o erro somente no item afetado.
 */
class ErroDeNegocio extends Error {
  constructor(status, messageKey, args = {}) {
    super(messageKey);
    this.name = "ErroDeNegocio";
    this.status = status;
    this.messageKey = messageKey;
    this.args = args;
  }
}

module.exports = class PlanejamentoService extends cds.ApplicationService {
  async init() {
    const { Ordens, LotesLiberacao, ReservasMateriais, ItensLoteLiberacao } =
      this.entities;

    //O filtro virtual precisa ser convertido antes dos demais filtros mexerem no where.
    //Se deixarmos o escopo de leitura embrulhar o where primeiro, o campo virtual pode
    //ficar dentro de parênteses e chegar até o banco, onde virtual não é filtrável.
    this.before("READ", Ordens, this.aplicarFiltroDeRiscoEstoque);
    this.before("READ", Ordens.drafts, this.aplicarFiltroDeRiscoEstoque);
    this.before("READ", Ordens, this.aplicarEscopoDeLeitura);
    this.before("READ", Ordens.drafts, this.aplicarEscopoDeLeituraDraft);

    // Inclui na consulta os campos técnicos necessários ao cálculo da situação.
    this.before("READ", ReservasMateriais, this.incluirCamposDaSituacaoEstoque);
    this.before(
      "READ",
      ReservasMateriais.drafts,
      this.incluirCamposDaSituacaoEstoque,
    );

    // Calcula a situação depois que os dados forem recuperados.
    this.after("READ", ReservasMateriais, this.preencherSituacaoEstoque);
    this.after("READ", ReservasMateriais.drafts, this.preencherSituacaoEstoque);

    // Preenche a mensagem apresentada na tabela dos itens do lote.
    // Quando ainda não existe resultado, apresenta a mensagem de espera
    // somente na interface, sem gravá-la no banco de dados.
    this.after("READ", ItensLoteLiberacao, (itens, req) => {
      const registros = Array.isArray(itens) ? itens : [itens];

      for (const item of registros) {
        if (!item) continue;

        item.mensagemExibicao =
          item.mensagem ||
          cds.i18n.messages.at("AWAITING_PROCESSING", req.locale);
      }
    });

    // Valida o período na criação e nas alterações parciais do draft.
    // No PATCH, a tela envia somente os campos alterados; a rotina combina esse
    // delta com os valores já persistidos antes de comparar o início e o fim.
    // PATCH é o evento específico do draft e funciona como alias de UPDATE no CAP.
    this.before(["CREATE", "PATCH"], Ordens.drafts, this.validarPeriodoDaOrdem);

    // Rejeita imediatamente valores estimados fora do intervalo durante
    // a criação ou edição do draft, antes da tentativa de ativação.
    this.before(["CREATE", "UPDATE"], Ordens.drafts, this.validarValorEstimado);
    // SAVE em Ordens.drafts é executado somente durante a ativação do draft.
    // Além das validações finais, cria os vínculos funcionais que tornam a nova
    // ordem visível e operável após sua persistência.
    this.before("SAVE", Ordens.drafts, this.prepararAtivacaoDaOrdem);

    this.on("liberarOrdem", Ordens, this.onliberarOrdem);
    this.on("cancelarOrdem", Ordens, this.oncancelarOrdem);
    this.on("processarLote", LotesLiberacao, this.onProcessarLote);

    return super.init();
  }

  /**
   * Restringe a leitura das ordens ativas ao escopo do usuário autenticado.
   *
   * Para cada ordem consultada, deve existir em V_AcessosOrdem um registro cuja
   * ordem_ID corresponda ao ID da própria ordem que está sendo avaliada e cuja
   * matrícula corresponda a req.user.id. Portanto, possuir acesso à OM-0001,
   * por exemplo, não permite visualizar a OM-0002: cada ordem precisa ter seu
   * próprio vínculo de acesso para esse usuário.
   *
   * O administrador pode consultar todas as ordens ativas.
   *
   * Esta função não controla a leitura de drafts. Um draft de ordem nova ainda
   * não possui uma ordem ativa nem responsabilidades em V_AcessosOrdem e, por
   * isso, não pode ser autorizado pela regra acima. Esse caso é tratado por
   * aplicarEscopoDeLeituraDraft, que permite ao proprietário consultar o próprio
   * draft sem conceder acesso à ordem ativa de outro usuário.
   *
   * @param {import("@sap/cds").Request} req Requisição READ da ordem ativa.
   * @returns {void}
   */
  async aplicarEscopoDeLeitura(req) {
    // A ? evita erro se req.user não existir
    //Se req.user não existir ele simplesmente retornar Undefined
    if (req.user?.is("admin")) return;

    const matricula = req.user?.id;
    if (!matricula || matricula === "anonymous") {
      return req.reject(401, "AUTH_LOGIN_REQUIRED");
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

  /**
   * Restringe a leitura dos drafts de ordens.
   *
   * Para drafts derivados de ordens existentes, mantém o acesso baseado em
   * V_AcessosOrdem. Para uma ordem nova, que ainda não possui responsabilidades,
   * permite a leitura somente ao usuário registrado pelo CAP como criador do
   * draft em DraftAdministrativeData.CreatedByUser.
   *
   * Esta regra não substitui o lock controlado pelo CAP por InProcessByUser. Ela
   * apenas impede que o filtro de negócio oculte o draft novo do proprietário e
   * não concede propriedade do draft a outro usuário, nem mesmo ao admin.
   *
   * @param {import("@sap/cds").Request} req Requisição READ do draft.
   * @returns {void}
   */
  async aplicarEscopoDeLeituraDraft(req) {
    const matricula = req.user?.id;
    if (!matricula || matricula === "anonymous")
      return req.reject(401, "AUTH_LOGIN_REQUIRED");

    if (!req.query?.SELECT) return;

    const alias = this.garantirAlias(req.query, "ordem");
    const filtroAcesso = this.montarExistsAcessoOrdem(matricula, alias);

    /*
     * A exceção vale somente para drafts novos do próprio usuário.
     *
     * HasActiveEntity = false impede que a autoria seja usada para liberar
     * drafts de ordens ativas às quais o usuário não possui mais acesso.
     *
     * CreatedByUser pertence aos metadados administrativos mantidos pelo CAP e
     * identifica o proprietário original definido pela CR-001.
     */
    const filtroDraftNovoDoCriador = {
      xpr: [
        { ref: [alias, "HasActiveEntity"] },
        "=",
        { val: false },
        "and",
        { ref: [alias, "DraftAdministrativeData", "CreatedByUser"] },
        "=",
        { val: matricula },
      ],
    };

    /*
     * Um draft fica visível quando o usuário possui responsabilidade sobre a
     * ordem ou quando se trata de uma ordem nova criada pelo próprio usuário.
     */
    const filtroEscopo = {
      xpr: [filtroAcesso, "or", filtroDraftNovoDoCriador],
    };

    const whereAtual = req.query.SELECT.where;

    req.query.SELECT.where =
      Array.isArray(whereAtual) && whereAtual.length
        ? ["(", ...whereAtual, ")", "and", filtroEscopo]
        : [filtroEscopo];
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

    const possuiFiltroRisco = this.obterFiltroBooleano(
      where,
      "comRiscoEstoque",
    );

    if (!possuiFiltroRisco) return;

    const alias = this.garantirAlias(req.query, "ordem");
    const existsRisco = this.montarExistsRiscoEstoque(alias);

    req.query.SELECT.where = this.substituirFiltroBooleano(
      where,
      "comRiscoEstoque",
      existsRisco,
    );
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

  /**
   * Substitui a comparação de um campo booleano virtual por uma expressão CQN
   * (CQN é o formato interno da consulta no CAP)
   * que possa ser executada pelo banco de dados.
   *
   * A substituição acontece na posição original do filtro e também percorre
   * expressões `xpr` aninhadas
   * (`xpr` representa um filtro agrupado, como uma condição entre parênteses).
   * Dessa forma, operadores como `and` e `or`, além dos agrupamentos da consulta,
   * permanecem com a mesma semântica. Quando a comparação solicita `false`, a
   * expressão recebida é envolvida por `not`.
   *
   * @param {Array} where Expressão CQN do filtro que será percorrida.
   * @param {string} campo Nome do campo booleano virtual que será substituído.
   * @param {object} filtroVerdadeiro Expressão CQN equivalente ao valor `true`.
   * @returns {Array} Nova expressão CQN com o filtro virtual substituído.
   */
  substituirFiltroBooleano(where, campo, filtroVerdadeiro) {
    const resultado = [];

    for (let indice = 0; indice < where.length; indice++) {
      const esquerda = where[indice];
      const operador = where[indice + 1];
      const direita = where[indice + 2];

      const comparacao = this.extrairComparacaoBooleana(
        esquerda,
        operador,
        direita,
        campo,
      );

      if (comparacao) {
        const filtroSubstituto =
          comparacao.valor === true
            ? filtroVerdadeiro
            : { xpr: ["not", filtroVerdadeiro] };

        resultado.push(filtroSubstituto);
        indice += 2;
        continue;
      }

      const item = where[indice];

      if (Array.isArray(item?.xpr)) {
        resultado.push({
          ...item,
          xpr: this.substituirFiltroBooleano(item.xpr, campo, filtroVerdadeiro),
        });
        continue;
      }

      resultado.push(item);
    }

    return resultado;
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
        valor: this.ehOperadorNegacao(operador)
          ? !valorEsquerda
          : valorEsquerda,
      };
    }
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
      //Não vou amarrar pela data fim, porque:
      // Se após notar que a data de fim ficou inferior, posso ajustar a do inicio e
      //Retira a msg de erro do fim
      //Isso porque estariamos "ancorando" o erro ao campo, estava associado
      //especificamento ao campo dataFimPlanejada
      //Mas então temos o Trade-off:
      //Erro sem Target -> Sai do campos, mas vira pop-up/mensagem geral;
      //Erro com Target -> Marca o campos, mas pode ficar preso nele
      //"dataFimPlanejada",
      //Alternativa - Também não resolve
      const campoAlterado = req.data.dataInicioPlanejada
        ? "dataInicioPlanejada"
        : "dataFimPlanejada";
      /*
       * O uso de req.reject é intencional.
       * Em drafts, req.error com target pode ser convertido pelo CAP em uma mensagem
       * persistida, permitindo que o PATCH termine com sucesso. A regra do negócio
       * exige rejeitar a alteração e impedir a persistência do período inválido.
       */
      return req.reject(400, "INVALID_PLANNED_PERIOD", campoAlterado);
    }
  }

  async prepararAtivacaoDaOrdem(req) {
    await this.validarPeriodoDaOrdem(req);
    this.validarValorEstimado(req);
    if (req.errors?.length) return;
    await this.criarResponsabilidadesDaNovaOrdem(req);
  }

  /**
   * Cria as responsabilidades funcionais durante a ativação de uma ordem nova.
   *
   * O criador registrado pelo CAP em DraftAdministrativeData recebe o papel
   * SUPERVISOR. O usuário indicado em responsavel_matricula recebe EXECUTOR.
   * Se ambos forem a mesma pessoa, os dois papéis são mantidos. Drafts de ordens
   * já ativas não recriam vínculos. As inserções usam a transação da ativação;
   * portanto, uma falha posterior também desfaz as responsabilidades.
   *
   * @param {import("@sap/cds").Request} req Requisição interna da ativação.
   * @returns {Promise<void>}
   */
  async criarResponsabilidadesDaNovaOrdem(req) {
    const { Ordens, ResponsabilidadesOrdem, Usuarios } = this.entities;
    const ID = req.data?.ID;

    if (!ID) return;

    const draft = await SELECT.one
      .from(Ordens.drafts)
      .columns([
        { ref: ["HasActiveEntity"] },
        { ref: ["responsavel_matricula"] },
        {
          ref: ["DraftAdministrativeData"],
          expand: [{ ref: ["CreatedByUser"] }],
        },
      ])
      .where({ ID });

    if (!draft) return req.reject(404, "DRAFT_NOT_EXISTING");
    if (draft.HasActiveEntity) return;

    const criador = draft.DraftAdministrativeData?.CreatedByUser;
    const responsavel = draft.responsavel_matricula;
    const matriculas = [...new Set([criador, responsavel].filter(Boolean))];

    const usuarios = await SELECT.from(Usuarios)
      .columns("matricula")
      .where({ matricula: { in: matriculas } });
    const matriculasExistentes = new Set(
      usuarios.map(({ matricula }) => matricula),
    );
    const matriculaInvalida = matriculas.find(
      (matricula) => !matriculasExistentes.has(matricula),
    );

    if (!criador || !responsavel || matriculaInvalida) {
      return req.reject(400, "RESPONSIBILITY_USER_NOT_FOUND", {
        user: matriculaInvalida || criador || responsavel || "",
      });
    }

    const responsabilidadesDesejadas = [
      { usuario_matricula: criador, papel: "SUPERVISOR" },
      { usuario_matricula: responsavel, papel: "EXECUTOR" },
    ];
    const existentes = await SELECT.from(ResponsabilidadesOrdem)
      .columns("usuario_matricula", "papel")
      .where({
        ordem_ID: ID,
        usuario_matricula: { in: matriculas },
        papel: { in: ["SUPERVISOR", "EXECUTOR"] },
      });
    const chavesExistentes = new Set(
      existentes.map(
        ({ usuario_matricula, papel }) => `${usuario_matricula}:${papel}`,
      ),
    );
    const novasResponsabilidades = responsabilidadesDesejadas
      .filter(
        ({ usuario_matricula, papel }) =>
          !chavesExistentes.has(`${usuario_matricula}:${papel}`),
      )
      .map((responsabilidade) => ({
        ID: cds.utils.uuid(),
        ordem_ID: ID,
        ...responsabilidade,
      }));

    if (novasResponsabilidades.length) {
      await INSERT.into(ResponsabilidadesOrdem).entries(novasResponsabilidades);
    }
  }

  /**
   * Processa a action de liberação individual chamada pela Object Page.
   *
   * Converte falhas esperadas da regra de negócio em `req.reject()`,
   * garantindo resposta HTTP adequada e rollback da requisição individual.
   *
   * @param {cds.Request} req Requisição CAP da action vinculada à ordem.
   * @returns {Promise<object>} Ordem atualizada após a liberação.
   */
  async onliberarOrdem(req) {
    //Obtém o ID da ordem a partir da URL da requisição
    const { ID } = req.params[0];
    //Delega a lógica principal ao método abaixo
    //O await é importante porque a consulta final só deve acontecer depois do processamento principal
    //Que consiste em:
    // Reservar os estoques;
    // Inserir os movimentos; e
    // Atualizar o status.
    try {
      await this.liberarOrdemPorID(ID, req);
    } catch (error) {
      if (error instanceof ErroDeNegocio) {
        return req.reject(error.status, error.messageKey, error.args);
      }
      throw error;
    }
    //Depois da liberação, consulta novamente a ordem
    //Isso devolve ao frontend a ordem já com o status_code: "Liberada"
    return SELECT.one.from(this.entities.Ordens).where({ ID });
  }

  /**
   * Executa a regra transacional de liberação de uma ordem.
   *
   * Valida ordem, reservas e estoques; movimenta as quantidades,
   * registra o histórico de estoque e altera o status para LIBERADA.
   * Não rejeita diretamente uma requisição CAP, pois a rotina também
   * é reutilizada pelo processamento em lote.
   *
   * @param {string} ID Identificador UUID da ordem.
   * @param {cds.Request} req Requisição usada para identificar e autorizar o usuário.
   * @returns {Promise<void>}
   * @throws {ErroDeNegocio} Quando uma regra funcional impede a liberação.
   * @throws {Error} Quando ocorre uma falha inesperada de infraestrutura.
   * Throws interrompe imediatamente a execução atual e lança um erro
   * o JS procura um catch capaz de tratar esse erro
   * Para a liberação individual o catch é tratado no onliberarOrdem
   * Para libeção via lote o catch é tratado no onProcessarLote
   */
  async liberarOrdemPorID(ID, req) {
    //Traz as entidades expostas pelo PlanejamentoService
    //Tanto este, como o comando abaixo, buscam definições
    //A diferença está onde vamos buscar
    //Ordens e ReservasMateriais possuem exposições sendo feita pelo serviço(planejamento-service.cds)
    //Por isso o uso do this, poque este serviço, na pasta .cds, expões as entidades
    //O que não acontece com Estoques e MovimentosEstoque
    //Ambas as declarações poderiam retirar as definições(usar a referência) vinda de cds.entites()
    //Contudo, a diferença é que a entidade declarada no serviço(planejamento-service.cds)
    //pode ter caracteristicas/definições adicionais.
    //Caracteristicas essas não previstas nem possíveis na camada de persitência(schema.cds)
    //Por exemplo, campos virtuais, como o usado na entidade Ordens, eles são definidos/declarados na
    //camada de serviço e não na de persistência.
    //Poderiamos expor Estoques e MovimentosEstoque na camada de serviço? Sim!
    //Mas então possívelmente seriam acessíveis pela API e talvez não fosse desejado.
    //Estoques e MovimentosEstoque são detalhes internos da regra de liberação.
    //Portanto acessá-las pelo modelo de domínio permite usá-las internamente sem necessariamente
    //expô-las aos clientes.
    const { Ordens, ReservasMateriais } = this.entities;
    //Como funciona tecnicamente a declaração abaixo?
    //Primeiro o CAP procura as entidades declaradas dentro do namespace desafio.ordens
    //Depois o JS retira duas dessas entidades e cria variáveis com os mesmos nomes.
    // Ou seja:
    // Primeniro a parte do CAP -> O cds.entities pede ao CAP:
    // "Entregue as definições das entidades que pertencem ao namespace desafio.ordens"
    // OBS: Essas definições representama a ESTRUTURA das entidades.
    // Elas não são os registros armazenados no banco.
    // Segundo a parte do JS -> const { Est, Movi} aplica o conceito de desestruturação de objeto.
    /*  Sem a desestruturação seria algo como:
     *
     *    const entidades = cds.entities("desafio.ordens");
     *    const Estoques = entidades.Estoques;
     *    const MovimentosEstoque = entidades.MovimentosEstoque;
     */
    //        PARA QUE SERVEM AS VARIÁVEIS CRIADAS?
    //Para que quando precisarmos fazer consultas ou alterações no banco,
    //o CAP tenha a referência(como um mapa ou a planta de uma casa)
    //Então quando dizemos: const estoque = await SELECT.one.from(Estoques).where({ ID });
    //Estamos dizendo: Usa essa planta(Estoques) como referência(que é do tipo entidades.Estoques)
    //e efetivamente busca um registro no banco
    const { Estoques, MovimentosEstoque } = cds.entities("desafio.ordens");
    /*
    Em resumo:

        this.entities
        -> Quero a entidade conforme ela foi exposta e configurada neste serviço(srv).
        cds.entities("desafio.ordens")
        -> Quero a entidade original definida no namespace do modelo de domínio(db).

    */

    //Busca e bloqueia a ordem
    //O forUpdate() solicita um bloqueio exclusivo sobre os registros encontrados.
    //Ou seja, o forUpdate não realiza uma "nova consulta", apenas "modifica" o Select para que
    //a consulta seja realiza com bloqueio
    //O select Lê e Bloqueia. Isso é importante porque não existe GAP ou intervalo desprotegido
    //entre Ler e Bloquear. Isso protege, nesse contexto,
    //  contra liberação(e tudo que envolve essa liberacao) duplicada da ordem
    //O bloqueio dura até o encessamento da transação que o adquiriu(Depois do Commit/Rollback)
    const ordem = await SELECT.one.from(Ordens).where({ ID }).forUpdate();

    //Se não existir, encerra a requisição com HTTP 404
    if (!ordem) throw new ErroDeNegocio(404, "ORDER_NOT_FOUND");

    /*
     * Valida a autorização dentro da própria regra de negócio.
     *
     * O filtro aplicado no READ protege somente as consultas. Uma action pode
     * ser chamada diretamente pelo endpoint usando o UUID da ordem. Por isso,
     * a autorização precisa ser repetida antes de qualquer validação funcional
     * ou alteração de estoque.
     *
     * O administrador possui acesso global. Os demais usuários precisam ter
     * uma entrada correspondente na view V_AcessosOrdem.
     */
    if (!req.user?.is("admin")) {
      const acesso = await SELECT.one
        .from("desafio.ordens.V_AcessosOrdem")
        .where({
          ordem_ID: ID,
          matricula: req.user.id,
        });

      if (!acesso)
        throw new ErroDeNegocio(403, "ORDER_ACCESS_DENIED", {
          code: ordem.codigo,
        });
    }

    // Somente um usuário autorizado pode conhecer e validar o estado da ordem.

    //Se a ordem não estiver "aberta" a liberação é interrompida
    if (ordem.status_code !== "ABERTA")
      throw new ErroDeNegocio(409, "ORDER_NOT_OPEN", { code: ordem.codigo });

    //Busca as reservas da ordem
    const reservas = await SELECT.from(ReservasMateriais).where({
      ordem_ID: ID,
    });

    //Se não houver reserva a liberação é interrompida
    if (!reservas.length)
      throw new ErroDeNegocio(409, "ORDER_WITHOUT_RESERVATIONS", {
        code: ordem.codigo,
      });

    /*
     * Fase 1 — identificar os estoques diferentes usados pela ordem.
     *
     * As reservas continuam individualizadas. O Map apenas evita bloquear
     * repetidamente o mesmo registro quando duas reservas usam a mesma
     * combinação de material e depósito.
     */
    const alvosPorChave = new Map();

    for (const reserva of reservas) {
      const chave = JSON.stringify([reserva.material_ID, reserva.deposito_ID]);

      if (!alvosPorChave.has(chave)) {
        alvosPorChave.set(chave, {
          chave,
          material_ID: reserva.material_ID,
          deposito_ID: reserva.deposito_ID,
        });
      }
    }

    /*
     * Todas as ordens adquirem os bloqueios na mesma sequência. Isso reduz
     * o risco de deadlock quando ordens concorrentes usam vários estoques.
     * A ordenação afeta somente os alvos técnicos, não as reservas.
     */
    const alvosOrdenados = [...alvosPorChave.values()].sort((a, b) => {
      const comparacaoMaterial = a.material_ID.localeCompare(b.material_ID);

      return comparacaoMaterial !== 0
        ? comparacaoMaterial
        : a.deposito_ID.localeCompare(b.deposito_ID);
    });

    /*
     * Fase 2 — bloquear todos os estoques antes de validar ou alterar dados.
     * Os bloqueios permanecem ativos até o commit ou rollback da requisição.
     */
    const estoquesBloqueados = new Map();

    for (const alvo of alvosOrdenados) {
      const estoque = await SELECT.one
        .from(Estoques)
        .where({
          material_ID: alvo.material_ID,
          deposito_ID: alvo.deposito_ID,
        })
        .forUpdate();

      estoquesBloqueados.set(alvo.chave, {
        estoque,
        quantidadeDisponivelProjetada: estoque
          ? Number(estoque.quantidadeDisponivel)
          : 0,
        quantidadeReservadaProjetada: estoque
          ? Number(estoque.quantidadeReservada || 0)
          : 0,
      });
    }

    /*
     * Fase 3 — simular o consumo de todas as reservas em memória.
     * Nenhum UPDATE ou INSERT ocorreu até aqui. Se uma reserva falhar, a
     * ordem inteira permanece sem mutações e o lote pode seguir para o item
     * seguinte.
     */
    for (const reserva of reservas) {
      const chave = JSON.stringify([reserva.material_ID, reserva.deposito_ID]);
      const controle = estoquesBloqueados.get(chave);
      const quantidadeNecessaria = Number(reserva.quantidadeNecessaria);

      if (
        !controle?.estoque ||
        controle.quantidadeDisponivelProjetada < quantidadeNecessaria
      ) {
        throw new ErroDeNegocio(409, "INSUFFICIENT_STOCK", {
          code: ordem.codigo,
        });
      }

      controle.quantidadeDisponivelProjetada -= quantidadeNecessaria;
      controle.quantidadeReservadaProjetada += quantidadeNecessaria;
    }

    /*
     * Fase 4 — todas as reservas passaram. Agora cada estoque recebe somente
     * um UPDATE com seu saldo final projetado.
     */
    for (const controle of estoquesBloqueados.values()) {
      await UPDATE(Estoques, controle.estoque.ID).with({
        quantidadeDisponivel: controle.quantidadeDisponivelProjetada,
        quantidadeReservada: controle.quantidadeReservadaProjetada,
      });
    }

    // Mantém um movimento para cada reserva, mas envia todos em um único INSERT.
    const movimentos = reservas.map((reserva) => ({
      ordem_ID: ID,
      material_ID: reserva.material_ID,
      deposito_ID: reserva.deposito_ID,
      quantidade: reserva.quantidadeNecessaria,
      tipo: "RESERVA",
      origem: "liberarOrdem",
    }));

    await INSERT.into(MovimentosEstoque).entries(movimentos);
    //Atualiza o status da ordem
    //Quando do sucesso da movimentação a ordem para de ABERTA para LIBERADA
    await UPDATE(Ordens, ID).with({
      status_code: "LIBERADA",
    });
  }

  async oncancelarOrdem(req) {
    const { ID } = req.params[0];

    //Declaração explícita
    //Crie a variável motivo e atribua a propriedade motivo de req.data.
    //const motivo = req.data.motivo;
    //ou
    //const { motivo } = req.data;
    //Desestruturação
    //Retire a propriedade motivo do objeto req.data e crie uma variável com o mesmo nome.
    //Nesse contexto, não usarei desestruturação porque quero aplicar o método trim()
    //Este método não é aplicado ao objeto mas sim a strings.
    const motivo = req.data?.motivo?.trim();

    await this.cancelarOrdemPorID(ID, motivo, req);

    return SELECT.one.from(this.entities.Ordens).where({ ID });
  }

  async cancelarOrdemPorID(ID, motivo, req) {
    const { Ordens } = this.entities;

    const ordem = await SELECT.one.from(Ordens).where({ ID }).forUpdate();

    //Se não existir, encerra a requisição com HTTP 404
    if (!ordem) {
      return req.reject(404, "ORDER_NOT_FOUND");
    }

    /*
     * Protege a action de cancelamento contra chamadas diretas.
     *
     * O fato de uma ordem não aparecer na listagem do usuário não impede que
     * o endpoint da action seja chamado diretamente. Antes de verificar o
     * status ou atualizar a ordem, confirmamos o acesso funcional do usuário.
     */
    if (!req.user?.is("admin")) {
      const acesso = await SELECT.one
        .from("desafio.ordens.V_AcessosOrdem")
        .where({
          ordem_ID: ID,
          matricula: req.user.id,
        });

      if (!acesso)
        return req.reject(403, "ORDER_ACCESS_DENIED", {
          code: ordem.codigo,
        });
    }

    // Somente ordens abertas podem ser canceladas.
    //Se a ordem não estiver "aberta" a liberação é interrompida
    if (ordem.status_code !== "ABERTA") {
      return req.reject(409, "ORDER_NOT_OPEN", { code: ordem.codigo });
    }

    const observacaoCancelamento = cds.i18n.messages.at(
      "CANCELLATION_NOTE",
      req.locale,
      { reason: motivo },
    );

    //Atualiza o status da ordem
    await UPDATE(Ordens, ID).with({
      status_code: "CANCELADA",
      observacao: observacaoCancelamento,
    });
  }

  /**
   * Nesse exercício, LOTE é um agrupamento de várias ordens que serão processadas juntas.
   * Imagine que precisamos liberar 100 ordens.
   * Em vez de clicar "liberar" 100 vezes, cria um lote contendo essas 100 ordens e exec processarLote
   * Contudo, processarLote não libera diretamente a ordem.
   * Ele COORDENA a execução lógica de liberacao para várias ordens(liberarOrdenPorID)
   *
   * Processa as ordens pendentes vinculadas a um lote de liberação.
   *
   * Cada item é processado individualmente. Falhas funcionais são
   * registradas no próprio item e não interrompem os itens seguintes.
   * Falhas técnicas inesperadas são relançadas para provocar rollback
   * da transação e impedir persistência inconsistente.
   *
   * Ao final, o lote recebe PROCESSADO quando todos os itens têm sucesso
   * ou PROCESSADO_COM_ERRO quando pelo menos um item apresenta falha funcional.
   *
   * @param {cds.Request} req Requisição CAP da action vinculada ao lote.
   * @returns {Promise<object>} Lote atualizado após o processamento.
   */
  async onProcessarLote(req) {
    const { ID } = req.params[0];
    //LotesLiberaacao é o cabeçalho
    //ItensLotesLiberacao contém os itens(ordens)
    const { LotesLiberacao, ItensLoteLiberacao } = this.entities;

    //Buscar Lote pelo ID informado pelo Fiori
    //forUpdate evita a liberação da mesma ordem duas vezes por processos concorrentes/simultâneas
    const lote = await SELECT.one
      .from(LotesLiberacao)
      .where({ ID })
      .forUpdate();

    if (!lote) {
      return req.reject(404, "LOT_NOT_FOUND");
    }

    // No desenho foi solicitado a busca por lotes ABERTO, logo, não será possível realizar reprocesamento
    // Uma vez vez processado, com sucesso ou erro, o statu_code será alterado
    if (lote.status_code !== "ABERTO")
      return req.reject(409, "LOT_ALREADY_PROCESSED");

    // Buscar os itens do lote(Ordens)
    // No desenho foi solicitado a busca por itens PENDENTE.
    // Logo, não será possível realizar reprocesamento
    // Uma vez vez processado, com sucesso ou erro, o statu_code será alterado
    const itens = await SELECT.from(ItensLoteLiberacao).where({
      lote_ID: ID,
      status_code: "PENDENTE",
    });

    if (!itens.length) return req.reject(409, "LOT_WITHOUT_PENDING_ITEMS");

    let sucessos = 0;
    let erros = 0;

    for (const item of itens) {
      // O try/catch individual é o que possilita o processamento parcial.
      // Se uma ordem falhar, a próxima ainda será processada
      // Se o try/catch estivesse encapsulando o for então, no primeiro erro encontrado, sairia do loop sem sequência do processamento
      // Embora não produza automaticamente um COMMIT separado para cada item.
      try {
        //liberarOrdemPorID contém a regra de negócio para liberar cada ordem
        await this.liberarOrdemPorID(item.ordem_ID, req);

        await UPDATE(ItensLoteLiberacao, item.ID).with({
          status_code: "SUCESSO",
          processado: true,
          mensagem: cds.i18n.messages.at("ORDER_RELEASED", req.locale),
        });

        sucessos += 1;
      } catch (error) {
        // Falhas inesperadas de banco ou programação devem cancelar o lote
        // para evitar commit de dados tecnicamente inconsistentes.
        if (!(error instanceof ErroDeNegocio)) throw error;

        // Falhas funcionais esperadas afetam somente o item atual.
        await UPDATE(ItensLoteLiberacao, item.ID).with({
          status_code: "ERRO",
          processado: true,
          mensagem: cds.i18n.messages.at(
            error.messageKey,
            req.locale,
            error.args,
          ),
        });

        erros += 1;
      }
    }
    await UPDATE(LotesLiberacao, ID).with({
      status_code: erros > 0 ? "PROCESSADO_COM_ERRO" : "PROCESSADO",
    });
    return SELECT.one.from(LotesLiberacao).where({ ID });
  }

  /**
   * Preenche a situação de estoque das reservas retornadas pelo serviço.
   *
   * A situação é calculada com a mesma combinação utilizada na liberação:
   * material + depósito.
   * O resultado é apenas informativo e representa o saldo
   * disponível no momento da leitura da tela.
   *
   * @param {object|object[]} resultado Uma reserva ou uma coleção de reservas.
   * @param {cds.Request} req Requisição CAP usada para identificar o idioma.
   * @returns {Promise<void>}
   */
  async preencherSituacaoEstoque(resultado, req) {
    const reservas = Array.isArray(resultado)
      ? resultado
      : resultado
        ? [resultado]
        : [];

    if (!reservas.length) return;

    const reservasValidas = reservas.filter(
      (reserva) =>
        reserva.material_ID &&
        reserva.deposito_ID &&
        reserva.quantidadeNecessaria != null,
    );

    if (!reservasValidas.length) return;

    const { Estoques } = cds.entities("desafio.ordens");

    const materiais = [
      ...new Set(reservasValidas.map((reserva) => reserva.material_ID)),
    ];

    // Busca os estoques dos materiais retornados na leitura.
    const estoques = await SELECT.from(Estoques)
      .columns("material_ID", "deposito_ID", "quantidadeDisponivel")
      .where({
        material_ID: { in: materiais },
      });

    // Cria um mapa para localizar o estoque pela combinação material + depósito.
    const estoquesPorChave = new Map(
      estoques.map((estoque) => [
        `${estoque.material_ID}|${estoque.deposito_ID}`,
        estoque,
      ]),
    );

    for (const reserva of reservasValidas) {
      const chave = `${reserva.material_ID}|${reserva.deposito_ID}`;
      const estoque = estoquesPorChave.get(chave);

      // Disponibiliza para a interface o saldo atual encontrado no estoque.
      // Quando não existe estoque cadastrado, mantém null para diferenciar
      // ausência de cadastro de um estoque existente com saldo igual a zero.
      reserva.quantidadeDisponivel = estoque
        ? Number(estoque.quantidadeDisponivel)
        : null;

      if (!estoque) {
        reserva.situacaoEstoque = cds.i18n.messages.at(
          "STOCK_NOT_REGISTERED",
          req.locale,
        );

        reserva.criticidadeSituacaoEstoque = 1;
        continue;
      }

      const disponivel = Number(estoque.quantidadeDisponivel);
      const solicitado = Number(reserva.quantidadeNecessaria);

      if (disponivel < solicitado) {
        reserva.situacaoEstoque = cds.i18n.messages.at(
          "STOCK_INSUFFICIENT",
          req.locale,
        );

        reserva.criticidadeSituacaoEstoque = 1;
        continue;
      }

      reserva.situacaoEstoque = cds.i18n.messages.at(
        "STOCK_AVAILABLE",
        req.locale,
      );

      reserva.criticidadeSituacaoEstoque = 3;
    }
  }

  /**
   * Inclui na consulta os campos usados para calcular a situação do estoque.
   *
   * O Fiori solicita os códigos e descrições por meio das associações, mas não
   * inclui necessariamente as chaves estrangeiras `material_ID` e `deposito_ID`.
   * Esses campos são necessários para localizar o registro correspondente em
   * Estoques pela combinação material + depósito.
   *
   * @param {cds.Request} req Requisição de leitura de ReservasMateriais.
   * @returns {void}
   */
  incluirCamposDaSituacaoEstoque(req) {
    const colunas = req.query?.SELECT?.columns;

    // Sem um $select explícito, o CAP já retorna os campos persistidos.
    if (!Array.isArray(colunas)) return;

    const dadosDeEstoqueForamSolicitados = colunas.some(
      (coluna) =>
        coluna?.ref?.at(-1) === "quantidadeDisponivel" ||
        coluna?.ref?.at(-1) === "situacaoEstoque" ||
        coluna?.ref?.at(-1) === "criticidadeSituacaoEstoque",
    );

    // Evita adicionar campos e executar processamento em leituras que não
    // utilizam a coluna de situação.
    if (!dadosDeEstoqueForamSolicitados) return;

    const camposNecessarios = [
      "material_ID",
      "deposito_ID",
      "quantidadeNecessaria",
    ];

    for (const campo of camposNecessarios) {
      const campoJaFoiSelecionado = colunas.some(
        (coluna) =>
          Array.isArray(coluna?.ref) &&
          coluna.ref.length === 1 &&
          coluna.ref[0] === campo,
      );

      if (!campoJaFoiSelecionado) {
        colunas.push({ ref: [campo] });
      }
    }
  }

  /**
   * Valida o valor estimado informado durante a edição de uma ordem.
   *
   * A validação explícita é necessária para fornecer feedback imediato no
   * draft. A anotação `@assert.range` permanece como proteção declarativa
   * durante a ativação e a persistência da entidade ativa.
   *
   * @param {cds.Request} req Requisição CAP com o valor informado no payload.
   * @returns {void} Não retorna valor quando a validação termina.
   */
  validarValorEstimado(req) {
    const valorEstimado = req.data?.valorEstimado;

    // Em PATCH, campos não alterados não aparecem no payload.
    if (valorEstimado === undefined || valorEstimado === null) return;

    const valorNumerico = Number(valorEstimado);

    if (valorNumerico < 0 || valorNumerico > 99999999999.99)
      return req.error(400, "INVALID_ESTIMATED_VALUE", "valorEstimado");
  }
};
