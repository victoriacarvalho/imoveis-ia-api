import "dotenv/config";

import puppeteer from "puppeteer";

import { prisma } from "../lib/db.js";

async function runScraper() {
  const AGENCY_ID = "126"; // ID Casa Forte Imóveis
  console.log(
    "🤖 Iniciando Scraper Sniper (Casa Forte V10.0 - Fatiamento entre Hifens)...",
  );

  await prisma.agency.upsert({
    where: { id: AGENCY_ID },
    update: {},
    create: {
      id: AGENCY_ID,
      name: "Casa Forte Imóveis",
      websiteUrl: "https://www.casaforteimoveis.com.br",
    },
  });

  const browser = await puppeteer.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  try {
    const TOTAL_PAGINAS = 38;
    const todosOsLinks: string[] = [];

    console.log(
      `🔎 Varrendo as ${TOTAL_PAGINAS} páginas do catálogo de venda...`,
    );

    for (let paginaAtual = 1; paginaAtual <= TOTAL_PAGINAS; paginaAtual++) {
      const urlPagina = `https://www.casaforteimoveis.com.br/venda/imoveis/todas-as-cidades/todos-os-bairros/0-quartos/0-suite-ou-mais/0-vaga-ou-mais/0-banheiro-ou-mais?valorminimo=0&valormaximo=0&pagina=${paginaAtual}`;

      console.log(`   -> Acessando página ${paginaAtual}...`);
      await page.goto(urlPagina, { waitUntil: "networkidle2" });

      await new Promise((r) => setTimeout(r, 4000));
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise((r) => setTimeout(r, 1000));

      const linksDaPagina = await page.$$eval("a", (elements) => {
        return elements
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href.includes("detalhe-imovel"));
      });

      todosOsLinks.push(...linksDaPagina);
    }

    const linksUnicos = [...new Set(todosOsLinks)];
    console.log(
      `\n✅ SUCESSO! ${linksUnicos.length} links capturados no total. Iniciando extração...\n`,
    );

    for (const link of linksUnicos) {
      const externalId = link.split("/").pop() || "";
      const pageDetalhe = await browser.newPage();

      try {
        await pageDetalhe.goto(link, { waitUntil: "networkidle2" });

        await pageDetalhe.evaluate(async () => {
          window.scrollBy(0, 1000);
          await new Promise((r) => setTimeout(r, 1000));
        });
        await new Promise((r) => setTimeout(r, 2000));

        const dadosRaw = await pageDetalhe.evaluate(() => {
          const title =
            document.querySelector("h1, .title")?.textContent?.trim() ||
            "Imóvel";
          const textoCompleto = document.body.innerText;

          const linksFotos: string[] = [];

          document
            .querySelectorAll(
              "#carousel-custom img, .carousel-indicators img, .carousel-inner img",
            )
            .forEach((img: any) => {
              const src = img.src;
              if (
                src &&
                (src.includes("imoview.com.br") || src.includes("/Imoveis/")) &&
                !src.includes("logo") &&
                !src.includes("favicon")
              ) {
                linksFotos.push(src);
              }
            });

          return {
            title,
            textoCompleto,
            galeria: [...new Set(linksFotos)],
          };
        });

        // =========================================================
        // 🔴 LÓGICA DOS HIFENS (A sua regra exata)
        // Ex 1: "Casa à venda, 03 quartos - Vila Tanque - João Monlevade/MG"
        // Ex 2: "Ponto Comercial para venda, Rosário - João Monlevade/MG"
        // =========================================================

        const partesHifen = dadosRaw.title.split("-");

        // Tudo antes do 1º hífen (Título + Quartos/Vagas)
        const blocoInicial = partesHifen[0].trim();

        // Título: Corta na primeira vírgula (Ex: "Casa à venda")
        const tituloBanco = blocoInicial.split(",")[0].trim();

        // Bairro: A primeira string que aparece entre o 1º e 2º hífen
        let bairro = "Centro"; // Valor de segurança

        if (partesHifen.length >= 3) {
          // Tem dois hifens, pega o que está no meio!
          bairro = partesHifen[1].trim();
        } else if (partesHifen.length === 2) {
          // Só tem um hífen, significa que o bairro está antes dele, separado por vírgula
          bairro = blocoInicial.split(",").pop()?.trim() || "Centro";
        }

        // Limpeza de segurança (Se vier "João Monlevade" ou "quarto" como bairro por erro de digitação do corretor)
        if (bairro.toUpperCase().includes("MONLEVADE")) bairro = "Centro";
        if (/quarto|vaga|su[ií]te/i.test(bairro)) bairro = "Centro";

        // Remove palavras genéricas como "Bairro"
        bairro = bairro.replace(/^B\.\s*|^Bairro\s*/i, "").trim();

        // =========================================================

        // --- COMPARAÇÃO DE CARACTERÍSTICAS ---
        const getNumMiolo = (regex: RegExp) => {
          const match = blocoInicial.match(regex);
          return match ? parseInt(match[1]) : 0;
        };
        const getNumDescricao = (regex: RegExp) => {
          const match = dadosRaw.textoCompleto
            .replace(/\s+/g, " ")
            .match(regex);
          return match ? parseInt(match[1]) : 0;
        };

        // Procura no bloco inicial. Se não achar, procura na descrição geral.
        const quartos =
          getNumMiolo(/(\d+)\s*Quarto/i) || getNumDescricao(/(\d+)\s*Quarto/i);
        const banheiros =
          getNumMiolo(/(\d+)\s*Banheiro/i) ||
          getNumMiolo(/(\d+)\s*Su[ií]te/i) ||
          getNumDescricao(/(\d+)\s*Banheiro/i) ||
          getNumDescricao(/(\d+)\s*Su[ií]te/i);
        const vagas =
          getNumMiolo(/(\d+)\s*(?:Vaga|Garagem)/i) ||
          getNumDescricao(/(\d+)\s*(?:Vaga|Garagem)/i);

        // --- PREÇO E TIPO ---
        const matchPreco = dadosRaw.textoCompleto.match(/R\$\s*([\d.,]+)/);
        let precoFinal = 1000;
        if (matchPreco) {
          precoFinal = Number(
            matchPreco[1].replace(/\./g, "").replace(",", "."),
          );
        }

        let propertyType = "CASA";
        const titleUpper = tituloBanco.toUpperCase();
        if (
          titleUpper.includes("APARTAMENTO") ||
          titleUpper.includes("APT") ||
          titleUpper.includes("KITNET")
        )
          propertyType = "APARTAMENTO";
        else if (titleUpper.includes("LOTE") || titleUpper.includes("TERRENO"))
          propertyType = "LOTE";
        else if (
          titleUpper.includes("COMERCIAL") ||
          titleUpper.includes("SALA") ||
          titleUpper.includes("LOJA") ||
          titleUpper.includes("GALPÃO") ||
          titleUpper.includes("PONTO")
        )
          propertyType = "COMERCIAL";

        if (externalId && externalId.length < 15) {
          await prisma.property.upsert({
            where: {
              agencyId_externalId: {
                agencyId: AGENCY_ID,
                externalId: externalId,
              },
            },
            update: {
              title: tituloBanco, // Ex: "Casa à venda"
              price: precoFinal,
              neighborhood: bairro, // Ex: "Vila Tanque"
              bedrooms: quartos,
              bathrooms: banheiros > 0 ? banheiros : 1,
              parkingSpots: vagas,
              mainImage:
                dadosRaw.galeria[0] ||
                "https://via.placeholder.com/800x600?text=Sem+Foto",
              gallery: dadosRaw.galeria,
              propertyType: propertyType as any,
            },
            create: {
              agencyId: AGENCY_ID,
              externalId: externalId,
              title: tituloBanco,
              transactionType: "VENDA",
              propertyType: propertyType as any,
              price: precoFinal,
              city: "João Monlevade", // Fixo, pois filtramos isso na busca inicial
              state: "MG", // Fixo
              neighborhood: bairro, // Ex: "Vila Tanque"
              mainImage:
                dadosRaw.galeria[0] ||
                "https://via.placeholder.com/800x600?text=Sem+Foto",
              gallery: dadosRaw.galeria,
              bedrooms: quartos,
              bathrooms: banheiros > 0 ? banheiros : 1,
              parkingSpots: vagas,
            },
          });

          console.log(
            `✅ ID: ${externalId} | Título: ${tituloBanco} | Bairro: ${bairro} | Q:${quartos} B:${banheiros} V:${vagas} | Fotos: ${dadosRaw.galeria.length}`,
          );
        }
      } catch (err: any) {
        console.error(`❌ Erro no ID ${externalId} (${link}):`, err.message);
      } finally {
        await pageDetalhe.close();
      }
    }
  } finally {
    await browser.close();
    console.log("🏁 Catálogo da Casa Forte importado com sucesso!");
  }
}

runScraper();
