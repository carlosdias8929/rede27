import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ICONE_CATEGORIA } from '../config/rede27.config';
import { brl, paraReais } from '../lib/format';
import { colors, font, palette, radius, shadow, spacing } from '../theme';
import type { CategoriaRow } from '../types/database';

type Props = {
  categorias: CategoriaRow[];
  selecionada: string | null;
  onSelecionar: (chave: string) => void;
  /** Distancia usada para estimar o preco mostrado em cada cartao. */
  distanciaKm: number;
};

/** Preco estimado = tarifa base + preco por km * distancia. */
export function estimarCentavos(categoria: CategoriaRow, distanciaKm: number): number {
  return categoria.tarifa_base_centavos + Math.round(categoria.preco_km_centavos * distanciaKm);
}

// Os icones ficam no config, junto do resto da identidade das categorias.

export function SeletorCategoria({
  categorias,
  selecionada,
  onSelecionar,
  distanciaKm,
}: Props) {
  return (
    <View style={estilos.container} accessibilityRole="radiogroup">
      <Text style={estilos.titulo}>Escolha o servico</Text>

      {categorias.map((categoria) => {
        const ativa = categoria.chave === selecionada;
        const preco = brl(paraReais(estimarCentavos(categoria, distanciaKm)));

        return (
          <Pressable
            key={categoria.chave}
            onPress={() => onSelecionar(categoria.chave)}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativa }}
            accessibilityLabel={`${categoria.nome}, ${preco}. ${categoria.descricao}`}
            style={({ pressed }) => [
              estilos.cartao,
              ativa && estilos.cartaoAtivo,
              ativa && shadow(2),
              pressed && estilos.cartaoPressionado,
            ]}
          >
            <Text style={estilos.icone}>{ICONE_CATEGORIA[categoria.chave] ?? '🚗'}</Text>

            <View style={estilos.info}>
              <Text style={[estilos.nome, ativa && estilos.nomeAtivo]}>{categoria.nome}</Text>
              <Text style={estilos.descricao} numberOfLines={2}>
                {categoria.descricao}
              </Text>
            </View>

            <View style={estilos.precoBloco}>
              <Text style={[estilos.preco, ativa && estilos.precoAtivo]}>{preco}</Text>
              <Text style={estilos.precoLegenda}>estimado</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: spacing.sm },
  titulo: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
  },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cartaoAtivo: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primaryLight,
  },
  cartaoPressionado: { opacity: 0.9 },
  icone: { fontSize: 26 },
  info: { flex: 1, gap: 2 },
  nome: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  nomeAtivo: { color: colors.primaryDark },
  descricao: { fontSize: font.size.xs, color: colors.textMuted },
  precoBloco: { alignItems: 'flex-end' },
  preco: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: colors.text,
  },
  precoAtivo: { color: colors.primaryDark },
  precoLegenda: { fontSize: 10, color: palette.gold700, fontWeight: font.weight.medium },
});
