import "dotenv/config";

import puppeteer from "puppeteer";

import { prisma } from "../lib/db.js";

async function runScraper() {
  const AGENCY_ID = "125";
  console.log(" Iniciando Scraper Sniper (Versão 3.1 - Imagens Shadowbox)...");

  await prisma.agency.upsert({
    where: { id: AGENCY_ID },
    update: {},
    create: {
      id: AGENCY_ID,
      name: "Casa São José",
      websiteUrl: "https://imobiliariasaojose.com.br",
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
    const TOTAL_PAGINAS = 21;
    const todosOsLinks: string[] = [];

    console.log(`🔎 Varrendo as ${TOTAL_PAGINAS} páginas do catálogo...`);

    for (let paginaAtual = 1; paginaAtual <= TOTAL_PAGINAS; paginaAtual++) {
      const urlPagina = `https://imobiliariasaojose.com.br/imoveis.php?filtro=venda&Pag=${paginaAtual}`;
      await page.goto(urlPagina, { waitUntil: "networkidle2" });

      const linksDaPagina = await page.$$eval("a", (elements) =>
        elements
          .filter((a) => a.href.includes("detalhes.php?id="))
          .map((a) => a.href),
      );
      todosOsLinks.push(...linksDaPagina);
    }

    const linksUnicos = [...new Set(todosOsLinks)];
    console.log(
      `\n✅ ${linksUnicos.length} imóveis encontrados. Extraindo dados...\n`,
    );

    for (const link of linksUnicos) {
      const pageDetalhe = await browser.newPage();

      try {
        await pageDetalhe.goto(link, { waitUntil: "networkidle2" });

        const dadosRaw = await pageDetalhe.evaluate(() => {
          const linhas = document.body.innerText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

          const addressLine =
            linhas.find(
              (line) =>
                line.includes("João Monlevade") &&
                line.includes("-") &&
                !line.includes("R$") &&
                !line.toUpperCase().includes("ALUGUEL") &&
                !line.toUpperCase().includes("VENDA"),
            ) || "";

          const externalIdLine =
            linhas.find((line) => line.toUpperCase().includes("COD:")) || "";
          const priceLine =
            linhas.find((line) => line.includes("R$") && line.includes(",")) ||
            "0";

          const idxCod = linhas.findIndex((line) =>
            line.toUpperCase().includes("COD:"),
          );
          let title = "Imóvel";
          if (idxCod >= 0 && linhas.length > idxCod + 1)
            title = linhas[idxCod + 1];

          const linksFotos = Array.from(
            document.querySelectorAll('a[rel*="shadowbox"], a[rel*="galeria"]'),
          )
            .map((a) => (a as HTMLAnchorElement).href)
            .filter(
              (href) =>
                href && (href.includes(".jpg") || href.includes(".png")),
            );

          const caracteristicas: any = { quartos: 0, suites: 0, vagas: 0 };
          const boxes = document.querySelectorAll(
            'div[style*="border: 1px solid #ccc"]',
          );
          boxes.forEach((box) => {
            const label =
              box.querySelector("span")?.textContent?.trim().toUpperCase() ||
              "";
            const valor = box.querySelector("b")?.textContent?.trim() || "0";
            if (label.includes("QUARTO"))
              caracteristicas.quartos = parseInt(valor) || 0;
            if (label.includes("SUITE"))
              caracteristicas.suites = parseInt(valor) || 0;
            if (label.includes("VAGA"))
              caracteristicas.vagas = parseInt(valor) || 0;
          });

          return {
            externalId: externalIdLine.replace(/.*COD:\s*/i, "").trim(),
            title,
            addressLine,
            priceText: priceLine,
            caracteristicas,
            galeria: [...new Set(linksFotos)],
          };
        });

        let bairro = "João Monlevade";
        if (dadosRaw.addressLine) {
          const partes = dadosRaw.addressLine.split("-");
          const possivelBairro = partes[0]
            .trim()
            .replace(/^B\.\s*|^Bairro\s*/i, "");
          if (!possivelBairro.includes("R$") && possivelBairro.length < 40) {
            bairro = possivelBairro;
          }
        }

        const matchPreco = dadosRaw.priceText.match(/R\$\s*([\d.,]+)/);
        let precoFinal = 1000;
        if (matchPreco) {
          precoFinal = Number(
            matchPreco[1].replace(/\./g, "").replace(",", "."),
          );
        }

        let propertyType = "CASA";
        const titleUpper = dadosRaw.title.toUpperCase();
        if (titleUpper.includes("APARTAMENTO") || titleUpper.includes("APT"))
          propertyType = "APARTAMENTO";
        else if (titleUpper.includes("LOTE") || titleUpper.includes("TERRENO"))
          propertyType = "LOTE";
        else if (
          titleUpper.includes("COMERCIAL") ||
          titleUpper.includes("SALA")
        )
          propertyType = "COMERCIAL";
        else if (titleUpper.includes("REPUBLICA")) propertyType = "REPUBLICA";

        if (dadosRaw.externalId) {
          await prisma.property.upsert({
            where: {
              agencyId_externalId: {
                agencyId: AGENCY_ID,
                externalId: dadosRaw.externalId,
              },
            },
            update: {
              title: dadosRaw.title,
              price: precoFinal,
              neighborhood: bairro,
              bedrooms: dadosRaw.caracteristicas.quartos,
              bathrooms: (dadosRaw.caracteristicas.suites || 0) + 1,
              parkingSpots: dadosRaw.caracteristicas.vagas,
              mainImage: dadosRaw.galeria[0] || "",
              gallery: dadosRaw.galeria,
            },
            create: {
              agencyId: AGENCY_ID,
              externalId: dadosRaw.externalId,
              title: dadosRaw.title,
              transactionType: "VENDA",
              propertyType: propertyType as any,
              price: precoFinal,
              city: "João Monlevade",
              state: "MG",
              neighborhood: bairro,
              mainImage: dadosRaw.galeria[0] || "",
              gallery: dadosRaw.galeria,
              bedrooms: dadosRaw.caracteristicas.quartos,
              bathrooms: (dadosRaw.caracteristicas.suites || 0) + 1,
              parkingSpots: dadosRaw.caracteristicas.vagas,
            },
          });
          console.log(
            `✅ ${dadosRaw.externalId} | Bairro: ${bairro} | Fotos: ${dadosRaw.galeria.length}`,
          );
        }
      } catch (err: any) {
        console.error(`❌ Erro no ID ${link}:`, err.message);
      } finally {
        await pageDetalhe.close();
      }
    }
  } finally {
    await browser.close();
    console.log("🏁 Catálogo importado com sucesso!");
  }
}

runScraper();
