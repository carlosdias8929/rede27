/**
 * Localizacao e distancia.
 *
 * O cliente aprovou "mapa gratuito provisorio", entao aqui nao ha Google Maps:
 *
 *   - endereco -> coordenadas: Nominatim (OpenStreetMap), gratuito e sem chave;
 *   - distancia: linha reta (Haversine) multiplicada por um fator de rota.
 *
 * Isso e uma APROXIMACAO, e o app diz isso ao passageiro. A distancia real por
 * rua costuma ficar 20% a 40% acima da linha reta; o fator (configuravel no
 * painel Admin) existe para compensar. Quando entrar uma API de rotas de
 * verdade, e este arquivo que sai — o preco ja e calculado no servidor.
 *
 * Nominatim pede identificacao no User-Agent e no maximo 1 consulta por segundo.
 * Respeitamos as duas coisas.
 */
import * as Location from 'expo-location';

import { MARCA } from '../config/rede27.config';

export type Coordenada = {
  latitude: number;
  longitude: number;
  /** Raio de incerteza em metros, quando o aparelho informa. */
  precisao?: number | null;
};

export type EnderecoEncontrado = Coordenada & {
  rotulo: string;
};

/** Distancia em linha reta entre dois pontos, em quilometros. */
export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;

  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/* -------------------------------------------------------------------------- */
/* Localizacao do aparelho                                                    */
/* -------------------------------------------------------------------------- */

export type ResultadoLocalizacao =
  | { ok: true; coordenada: Coordenada }
  | { ok: false; motivo: 'negada' | 'desligada' | 'falhou'; mensagem: string };

/**
 * Le a posicao atual.
 *
 * Usado no acionamento do 03 e como origem da corrida. Nao existe rastreamento
 * em segundo plano nesta fase: so lemos quando o app esta aberto e o usuario
 * fez alguma coisa — foi o combinado com o cliente.
 */
export async function localizacaoAtual(): Promise<ResultadoLocalizacao> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      return {
        ok: false,
        motivo: 'negada',
        mensagem: 'Permissao de localizacao negada. Libere nas configuracoes para usar o 03.',
      };
    }

    const posicao = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      ok: true,
      coordenada: {
        latitude: posicao.coords.latitude,
        longitude: posicao.coords.longitude,
        precisao: posicao.coords.accuracy ?? null,
      },
    };
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : String(erro);

    if (/disabled|desativ|location services/i.test(texto)) {
      return {
        ok: false,
        motivo: 'desligada',
        mensagem: 'Ligue a localizacao do aparelho para usar o 03.',
      };
    }

    return {
      ok: false,
      motivo: 'falhou',
      mensagem: 'Nao foi possivel obter a localizacao agora.',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Endereco -> coordenadas                                                    */
/* -------------------------------------------------------------------------- */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

/** Nominatim limita a 1 consulta por segundo. Serializamos as chamadas. */
let ultimaConsulta = 0;

async function respeitarLimite() {
  const espera = 1100 - (Date.now() - ultimaConsulta);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaConsulta = Date.now();
}

/**
 * Procura o endereco e devolve ate `limite` sugestoes.
 * Devolve lista vazia (nunca lanca) quando nao acha ou a rede falha: o app
 * continua funcionando com a distancia minima.
 */
export async function buscarEndereco(
  texto: string,
  opcoes: { cidade?: string; uf?: string; limite?: number } = {},
): Promise<EnderecoEncontrado[]> {
  const termo = (texto ?? '').trim();
  if (termo.length < 4) return [];

  const { cidade, uf = 'BA', limite = 5 } = opcoes;
  // Ancorar na cidade evita achar rua de mesmo nome do outro lado do pais.
  const consulta = [termo, cidade, uf, 'Brasil'].filter(Boolean).join(', ');

  try {
    await respeitarLimite();

    const url =
      `${NOMINATIM}?format=jsonv2&limit=${limite}` +
      `&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(consulta)}`;

    const resposta = await fetch(url, {
      headers: {
        // Exigido pela politica de uso do Nominatim.
        'User-Agent': `${MARCA.nome}/1.0 (app de transporte)`,
        Accept: 'application/json',
      },
    });

    if (!resposta.ok) return [];

    const dados = (await resposta.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!Array.isArray(dados)) return [];

    return dados
      .map((d) => ({
        latitude: Number(d.lat),
        longitude: Number(d.lon),
        rotulo: String(d.display_name ?? ''),
      }))
      .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));
  } catch {
    // Sem internet ou servico fora: seguimos sem coordenadas.
    return [];
  }
}

/** Texto curto a partir do display_name gigante do Nominatim. */
export function resumirEndereco(rotulo: string, partes = 3): string {
  return rotulo
    .split(',')
    .slice(0, partes)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}
