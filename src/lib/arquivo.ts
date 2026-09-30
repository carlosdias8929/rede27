import * as ImagePicker from 'expo-image-picker';

/**
 * Decodifica base64 sem depender de `atob`, que nao existe no React Native.
 * O Supabase aceita ArrayBuffer no upload, entao esse e o caminho que funciona
 * igual no Android e na web.
 */
export function base64ParaBytes(base64: string): Uint8Array {
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

export type ImagemEscolhida = {
  /** Para mostrar a previa na tela. */
  uri: string;
  bytes: Uint8Array;
  tipo: string;
  extensao: 'jpg' | 'png' | 'webp';
};

/**
 * Abre a galeria (ou a camera) e devolve a imagem pronta para upload.
 * Devolve null se a pessoa cancelar; lanca erro com mensagem em portugues se
 * faltar permissao ou a imagem nao puder ser lida.
 */
export async function escolherImagem({
  origem = 'galeria',
  editar = false,
  aspecto,
  qualidade = 0.7,
}: {
  origem?: 'galeria' | 'camera';
  editar?: boolean;
  aspecto?: [number, number];
  qualidade?: number;
} = {}): Promise<ImagemEscolhida | null> {
  const permissao =
    origem === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permissao.granted) {
    throw new Error(
      origem === 'camera' ? 'Permissao da camera negada.' : 'Permissao de acesso as fotos negada.',
    );
  }

  const opcoes: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: editar,
    aspect: aspecto,
    quality: qualidade,
    base64: true,
  };

  const escolha =
    origem === 'camera'
      ? await ImagePicker.launchCameraAsync(opcoes)
      : await ImagePicker.launchImageLibraryAsync(opcoes);

  if (escolha.canceled || !escolha.assets?.length) return null;

  const imagem = escolha.assets[0];
  if (!imagem.base64) throw new Error('Nao foi possivel ler a imagem escolhida.');

  const tipo = imagem.mimeType ?? 'image/jpeg';
  const extensao = tipo.includes('png') ? 'png' : tipo.includes('webp') ? 'webp' : 'jpg';

  return {
    uri: imagem.uri,
    bytes: base64ParaBytes(imagem.base64),
    tipo: extensao === 'jpg' ? 'image/jpeg' : tipo,
    extensao,
  };
}
