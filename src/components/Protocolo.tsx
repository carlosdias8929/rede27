import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, palette, radius, spacing } from '../theme';

export type PassoExibido = {
  numero: number;
  titulo: string;
  descricao: string;
};

type Props = {
  titulo: string;
  passos: PassoExibido[];
  /** Passo em que o fluxo esta agora. */
  passoAtual: number;
  /** Fluxo terminado: o passo corrente tambem aparece concluido. */
  concluido?: boolean;
  /** Fluxo interrompido: nada fica marcado como "em andamento". */
  interrompido?: boolean;
  /** Vermelho em vez de azul no passo corrente — usado no protocolo 03. */
  emergencia?: boolean;
};

/**
 * Lista de passos numerados com marcador de progresso.
 * Serve tanto para o ciclo da corrida quanto para o protocolo 03 — sao dois
 * fluxos diferentes de cinco passos, com a mesma forma visual.
 */
export function Protocolo({
  titulo,
  passos,
  passoAtual,
  concluido = false,
  interrompido = false,
  emergencia = false,
}: Props) {
  return (
    <View>
      <View style={estilos.cabecalho}>
        <Text style={estilos.titulo}>{titulo}</Text>
        <Text style={estilos.contador}>
          Passo {Math.min(passoAtual, passos.length)} de {passos.length}
        </Text>
      </View>

      {passos.map((passo, indice) => {
        const feito = passo.numero < passoAtual || (concluido && passo.numero === passoAtual);
        const atual = passo.numero === passoAtual && !concluido && !interrompido;
        const ultimo = indice === passos.length - 1;

        return (
          <View key={passo.numero} style={estilos.linha}>
            <View style={estilos.trilha}>
              <View
                style={[
                  estilos.marcador,
                  feito && estilos.marcadorFeito,
                  atual && (emergencia ? estilos.marcadorEmergencia : estilos.marcadorAtual),
                ]}
              >
                <Text style={[estilos.marcadorTexto, (feito || atual) && estilos.marcadorTextoAtivo]}>
                  {feito ? '✓' : passo.numero}
                </Text>
              </View>
              {!ultimo ? (
                <View style={[estilos.conector, feito && estilos.conectorFeito]} />
              ) : null}
            </View>

            <View
              style={[estilos.conteudo, ultimo && estilos.conteudoUltimo]}
              accessible
              accessibilityLabel={
                `Passo ${passo.numero}: ${passo.titulo}. ` +
                (feito ? 'Concluido.' : atual ? 'Em andamento.' : 'Aguardando.')
              }
            >
              <Text
                style={[
                  estilos.passoTitulo,
                  feito && estilos.passoTituloFeito,
                  atual && (emergencia ? estilos.passoTituloEmergencia : estilos.passoTituloAtual),
                ]}
              >
                {passo.titulo}
              </Text>
              <Text style={estilos.passoDescricao}>{passo.descricao}</Text>

              {atual ? (
                <View style={[estilos.etiqueta, emergencia && estilos.etiquetaEmergencia]}>
                  <Text
                    style={[estilos.etiquetaTexto, emergencia && estilos.etiquetaTextoEmergencia]}
                  >
                    EM ANDAMENTO
                  </Text>
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
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  titulo: { flex: 1, fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  contador: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.accentText,
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
  marcadorFeito: { backgroundColor: colors.primary, borderColor: colors.primary },
  marcadorAtual: { backgroundColor: colors.secondary, borderColor: palette.gold400 },
  marcadorEmergencia: { backgroundColor: colors.danger, borderColor: colors.danger },
  marcadorTexto: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.textFaint },
  marcadorTextoAtivo: { color: colors.textOnDark },
  conector: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  conectorFeito: { backgroundColor: colors.primary },
  conteudo: { flex: 1, paddingBottom: spacing.lg, gap: 2 },
  conteudoUltimo: { paddingBottom: 0 },
  passoTitulo: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.textFaint },
  passoTituloFeito: { color: colors.primary },
  passoTituloAtual: { color: colors.secondaryDark, fontWeight: font.weight.bold },
  passoTituloEmergencia: { color: colors.danger, fontWeight: font.weight.bold },
  passoDescricao: { fontSize: font.size.xs, color: colors.textMuted, lineHeight: 17 },
  etiqueta: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  etiquetaEmergencia: { backgroundColor: colors.dangerBg },
  etiquetaTexto: {
    fontSize: 10,
    fontWeight: font.weight.bold,
    color: colors.secondaryDark,
    letterSpacing: 0.5,
  },
  etiquetaTextoEmergencia: { color: colors.danger },
});
