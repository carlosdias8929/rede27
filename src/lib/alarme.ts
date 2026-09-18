/**
 * Alarme sonoro do painel Admin.
 *
 * Gerado pela Web Audio API, sem arquivo de audio: um bipe sintetizado nao
 * depende de asset, nao aumenta o bundle e nao falha por caminho errado.
 *
 * Toca APENAS aqui. O aplicativo do motorista e silencioso no protocolo 03 —
 * se o passageiro acionou por causa do motorista, um som no carro avisaria
 * exatamente quem representa o risco.
 *
 * Navegadores bloqueiam audio antes de qualquer interacao do usuario, entao
 * `precisaDeGesto()` informa quando o painel deve pedir um clique para liberar.
 */

type Contexto = AudioContext & { state: AudioContextState };

let contexto: Contexto | null = null;
let intervalo: ReturnType<typeof setInterval> | null = null;

function criarContexto(): Contexto | null {
  if (typeof window === 'undefined') return null;

  const Ctor =
    (window as any).AudioContext || (window as any).webkitAudioContext || null;
  if (!Ctor) return null;

  if (!contexto) contexto = new Ctor() as Contexto;
  return contexto;
}

/** Um bipe curto de duas notas — chama atencao sem parecer notificacao comum. */
function bipe() {
  const ctx = criarContexto();
  if (!ctx || ctx.state !== 'running') return;

  const agora = ctx.currentTime;

  for (const [indice, frequencia] of [880, 1170].entries()) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = frequencia;

    const inicio = agora + indice * 0.18;
    const fim = inicio + 0.16;

    // Rampa curta nas pontas evita o "clique" de corte abrupto.
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(0.25, inicio + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.0001, fim);

    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.start(inicio);
    osc.stop(fim + 0.02);
  }
}

/** true quando o navegador ainda exige um clique para liberar o audio. */
export function precisaDeGesto(): boolean {
  const ctx = criarContexto();
  if (!ctx) return false;
  return ctx.state === 'suspended';
}

/** Chamar de dentro de um clique do usuario para destravar o audio. */
export async function liberarAudio(): Promise<boolean> {
  const ctx = criarContexto();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

/** Comeca a repetir o alarme. Chamar de novo nao acumula temporizadores. */
export function iniciarAlarme(intervaloMs = 2500) {
  if (intervalo) return;
  if (!criarContexto()) return;

  bipe();
  intervalo = setInterval(bipe, intervaloMs);
}

export function pararAlarme() {
  if (!intervalo) return;
  clearInterval(intervalo);
  intervalo = null;
}
