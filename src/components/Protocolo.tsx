import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PROTOCOLO_5_PASSOS } from '../config/rede27.config';
import { colors, font, palette, radius, spacing } from '../theme';

type Props = {
  /** Passo em que a corrida esta agora (1 a 5). */
  passoAtual: number;
  /** Corrida cancelada: o passo corrente deixa de piscar como "em andamento". */
  cancelada?: boolean;
  /**
   * Corrida concluida: o passo 5 tambem vira concluido. Sem isto ele ficaria
   * marcado como "EM ANDAMENTO" numa corrida ja encerrada e paga.
   */
  concluida?: boolean;
};

/**
 * Protocolo de 5 passos do servico.
 *
 * Os textos vem de PROTOCOLO_5_PASSOS (src/config/rede27.config.ts) e sao
 * provisorios ate o cliente enviar a lista oficial. A estrutura nao muda:
 * cinco passos, avanco sequencial, cada transicao gravada em corrida_eventos.
 */
export function Protocolo({ passoAtual, cancelada = false, concluida = false }: Props) {
  return (
    <View style={estilos.container}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.titulo}>Protocolo do servico</Text>
        <Text style={estilos.contador}>
          Passo {Math.min(passoAtual, 5)} de {PROTOCOLO_5_PASSOS.length}
        </Text>
      </View>

      {PROTOCOLO_5_PASSOS.map((passo, indice) => {
        const concluido = passo.numero < passoAtual || (concluida && passo.numero === passoAtual);
        const atual = passo.numero === passoAtual && !cancelada && !concluida;
        const ultimo = indice === PROTOCOLO_5_PASSOS.length - 1;

        return (
          <View key={passo.chave} style={estilos.linha}>
            {/* Trilha: marcador + conector vertical */}
            <View style={estilos.trilha}>
              <View
                style={[
                  estilos.marcador,
                  concluido && estilos.marcadorConcluido,
                  atual && estilos.marcadorAtual,
                ]}
              >
                <Text
                  style={[
                    estilos.marcadorTexto,
                    (concluido || atual) && estilos.marcadorTextoAtivo,
                  ]}
                >
                  {concluido ? '✓' : passo.numero}
                </Text>
              </View>

              {!ultimo ? (
                <View style={[estilos.conector, concluido && estilos.conectorConcluido]} />
              ) : null}
            </View>

            <View
              style={[estilos.conteudo, ultimo && estilos.conteudoUltimo]}
              accessible
              accessibilityLabel={
                `Passo ${passo.numero}: ${passo.titulo}. ` +
                (concluido ? 'Concluido.' : atual ? 'Em andamento.' : 'Aguardando.')
              }
            >
              <Text
                style={[
                  estilos.passoTitulo,
                  concluido && estilos.passoTituloConcluido,
                  atual && estilos.passoTituloAtual,
                ]}
              >
                {passo.titulo}
              </Text>
              <Text style={estilos.passoDescricao}>{passo.descricao}</Text>

              {atual ? (
                <View style={estilos.etiquetaAtual}>
                  <Text style={estilos.etiquetaAtualTexto}>EM ANDAMENTO</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: 0 },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titulo: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: colors.text,
  },
  contador: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: palette.gold700,
    backgroundColor: colors.accentBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  linha: { flexDirection: 'row', gap: spacing.md },
  trilha: { alignItems: 'center', width: 32 },
  marcador: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcadorConcluido: { backgroundColor: colors.primary, borderColor: colors.primary },
  marcadorAtual: { backgroundColor: colors.secondary, borderColor: palette.gold400 },
  marcadorTexto: {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    color: colors.textFaint,
  },
  marcadorTextoAtivo: { color: colors.textOnDark },
  conector: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  conectorConcluido: { backgroundColor: colors.primary },
  conteudo: { flex: 1, paddingBottom: spacing.lg, gap: 2 },
  conteudoUltimo: { paddingBottom: 0 },
  passoTitulo: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.textFaint,
  },
  passoTituloConcluido: { color: colors.primary },
  passoTituloAtual: { color: colors.secondaryDark, fontWeight: font.weight.bold },
  passoDescricao: { fontSize: font.size.xs, color: colors.textMuted, lineHeight: 17 },
  etiquetaAtual: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  etiquetaAtualTexto: {
    fontSize: 10,
    fontWeight: font.weight.bold,
    color: colors.secondaryDark,
    letterSpacing: 0.5,
  },
});
