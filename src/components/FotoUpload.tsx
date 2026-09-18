import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { colors, font, palette, radius, spacing } from '../theme';

const BUCKET = 'motoristas';

/**
 * Decodifica base64 sem depender de `atob`, que nao existe no React Native.
 * O Supabase aceita ArrayBuffer no upload, entao esse e o caminho que funciona
 * igual no Android e na web.
 */
function base64ParaBytes(base64: string): Uint8Array {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const limpo = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array((limpo.length * 3) / 4);

  let posicao = 0;
  for (let i = 0; i < limpo.length; i += 4) {
    const c0 = alfabeto.indexOf(limpo[i]);
    const c1 = alfabeto.indexOf(limpo[i + 1]);
    const c2 = alfabeto.indexOf(limpo[i + 2]);
    const c3 = alfabeto.indexOf(limpo[i + 3]);

    bytes[posicao++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0) bytes[posicao++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 >= 0) bytes[posicao++] = ((c2 & 3) << 6) | c3;
  }

  return bytes.subarray(0, posicao);
}

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

    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      setErro('Permissao de acesso as fotos negada.');
      return;
    }

    const escolha = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: formato === 'retrato' ? [1, 1] : [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (escolha.canceled || !escolha.assets?.length) return;

    const imagem = escolha.assets[0];
    if (!imagem.base64) {
      setErro('Nao foi possivel ler a imagem escolhida.');
      return;
    }

    setEnviando(true);
    try {
      const tipo = imagem.mimeType ?? 'image/jpeg';
      const extensao = tipo.includes('png') ? 'png' : tipo.includes('webp') ? 'webp' : 'jpg';
      // A pasta precisa ser o id do motorista: a policy do storage confere isso.
      const caminho = `${motoristaId}/${nomeArquivo}.${extensao}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, base64ParaBytes(imagem.base64), {
          contentType: tipo,
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
