'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

type AdminTab =
  | 'overview'
  | 'posts'
  | 'members'
  | 'live'
  | 'gifts'
  | 'notifications';

interface DraftAlbumPhoto {
  id: string;
  media_url: string;
  sort_order: number;
  included_in_full_album: boolean;
}

interface PostRecord {
  id: string;
  title: string;
  description?: string;
  media_url: string;
  is_album: boolean;
  album_price: number;
  token_price: number;
  is_vip: boolean;
  is_secret: boolean;
  is_published: boolean;
  created_at?: string;
}

const MENU_ITEMS: { id: AdminTab; label: string; icon: string; desc: string }[] = [
  { id: 'overview', label: 'Estatísticas & Online', icon: '📊', desc: 'Membros online, entradas e métricas' },
  { id: 'posts', label: 'Posts & Álbuns', icon: '🖼️', desc: 'Upload do PC, ordem das fotos e preços' },
  { id: 'members', label: 'Membros & Bloqueio', icon: '👥', desc: 'Controle de acesso, VIP, tokens e bloqueios' },
  { id: 'live', label: 'Transmissão (Live)', icon: '📡', desc: 'Compartilhar live, chat com tokens e presentes' },
  { id: 'gifts', label: 'Presentes & Pix', icon: '🎁', desc: 'Catálogo de presentes e recarga Pix Asaas' },
  { id: 'notifications', label: 'E-mail & Pagamentos', icon: '✉️', desc: 'Avisos por e-mail em compras, mimos e tokens' }
];

export default function AdminPage() {
  const supabase = createClient() as any;

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('posts');

  // Estados de criação de post / álbum
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isAlbum, setIsAlbum] = useState(true);
  const [albumPrice, setAlbumPrice] = useState<string>('29.90');
  const [tokenPrice, setTokenPrice] = useState<string>('10');
  const [isVip, setIsVip] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
  const [isPublished, setIsPublished] = useState(true);

  // Fotos do álbum na sequência escolhida
  const [albumPhotos, setAlbumPhotos] = useState<DraftAlbumPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Lista de posts e edição rápida de valores
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('0');
  const [editTokens, setEditTokens] = useState<string>('0');
  const [editTitle, setEditTitle] = useState<string>('');

  const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234';

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passInput.trim() === ADMIN_PIN) {
      setIsUnlocked(true);
      setAuthError('');
    } else {
      setAuthError('PIN incorreto.');
    }
  };

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        setPosts(data);
      }
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (isUnlocked && activeTab === 'posts') {
      fetchPosts();
    }
  }, [isUnlocked, activeTab]);

  // Upload de uma ou várias fotos do PC para o bucket 'media'
  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setFeedback('');

    try {
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          setFeedback(`Erro no upload (${file.name}): ${uploadError.message}`);
          continue;
        }

        const { data: publicData } = supabase.storage.from('media').getPublicUrl(filePath);
        if (publicData?.publicUrl) {
          uploadedUrls.push(publicData.publicUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        if (!coverUrl) {
          setCoverUrl(uploadedUrls[0]);
        }

        setAlbumPhotos((prev) => {
          const startOrder = prev.length;
          const newItems: DraftAlbumPhoto[] = uploadedUrls.map((url, idx) => ({
            id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            media_url: url,
            sort_order: startOrder + idx,
            included_in_full_album: true
          }));
          return [...prev, ...newItems];
        });

        setFeedback(`${uploadedUrls.length} mídia(s) enviada(s) do PC com sucesso!`);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Mover foto para cima ou para baixo na sequência do álbum
  const movePhoto = (index: number, direction: 'up' | 'down') => {
    setAlbumPhotos((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;

      return copy.map((item, idx) => ({
        ...item,
        sort_order: idx
      }));
    });
  };

  const toggleIncludeInAlbum = (id: string) => {
    setAlbumPhotos((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, included_in_full_album: !item.included_in_full_album } : item
      )
    );
  };

  const removeDraftPhoto = (id: string) => {
    setAlbumPhotos((prev) =>
      prev
        .filter((item) => item.id !== id)
        .map((item, idx) => ({ ...item, sort_order: idx }))
    );
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');

    const mainMedia = coverUrl.trim() || albumPhotos[0]?.media_url || '';
    if (!mainMedia) {
      setFeedback('Envie ao menos uma foto do PC ou informe a URL da mídia.');
      return;
    }

    setSaving(true);
    try {
      const parsedPrice = Math.max(0, parseFloat(albumPrice.replace(',', '.')) || 0);
      const parsedTokens = Math.max(0, parseInt(tokenPrice, 10) || 0);

      const { data: createdPost, error: postError } = await supabase
        .from('posts')
        .insert([
          {
            title: title.trim() || 'Álbum Exclusivo',
            description: description.trim(),
            media_url: mainMedia,
            is_album: isAlbum,
            album_price: parsedPrice,
            token_price: parsedTokens,
            is_vip: isVip,
            is_secret: isSecret,
            is_published: isPublished
          }
        ])
        .select()
        .single();

      if (postError || !createdPost) {
        setFeedback(`Erro ao salvar publicação: ${postError?.message || 'falha desconhecida'}`);
        return;
      }

      if (albumPhotos.length > 0) {
        const itemsPayload = albumPhotos.map((photo, index) => ({
          post_id: createdPost.id,
          media_url: photo.media_url,
          sort_order: index,
          included_in_full_album: photo.included_in_full_album
        }));

        const { error: itemsError } = await supabase.from('album_items').insert(itemsPayload);
        if (itemsError) {
          setFeedback(`Post criado, mas houve erro ao salvar sequência do álbum: ${itemsError.message}`);
        }
      }

      setTitle('');
      setDescription('');
      setCoverUrl('');
      setAlbumPhotos([]);
      setFeedback('Publicação e sequência do álbum salvas com sucesso!');
      await fetchPosts();
    } finally {
      setSaving(false);
    }
  };

  const startEditingPost = (post: PostRecord) => {
    setEditingPostId(post.id);
    setEditTitle(post.title);
    setEditPrice(String(post.album_price ?? 0));
    setEditTokens(String(post.token_price ?? 0));
  };

  const handleUpdatePostValues = async (postId: string) => {
    const parsedPrice = Math.max(0, parseFloat(editPrice.replace(',', '.')) || 0);
    const parsedTokens = Math.max(0, parseInt(editTokens, 10) || 0);

    const { error } = await supabase
      .from('posts')
      .update({
        title: editTitle.trim() || 'Publicação',
        album_price: parsedPrice,
        token_price: parsedTokens
      })
      .eq('id', postId);

    if (!error) {
      setEditingPostId(null);
      setFeedback('Valores e título atualizados!');
      await fetchPosts();
    } else {
      setFeedback(`Erro ao atualizar: ${error.message}`);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
        <form
          onSubmit={handleUnlock}
          className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-black text-pink-400">⚙️ Admin VIP</h1>
            <Link href="/" className="text-xs text-neutral-400 hover:text-white">
              ← Feed
            </Link>
          </div>
          <p className="text-xs text-neutral-400 mb-4">
            Digite seu PIN para abrir o painel de controle.
          </p>
          <input
            type="password"
            placeholder="PIN de acesso"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white mb-3 focus:outline-none focus:border-pink-500"
          />
          {authError && <p className="text-xs text-red-400 mb-3 font-semibold">{authError}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl text-xs font-black hover:opacity-90 transition"
          >
            Entrar no Painel
          </button>
        </form>
      </div>
    );
  }

  const currentItem = MENU_ITEMS.find((m) => m.id === activeTab)!;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row">
      {/* Menu Lateral */}
      <aside className="w-full md:w-64 bg-neutral-950 border-b md:border-b-0 md:border-r border-neutral-800 p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center justify-between md:block mb-5">
            <div>
              <span className="text-base font-black bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                DIDIFOTOS ADMIN
              </span>
              <p className="text-[11px] text-neutral-500">Painel Principal</p>
            </div>
            <Link
              href="/"
              className="text-xs bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-1.5 rounded-xl font-bold text-neutral-200 inline-block md:mt-3"
            >
              ← Ver Feed
            </Link>
          </div>

          <nav className="flex md:flex-col gap-1.5 overflow-x-auto pb-2 md:pb-0">
            {MENU_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition text-left ${
                    active
                      ? 'bg-gradient-to-r from-pink-600/25 to-purple-600/25 text-white border border-pink-500/40'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden md:block text-[11px] text-neutral-500 border-t border-neutral-900 pt-3">
          Next.js • Supabase • Asaas
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 md:p-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-xl font-black">
            {currentItem.icon} {currentItem.label}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">{currentItem.desc}</p>
        </div>

        {activeTab === 'posts' ? (
          <div className="space-y-6">
            <form
              onSubmit={handleSavePost}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4"
            >
              <h2 className="text-base font-black">➕ Criar Post ou Álbum</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">
                    Título do Post / Álbum
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Ensaio Completo Praia"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">
                    Foto de Capa (URL opcional se subir do PC)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  placeholder="Detalhes do ensaio ou prévia..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-green-400 mb-1">
                    Valor do Álbum / Acesso (R$)
                  </label>
                  <input
                    type="text"
                    value={albumPrice}
                    onChange={(e) => setAlbumPrice(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-yellow-400 mb-1">
                    Custo em Tokens (para desbloqueio avulso/secreta)
                  </label>
                  <input
                    type="number"
                    value={tokenPrice}
                    onChange={(e) => setTokenPrice(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Upload do PC */}
              <div className="bg-neutral-950 border border-dashed border-neutral-700 rounded-2xl p-4">
                <label className="block text-xs font-bold text-pink-400 mb-2">
                  💻 Enviar Fotos / Mídias do PC (bucket &ldquo;media&rdquo;)
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFilesUpload}
                  disabled={uploading}
                  className="block w-full text-xs text-neutral-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-pink-600 file:text-white hover:file:bg-pink-500 cursor-pointer"
                />
                {uploading && (
                  <p className="text-xs text-yellow-400 mt-2">Enviando arquivos para o Storage...</p>
                )}
              </div>

              {/* Sequência das Fotos do Álbum */}
              {albumPhotos.length > 0 && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 space-y-2.5">
                  <p className="text-xs font-black text-white">
                    ↕️ Sequência do Álbum ({albumPhotos.length} fotos) — defina ordem e álbum completo
                  </p>
                  {albumPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="flex items-center justify-between gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[11px] font-black text-neutral-400 w-5">
                          #{idx + 1}
                        </span>
                        <img
                          src={photo.media_url}
                          alt={`Foto ${idx + 1}`}
                          className="w-11 h-11 rounded-lg object-cover shrink-0"
                        />
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={photo.included_in_full_album}
                            onChange={() => toggleIncludeInAlbum(photo.id)}
                            className="accent-pink-500"
                          />
                          Álbum completo
                        </label>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => movePhoto(idx, 'up')}
                          disabled={idx === 0}
                          className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-lg"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => movePhoto(idx, 'down')}
                          disabled={idx === albumPhotos.length - 1}
                          className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-lg"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDraftPhoto(photo.id)}
                          className="px-2 py-1 text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 rounded-lg"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Flags de Acesso */}
              <div className="flex flex-wrap gap-4 pt-1 text-xs font-bold">
                <label className="flex items-center gap-2 text-purple-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAlbum}
                    onChange={(e) => setIsAlbum(e.target.checked)}
                    className="accent-purple-500"
                  />
                  É Álbum Completo
                </label>
                <label className="flex items-center gap-2 text-pink-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVip}
                    onChange={(e) => setIsVip(e.target.checked)}
                    className="accent-pink-500"
                  />
                  Conteúdo VIP
                </label>
                <label className="flex items-center gap-2 text-yellow-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSecret}
                    onChange={(e) => setIsSecret(e.target.checked)}
                    className="accent-yellow-500"
                  />
                  Foto Secreta
                </label>
                <label className="flex items-center gap-2 text-green-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="accent-green-500"
                  />
                  Publicado
                </label>
              </div>

              {feedback && (
                <p className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                  {feedback}
                </p>
              )}

              <button
                type="submit"
                disabled={saving || uploading}
                className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl text-xs font-black hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar e Publicar'}
              </button>
            </form>

            {/* Lista de Posts / Álbuns com Edição Rápida de Preços */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-black">🖼️ Publicações & Álbuns Salvos</h2>
                <button
                  onClick={fetchPosts}
                  className="text-xs text-neutral-400 hover:text-white underline"
                >
                  Atualizar
                </button>
              </div>

              {loadingPosts ? (
                <p className="text-xs text-neutral-400">Carregando...</p>
              ) : posts.length === 0 ? (
                <p className="text-xs text-neutral-400">Nenhuma publicação cadastrada ainda.</p>
              ) : (
                posts.map((post) => {
                  const isEditing = editingPostId === post.id;
                  return (
                    <div
                      key={post.id}
                      className="bg-neutral-950 border border-neutral-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={post.media_url}
                          alt={post.title}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs"
                            />
                            <input
                              type="text"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              placeholder="R$"
                              className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs"
                            />
                            <input
                              type="number"
                              value={editTokens}
                              onChange={(e) => setEditTokens(e.target.value)}
                              placeholder="Tokens"
                              className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs"
                            />
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{post.title}</p>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                              R$ {Number(post.album_price || 0).toFixed(2).replace('.', ',')} •{' '}
                              {post.token_price || 0} tokens •{' '}
                              {post.is_album ? 'Álbum' : 'Post simples'}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleUpdatePostValues(post.id)}
                              className="text-xs bg-green-600 hover:bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingPostId(null)}
                              className="text-xs bg-neutral-800 text-neutral-300 font-bold px-2.5 py-1.5 rounded-lg"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditingPost(post)}
                              className="text-xs bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-3 py-1.5 rounded-lg"
                            >
                              Editar Valor
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="text-xs bg-red-500/15 hover:bg-red-500/25 text-red-400 font-bold px-3 py-1.5 rounded-lg"
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 text-xs text-neutral-300">
            Módulo <strong className="text-white">{currentItem.label}</strong> será ativado na
            próxima etapa.
          </div>
        )}
      </main>
    </div>
  );
}
