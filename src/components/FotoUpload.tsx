import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { escolherImagem } from '../lib/arquivo';
import { supabase } from '../lib/supabase';
import { colors, font, palette, radius, spacing } from '../theme';

const BUCKET = 'motoristas';

type Props = {
  rotulo: string;
  ajuda?: string;
  /** Nome do arquivo dentro da pasta do motorista: 'perfil' ou 'veiculo'. */
  nomeArquivo: 'perfil' | 'veiculo';
  /** Id do motorista — e tambem a pasta, o que a policy do storage exige. */
  motoristaId: string;
  urlAtual: string | null;
  onEnviado: (url: string) => void;
  /** Retrato para a foto de perfil, paisagem para o veiculo. */
  formato?: 'retrato' | 'paisagem';
};

export function FotoUpload({
  rotulo,
  ajuda,
  nomeArquivo,
  motoristaId,
  urlAtual,
  onEnviado,
  formato = 'retrato',
}: Props) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const escolher = useCallback(async () => {
    setErro(null);

    let imagem;
    try {
      imagem = await escolherImagem({
        editar: true,
        aspecto: formato === 'retrato' ? [1, 1] : [4, 3],
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Nao foi possivel ler a imagem escolhida.');
      return;
    }
    if (!imagem) return;

    setEnviando(true);
    try {
      // A pasta precisa ser o id do motorista: a policy do storage confere isso.
      const caminho = `${motoristaId}/${nomeArquivo}.${imagem.extensao}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, imagem.bytes, {
          contentType: imagem.tipo,
          upsert: true,
        });

      if (error) throw error;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
      // A query garante que a tela mostre a imagem nova, e nao a do cache.
      onEnviado(`${data.publicUrl}?v=${Date.now()}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar a foto.');
    } finally {
      setEnviando(false);
    }
  }, [formato, motoristaId, nomeArquivo, onEnviado]);

  const alturaPreview = formato === 'retrato' ? 120 : 150;

  return (
    <View style={estilos.bloco}>
      <Text style={estilos.rotulo}>
        {rotulo} <Text style={estilos.obrigatorio}>*</Text>
      </Text>

      <Pressable
        onPress={escolher}
        disabled={enviando}
        accessibilityRole="button"
        accessibilityLabel={urlAtual ? `Trocar ${rotulo}` : `Enviar ${rotulo}`}
        style={[
          estilos.area,
          { height: alturaPreview },
          formato === 'retrato' && estilos.areaRetrato,
          urlAtual ? estilos.areaPreenchida : null,
        ]}
      >
        {enviando ? (
          <ActivityIndicator color={colors.primary} />
        ) : urlAtual ? (
          <Image source={{ uri: urlAtual }} style={estilos.preview} resizeMode="cover" />
        ) : (
          <View style={estilos.vazio}>
            <Text style={estilos.vazioIcone}>📷</Text>
            <Text style={estilos.vazioTexto}>Toque para enviar</Text>
          </View>
        )}
      </Pressable>

      {urlAtual && !enviando ? (
        <Pressable onPress={escolher} accessibilityRole="button" hitSlop={8}>
          <Text style={estilos.trocar}>Trocar foto</Text>
        </Pressable>
      ) : null}

      {erro ? (
        <Text style={estilos.erro} accessibilityLiveRegion="polite">
          {erro}
        </Text>
      ) : ajuda ? (
        <Text style={estilos.ajuda}>{ajuda}</Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: spacing.xs },
  rotulo: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textMuted },
  obrigatorio: { color: colors.danger },
  area: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMuted,
    overflow: 'hidden',
  },
  areaRetrato: { width: 120, borderRadius: radius.pill },
  areaPreenchida: { borderStyle: 'solid', borderColor: palette.gold400 },
  preview: { width: '100%', height: '100%' },
  vazio: { alignItems: 'center', gap: spacing.xs },
  vazioIcone: { fontSize: 24 },
  vazioTexto: { fontSize: font.size.xs, color: colors.textFaint },
  trocar: { fontSize: font.size.xs, color: colors.secondary, fontWeight: font.weight.semibold },
  erro: { fontSize: font.size.xs, color: colors.danger, fontWeight: font.weight.medium },
  ajuda: { fontSize: font.size.xs, color: colors.textFaint },
});
