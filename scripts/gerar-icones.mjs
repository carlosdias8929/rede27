/**
 * Gera os icones do aplicativo a partir da marca que ja existe nas telas.
 *
 * Isto NAO e criacao de identidade visual: e substituir o logotipo generico do
 * Expo, que hoje vai dentro do APK, por um selo com as cores e o numero da
 * REDE 27. Quando o cliente enviar a logo definitiva, estes arquivos sao
 * trocados e nada mais muda.
 *
 * O desenho vem do selo dourado "27" que ja aparece no cabecalho do app: e a
 * reducao que continua legivel no tamanho de um icone na tela inicial.
 */
import { chromium } from 'playwright';

const NAVY = '#0A1931';
const NAVY_CLARO = '#122544';
const OURO = '#FFC700';
const OURO_ESCURO = '#D1A400';

const OUT = process.argv[2];

/**
 * @param {object} o
 * @param {number} o.lado        tamanho final em pixels
 * @param {boolean} o.redondo    desenha o circulo de fundo
 * @param {boolean} o.transparente  sem fundo (icone adaptativo do Android)
 * @param {number} o.escala      fracao do canvas ocupada pela marca
 * @param {boolean} o.mono       versao de uma cor so
 */
function html({ lado, redondo = true, transparente = false, escala = 1, mono = false }) {
  const d = Math.round(lado * escala);
  const fundo = mono ? '#FFFFFF' : `linear-gradient(160deg, ${NAVY_CLARO} 0%, ${NAVY} 70%)`;
  const corTexto = mono ? '#000000' : OURO;
  const anel = mono ? 'none' : `${Math.round(d * 0.035)}px solid ${OURO_ESCURO}`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${lado}px; height: ${lado}px;
    display: flex; align-items: center; justify-content: center;
    background: ${transparente ? 'transparent' : (mono ? '#FFFFFF' : NAVY)};
    font-family: "Segoe UI", Roboto, Arial, sans-serif;
  }
  .selo {
    width: ${d}px; height: ${d}px;
    border-radius: ${redondo ? '50%' : `${Math.round(d * 0.22)}px`};
    background: ${fundo};
    border: ${anel};
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    line-height: 1;
  }
  .rede {
    color: ${mono ? '#000000' : '#FFFFFF'};
    font-size: ${Math.round(d * 0.155)}px;
    font-weight: 800;
    letter-spacing: ${Math.round(d * 0.03)}px;
    margin-left: ${Math.round(d * 0.03)}px;
    margin-bottom: ${Math.round(d * 0.015)}px;
  }
  .num {
    color: ${corTexto};
    font-size: ${Math.round(d * 0.42)}px;
    font-weight: 900;
    letter-spacing: ${Math.round(d * 0.005)}px;
  }
</style></head>
<body><div class="selo"><div class="rede">REDE</div><div class="num">27</div></div></body></html>`;
}

const navegador = await chromium.launch();

async function gerar(arquivo, opcoes) {
  const pagina = await navegador.newPage({
    viewport: { width: opcoes.lado, height: opcoes.lado },
    deviceScaleFactor: 1,
  });
  await pagina.setContent(html(opcoes), { waitUntil: 'load' });
  await pagina.waitForTimeout(250);
  await pagina.screenshot({
    path: `${OUT}/${arquivo}`,
    omitBackground: Boolean(opcoes.transparente),
  });
  await pagina.close();
  console.log('  gerado:', arquivo, `${opcoes.lado}x${opcoes.lado}`);
}

console.log('Gerando icones da REDE 27:');

// Icone principal (iOS e web). O Android arredonda por conta propria.
await gerar('icon.png', { lado: 1024, redondo: false, escala: 1 });

// Icone adaptativo do Android: o sistema recorta a mascara, entao a marca fica
// dentro da area segura (66% do canvas) para nao ser cortada.
await gerar('android-icon-foreground.png', {
  lado: 1024, redondo: true, transparente: true, escala: 0.62,
});

// Versao de uma cor so, usada pelo tema monocromatico do Android 13+.
await gerar('android-icon-monochrome.png', {
  lado: 1024, redondo: true, transparente: true, escala: 0.62, mono: true,
});

// Tela de abertura: marca menor, centralizada no fundo azul.
await gerar('splash-icon.png', { lado: 1024, redondo: true, transparente: true, escala: 0.58 });

// Aba do navegador.
await gerar('favicon.png', { lado: 196, redondo: true, escala: 0.92 });

await navegador.close();
console.log('Pronto.');
