import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { chaveFormatada, gerarPixCopiaECola, normalizarChave, ROTULO_TIPO_CHAVE } from '../lib/pix';
import { colors, font, palette, radius, shadow, spacing } from '../theme';
import type { ContaRecebimentoRow } from '../types/database';
import { QrCode } from './QrCode';

type Props = {
  conta: ContaRecebimentoRow;
  /** Cidade da empresa, exigida dentro do QR Code. */
  cidade: string;
  /** Com valor, o banco de quem paga ja abre preenchido. */
  valorCentavos?: number | null;
  /** Identificador da recarga (txid). */
  codigo?: string | null;
  tamanhoQr?: number;
  /** Acao no rodape do cartao, ex.: "Ja paguei nesta conta". */
  children?: React.ReactNode;
};

/**
 * Uma conta PIX da empresa, do jeito que o cliente pediu: em cada conta,
 * "chave copia e cola" e "QR Code pra escanear".
 *
 *   - QR Code: para pagar de outro aparelho, ou tirando print;
 *   - PIX copia e cola: para quem paga no mesmo celular (copia, abre o banco,
 *     cola) — e o caminho mais comum de quem usa o app no proprio telefone;
 *   - a chave em si: para quem prefere digitar ou conferir o CNPJ.
 */
export function CartaoContaPix({
  conta,
  cidade,
  valorCentavos,
  codigo,
  tamanhoQr = 200,
  children,
}: Props) {
  const [copiado, setCopiado] = useState<'codigo' | 'chave' | null>(null);
  const [falhaCopia, setFalhaCopia] = useState(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (relogio.current) clearTimeout(relogio.current);
    },
    [],
  );

  const copiaECola = useMemo(() => {
    try {
      return gerarPixCopiaECola({
        tipoChave: conta.tipo_chave,
        chave: conta.chave,
        nome: conta.titular || conta.banco,
        cidade,
        valorCentavos,
        identificador: codigo,
      });
    } catch {
      return null;
    }
  }, [conta, cidade, valorCentavos, codigo]);

  const copiar = useCallback(async (texto: string, qual: 'codigo' | 'chave') => {
    setFalhaCopia(false);
    try {
      await Clipboard.setStringAsync(texto);
      setCopiado(qual);
      if (relogio.current) clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setCopiado(null), 2500);
    } catch {
      // Navegador sem permissao de area de transferencia: o texto continua
      // selecionavel na tela.
      setFalhaCopia(true);
    }
  }, []);

  const chaveLegivel = chaveFormatada(conta.tipo_chave, conta.chave);

  return (
    <View style={[estilos.cartao, shadow(1)]}>
      <View style={estilos.topo}>
        <View style={estilos.bancoSelo}>
          <Text style={estilos.bancoSeloTexto}>PIX</Text>
        </View>
        <View style={estilos.topoTexto}>
          <Text style={estilos.banco}>{conta.banco}</Text>
          {conta.titular ? <Text style={estilos.titular}>{conta.titular}</Text> : null}
        </View>
      </View>

      <View style={estilos.chaveLinha}>
        <View style={estilos.chaveInfo}>
          <Text style={estilos.rotulo}>Chave {ROTULO_TIPO_CHAVE[conta.tipo_chave]}</Text>
          <Text style={estilos.chave} selectable>
            {chaveLegivel}
          </Text>
        </View>
        <BotaoCopiar
          rotulo={copiado === 'chave' ? 'Copiada!' : 'Copiar chave'}
          ativo={copiado === 'chave'}
          onPress={() => copiar(normalizarChave(conta.tipo_chave, conta.chave), 'chave')}
          acessivel={`Copiar chave PIX ${conta.banco}`}
        />
      </View>

      {copiaECola ? (
        <>
          <View style={estilos.qrBloco}>
            <Text style={estilos.rotuloCentro}>QR Code para escanear</Text>
            <QrCode
              valor={copiaECola}
              tamanho={tamanhoQr}
              rotuloAcessivel={`QR Code PIX ${conta.banco}`}
            />
          </View>

          <View style={estilos.copiaBloco}>
            <Text style={estilos.rotulo}>PIX copia e cola</Text>
            <Text style={estilos.codigo} selectable>
              {copiaECola}
            </Text>
            <BotaoCopiar
              rotulo={copiado === 'codigo' ? 'Codigo copiado!' : 'Copiar codigo PIX'}
              ativo={copiado === 'codigo'}
              destaque
              onPress={() => copiar(copiaECola, 'codigo')}
              acessivel={`Copiar codigo PIX copia e cola ${conta.banco}`}
            />
            {copiado === 'codigo' ? (
              <Text style={estilos.dica} accessibilityLiveRegion="polite">
                Abra o app do seu banco, escolha PIX copia e cola e cole o codigo.
              </Text>
            ) : null}
            {falhaCopia ? (
              <Text style={estilos.erro} accessibilityLiveRegion="polite">
                Nao foi possivel copiar automaticamente. Toque e segure o codigo acima para copiar.
              </Text>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={estilos.erro}>
          Chave invalida para gerar QR Code. Confira no painel Admin.
        </Text>
      )}

      {children ? <View style={estilos.rodape}>{children}</View> : null}
    </View>
  );
}

function BotaoCopiar({
  rotulo,
  onPress,
  ativo,
  destaque,
  acessivel,
}: {
  rotulo: string;
  onPress: () => void;
  ativo: boolean;
  destaque?: boolean;
  acessivel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={acessivel}
      hitSlop={6}
      style={({ pressed }) => [
        estilos.copiar,
        destaque && estilos.copiarDestaque,
        ativo && estilos.copiarAtivo,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text
        style={[
          estilos.copiarTexto,
          destaque && estilos.copiarTextoDestaque,
          ativo && estilos.copiarTextoAtivo,
        ]}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bancoSelo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bancoSeloTexto: { color: palette.gold500, fontWeight: font.weight.heavy, fontSize: font.size.sm },
  topoTexto: { flex: 1, gap: 2 },
  banco: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.primaryDark },
  titular: { fontSize: font.size.xs, color: colors.textMuted },
  chaveLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  chaveInfo: { flex: 1, gap: 2 },
  rotulo: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rotuloCentro: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  chave: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.text },
  qrBloco: { gap: spacing.sm, alignItems: 'center' },
  copiaBloco: { gap: spacing.sm },
  codigo: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.sm,
    fontFamily: 'monospace',
  },
  copiar: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  copiarDestaque: { backgroundColor: colors.accent, borderColor: colors.accent, minHeight: 48 },
  copiarAtivo: { backgroundColor: colors.successBg, borderColor: colors.success },
  copiarTexto: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.primary },
  copiarTextoDestaque: { color: colors.onAccent, fontSize: font.size.md },
  copiarTextoAtivo: { color: colors.success },
  dica: { fontSize: font.size.xs, color: colors.success, fontWeight: font.weight.medium },
  erro: { fontSize: font.size.xs, color: colors.danger, fontWeight: font.weight.medium },
  rodape: { gap: spacing.sm, paddingTop: spacing.xs },
});
