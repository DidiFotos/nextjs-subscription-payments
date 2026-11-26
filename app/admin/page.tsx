'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

type AdminTab =
  | 'overview'
  | 'posts'
  | 'feed_manager'
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

interface AlbumItemRecord {
  id: string;
  post_id: string;
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
  force_blur?: boolean;
  created_at?: string;
}

const MENU_ITEMS: { id: AdminTab; label: string; icon: string; desc: string }[] = [
  { id: 'overview', label: 'Estatísticas & Online', icon: '📊', desc: 'Membros online, entradas e métricas' },
  { id: 'posts', label: 'Criar Post / Álbum', icon: '➕', desc: 'Upload do PC/celular, sequência e valores' },
  { id: 'feed_manager', label: 'Álbuns & Fotos no Feed', icon: '🗂️', desc: 'Editar posts, blur, álbum completo, preço e excluir' },
  { id: 'members', label: 'Membros & Bloqueio', icon: '👥', desc: 'Controle de acesso, VIP, tokens e bloqueios' },
  { id: 'live', label: 'Transmissão (Live)', icon: '📡', desc: 'Compartilhar live, chat com tokens e presentes' },
  { id: 'gifts', label: 'Presentes & Pix', icon: '🎁', desc: 'Catálogo de presentes e recarga Pix Asaas' },
  { id: 'notifications', label: 'E-mail & Pagamentos', icon: '✉️', desc: 'Avisos por e-mail em compras, mimos e tokens' }
];

const MAX_FILE_SIZE_MB = 25;

export default function AdminPage() {
  const supabase = createClient() as any;

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('posts');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isAlbum, setIsAlbum] = useState(true);
  const [albumPrice, setAlbumPrice] = useState<string>('29.90');
  const [tokenPrice, setTokenPrice] = useState<string>('10');
  const [isVip, setIsVip] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
  const [forceBlur, setForceBlur] = useState(false);
  const [isPublished, setIsPublished] = useState(true);

  const [albumPhotos, setAlbumPhotos] = useState<DraftAlbumPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'albums' | 'vip' | 'secret' | 'blur'>('all');
  const [editingPost, setEditingPost] = useState<PostRecord | null>(null);
  const [editingItems, setEditingItems] = useState<AlbumItemRecord[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

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
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMsg(`Erro ao buscar posts: ${error.message}`);
      } else if (Array.isArray(data)) {
        setPosts(data);
      }
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (isUnlocked && (activeTab === 'feed_manager' || activeTab === 'posts')) {
      fetchPosts();
    }
  }, [isUnlocked, activeTab]);

  const uploadFilesToStorage = async (files: FileList | File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setErrorMsg(`"${file.name}" excede o limite de ${MAX_FILE_SIZE_MB}MB.`);
        continue;
      }

      const rawExt = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const filePath = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${rawExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined
        });

      if (uploadError) {
        setErrorMsg(`Erro no upload (${file.name}): ${uploadError.message}`);
        continue;
      }

      const { data: publicData } = supabase.storage.from('media').getPublicUrl(filePath);
      if (publicData?.publicUrl && publicData.publicUrl.startsWith('http')) {
        uploadedUrls.push(publicData.publicUrl);
      } else {
        setErrorMsg(`URL pública inválida gerada para ${file.name}.`);
      }
    }

    return uploadedUrls;
  };

  const handleCreateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setFeedback('');
    setErrorMsg('');

    try {
      const urls = await uploadFilesToStorage(files);
      if (urls.length > 0) {
        setCoverUrl((prev) => prev || urls[0]);
        setAlbumPhotos((prev) => {
          const startOrder = prev.length;
          const newItems: DraftAlbumPhoto[] = urls.map((url, idx) => ({
            id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            media_url: url,
            sort_order: startOrder + idx,
            included_in_full_album: true
          }));
          return [...prev, ...newItems];
        });
        setFeedback(`${urls.length} arquivo(s) enviado(s) do dispositivo!`);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const moveDraftPhoto = (index: number, direction: 'up' | 'down') => {
    setAlbumPhotos((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((item, idx) => ({ ...item, sort_order: idx }));
    });
  };

  const toggleDraftInclude = (id: string) => {
    setAlbumPhotos((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, included_in_full_album: !item.included_in_full_album } : item
      )
    );
  };

  const removeDraftPhoto = (id: string) => {
    setAlbumPhotos((prev) => {
      const next = prev
        .filter((item) => item.id !== id)
        .map((item, idx) => ({ ...item, sort_order: idx }));
      if (next.length === 0) {
        setCoverUrl('');
      } else if (!next.some((item) => item.media_url === coverUrl)) {
        setCoverUrl(next[0].media_url);
      }
      return next;
    });
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');
    setErrorMsg('');

    const mainMedia = coverUrl.trim() || albumPhotos[0]?.media_url || '';
    if (!mainMedia) {
      setErrorMsg('Selecione ao menos uma foto ou vídeo do PC/celular antes de publicar.');
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
            force_blur: forceBlur,
            is_published: isPublished
          }
        ])
        .select()
        .single();

      if (postError || !createdPost) {
        setErrorMsg(`Erro ao salvar publicação: ${postError?.message || 'falha ao inserir'}`);
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
          setErrorMsg(`Post criado, mas houve erro ao salvar fotos do álbum: ${itemsError.message}`);
        }
      }

      setTitle('');
      setDescription('');
      setCoverUrl('');
      setForceBlur(false);
      setAlbumPhotos([]);
      setFeedback('Publicação salva e enviada com sucesso!');
      await fetchPosts();
    } finally {
      setSaving(false);
    }
  };

  const handleQuickToggleField = async (
    post: PostRecord,
    field: 'force_blur' | 'is_vip' | 'is_secret' | 'is_album' | 'is_published'
  ) => {
    setErrorMsg('');
    const currentVal = Boolean(post[field]);
    const nextVal = !currentVal;

    const { error } = await supabase
      .from('posts')
      .update({ [field]: nextVal })
      .eq('id', post.id);

    if (error) {
      setErrorMsg(`Não foi possível atualizar (${field}): ${error.message}`);
      return;
    }

    setPosts((prev) =>
      prev.map((item) => (item.id === post.id ? { ...item, [field]: nextVal } : item))
    );
    if (editingPost?.id === post.id) {
      setEditingPost((prev) => (prev ? { ...prev, [field]: nextVal } : null));
    }
  };

  const openPostEditor = async (post: PostRecord) => {
    setEditingPost({
      ...post,
      album_price: Number(post.album_price ?? 0),
      token_price: Number(post.token_price ?? 0),
      force_blur: Boolean(post.force_blur)
    });
    setEditingItems([]);
    setLoadingItems(true);
    setFeedback('');
    setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('album_items')
        .select('*')
        .eq('post_id', post.id)
        .order('sort_order', { ascending: true });

      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          setEditingItems(data);
        } else if (post.media_url) {
          setEditingItems([
            {
              id: `single_${post.id}`,
              post_id: post.id,
              media_url: post.media_url,
              sort_order: 0,
              included_in_full_album: true
            }
          ]);
        }
      }
    } finally {
      setLoadingItems(false);
    }
  };

  const handleEditUploadMore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingPost || !e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    setErrorMsg('');
    try {
      const urls = await uploadFilesToStorage(e.target.files);
      if (urls.length > 0) {
        const startOrder = editingItems.length;
        const newItems: AlbumItemRecord[] = urls.map((url, idx) => ({
          id: `temp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          post_id: editingPost.id,
          media_url: url,
          sort_order: startOrder + idx,
          included_in_full_album: true
        }));
        setEditingItems((prev) => [...prev, ...newItems]);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const moveEditingItem = (index: number, direction: 'up' | 'down') => {
    setEditingItems((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((item, idx) => ({ ...item, sort_order: idx }));
    });
  };

  const toggleEditingItemFullAlbum = (itemId: string) => {
    setEditingItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, included_in_full_album: !item.included_in_full_album } : item
      )
    );
  };

  const removeEditingItem = (itemId: string) => {
    setEditingItems((prev) =>
      prev.filter((item) => item.id !== itemId).map((item, idx) => ({ ...item, sort_order: idx }))
    );
  };

  const handleSaveEditedPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;

    setSavingEdit(true);
    setFeedback('');
    setErrorMsg('');

    try {
      const nextCover = editingItems[0]?.media_url || editingPost.media_url;
      const parsedPrice = Math.max(0, Number(editingPost.album_price) || 0);
      const parsedTokens = Math.max(0, Number(editingPost.token_price) || 0);

      const { error: updateErr } = await supabase
        .from('posts')
        .update({
          title: editingPost.title.trim() || 'Publicação',
          description: editingPost.description || '',
          media_url: nextCover,
          is_album: editingPost.is_album,
          album_price: parsedPrice,
          token_price: parsedTokens,
          is_vip: editingPost.is_vip,
          is_secret: editingPost.is_secret,
          force_blur: Boolean(editingPost.force_blur),
          is_published: editingPost.is_published
        })
        .eq('id', editingPost.id);

      if (updateErr) {
        setErrorMsg(`Erro ao salvar alterações: ${updateErr.message}`);
        return;
      }

      if (editingItems.length > 0) {
        await supabase.from('album_items').delete().eq('post_id', editingPost.id);
        const rows = editingItems.map((item, idx) => ({
          post_id: editingPost.id,
          media_url: item.media_url,
          sort_order: idx,
          included_in_full_album: item.included_in_full_album
        }));
        const { error: itemsErr } = await supabase.from('album_items').insert(rows);
        if (itemsErr) {
          setErrorMsg(`Post atualizado, mas erro ao reordenar fotos: ${itemsErr.message}`);
          return;
        }
      }

      setFeedback('Alterações do post/álbum salvas com sucesso!');
      setEditingPost(null);
      await fetchPosts();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    setErrorMsg('');
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (editingPost?.id === postId) {
        setEditingPost(null);
      }
      setFeedback('Publicação apagada do feed.');
    } else {
      setErrorMsg(`Erro ao apagar: ${error.message}`);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (filterMode === 'albums') return Boolean(p.is_album);
    if (filterMode === 'vip') return Boolean(p.is_vip);
    if (filterMode === 'secret') return Boolean(p.is_secret);
    if (filterMode === 'blur') return Boolean(p.force_blur || p.is_vip || p.is_secret);
    return true;
  });

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
                  onClick={() => {
                    setActiveTab(item.id);
                    setFeedback('');
                    setErrorMsg('');
                  }}
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

      <main className="flex-1 p-4 md:p-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-xl font-black">
            {currentItem.icon} {currentItem.label}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">{currentItem.desc}</p>
        </div>

        {feedback && (
          <div className="mb-4 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 rounded-2xl p-3.5">
            {feedback}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5">
            {errorMsg}
          </div>
        )}

        {activeTab === 'posts' && (
          <form
            onSubmit={handleSavePost}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4"
          >
            <h2 className="text-base font-black">Novo Post ou Álbum</h2>

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
                  Descrição / Legenda
                </label>
                <input
                  type="text"
                  placeholder="Detalhes do álbum ou prévia..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-green-400 mb-1">
                  Valor do Álbum Completo (R$)
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
                  Custo em Tokens (desbloqueio / foto secreta)
                </label>
                <input
                  type="number"
                  value={tokenPrice}
                  onChange={(e) => setTokenPrice(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="bg-neutral-950 border border-dashed border-neutral-700 rounded-2xl p-4">
              <label className="block text-xs font-bold text-pink-400 mb-2">
                📱💻 Enviar Fotos / Vídeos do PC ou Celular (até {MAX_FILE_SIZE_MB}MB por arquivo)
              </label>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleCreateUpload}
                disabled={uploading}
                className="block w-full text-xs text-neutral-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-pink-600 file:text-white hover:file:bg-pink-500 cursor-pointer"
              />
              {uploading && (
                <p className="text-xs text-yellow-400 mt-2">Enviando mídia para o Storage...</p>
              )}
            </div>

            {albumPhotos.length > 0 && (
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 space-y-2.5">
                <p className="text-xs font-black text-white">
                  ↕️ Sequência do Álbum ({albumPhotos.length} mídias) — defina ordem, capa e álbum completo
                </p>
                {albumPhotos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[11px] font-black text-neutral-400 w-5">#{idx + 1}</span>
                      <img
                        src={photo.media_url}
                        alt={`Mídia ${idx + 1}`}
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
                        <label className="flex items-center gap-1.5 text-neutral-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={photo.included_in_full_album}
                            onChange={() => toggleDraftInclude(photo.id)}
                            className="accent-pink-500"
                          />
                          Álbum completo
                        </label>
                        <button
                          type="button"
                          onClick={() => setCoverUrl(photo.media_url)}
                          className={`px-2 py-0.5 rounded-md border text-[10px] ${
                            coverUrl === photo.media_url
                              ? 'bg-pink-600/25 border-pink-500 text-pink-300'
                              : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                          }`}
                        >
                          {coverUrl === photo.media_url ? '★ Capa' : 'Definir Capa'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveDraftPhoto(idx, 'up')}
                        disabled={idx === 0}
                        className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-lg"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDraftPhoto(idx, 'down')}
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

            <div className="flex flex-wrap gap-4 pt-1 text-xs font-bold">
              <label className="flex items-center gap-2 text-purple-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAlbum}
                  onChange={(e) => setIsAlbum(e.target.checked)}
                  className="accent-purple-500"
                />
                Álbum Completo
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
              <label className="flex items-center gap-2 text-cyan-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceBlur}
                  onChange={(e) => setForceBlur(e.target.checked)}
                  className="accent-cyan-500"
                />
                Aplicar Blur / Desfoque
              </label>
              <label className="flex items-center gap-2 text-green-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="accent-green-500"
                />
                Publicado no Feed
              </label>
            </div>

            <button
              type="submit"
              disabled={saving || uploading}
              className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl text-xs font-black hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Publicar no Feed'}
            </button>
          </form>
        )}

        {activeTab === 'feed_manager' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'albums', label: 'Álbuns' },
                  { id: 'vip', label: 'VIP' },
                  { id: 'secret', label: 'Secretas' },
                  { id: 'blur', label: 'Com Blur' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterMode(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      filterMode === f.id
                        ? 'bg-pink-600 text-white'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                onClick={fetchPosts}
                className="text-xs text-neutral-300 hover:text-white bg-neutral-950 border border-neutral-800 px-3 py-1.5 rounded-xl font-bold"
              >
                ↻ Atualizar
              </button>
            </div>

            {editingPost && (
              <form
                onSubmit={handleSaveEditedPost}
                className="bg-neutral-900 border-2 border-pink-500/40 rounded-3xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black text-pink-400">
                    ✏️ Editando: {editingPost.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingPost(null)}
                    className="text-xs text-neutral-400 hover:text-white font-bold"
                  >
                    Fechar editor ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1">Título</label>
                    <input
                      type="text"
                      value={editingPost.title}
                      onChange={(e) =>
                        setEditingPost((prev) => (prev ? { ...prev, title: e.target.value } : null))
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1">
                      Descrição
                    </label>
                    <input
                      type="text"
                      value={editingPost.description || ''}
                      onChange={(e) =>
                        setEditingPost((prev) =>
                          prev ? { ...prev, description: e.target.value } : null
                        )
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-green-400 mb-1">
                      Valor do Álbum (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingPost.album_price}
                      onChange={(e) =>
                        setEditingPost((prev) =>
                          prev ? { ...prev, album_price: Number(e.target.value) } : null
                        )
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-yellow-400 mb-1">
                      Custo em Tokens
                    </label>
                    <input
                      type="number"
                      value={editingPost.token_price}
                      onChange={(e) =>
                        setEditingPost((prev) =>
                          prev ? { ...prev, token_price: Number(e.target.value) } : null
                        )
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs font-bold">
                  <label className="flex items-center gap-1.5 text-cyan-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingPost.force_blur)}
                      onChange={(e) =>
                        setEditingPost((prev) =>
                          prev ? { ...prev, force_blur: e.target.checked } : null
                        )
                      }
                      className="accent-cyan-500"
                    />
                    Deixar com Blur
                  </label>
                  <label className="flex items-center gap-1.5 text-purple-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPost.is_album}
                      onChange={(e) =>
                        setEditingPost((prev) =>
                          prev ? { ...prev, is_album: e.target.checked } : null
                        )
                      }
                      className="accent-purple-500"
                    />
                    Álbum Completo
                  </label>
                  <label className="flex items-center gap-1.5 text-pink-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPost.is_vip}
                      onChange={(e) =>
                        setEditingPost((prev) =>
                          prev ? { ...prev, is_vip: e.target.checked } : null
                        )
                      }
                      className="accent-pink-500"
                    />
                    VIP
                  </label>
                  <label className="flex items-center gap-1.5 text-yellow-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPost.is_secret}
                      onChange={(e) =>
                        setEditingPost((prev) =>
                          prev ? { ...prev, is_secret: e.target.checked } : null
                        )
                      }
                      className="accent-yellow-500"
                    />
                    Foto Secreta
                  </label>
                  <label className="flex items-center gap-1.5 text-green-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPost.is_published}
                      onChange={(e) =>
                        setEditingPost((prev) =>
                          prev ? { ...prev, is_published: e.target.checked } : null
                        )
                      }
                      className="accent-green-500"
                    />
                    Publicado
                  </label>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-white">
                      Fotos do Álbum ({editingItems.length})
                    </span>
                    <label className="text-xs bg-pink-600 hover:bg-pink-500 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer">
                      + Adicionar do PC/Celular
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handleEditUploadMore}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {loadingItems ? (
                    <p className="text-xs text-neutral-400">Carregando fotos do álbum...</p>
                  ) : (
                    editingItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-[11px] font-black text-neutral-400 w-5">
                            #{idx + 1}
                          </span>
                          <img
                            src={item.media_url}
                            alt={`Item ${idx + 1}`}
                            className="w-11 h-11 rounded-lg object-cover"
                          />
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.included_in_full_album}
                              onChange={() => toggleEditingItemFullAlbum(item.id)}
                              className="accent-pink-500"
                            />
                            No Álbum Completo
                          </label>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveEditingItem(idx, 'up')}
                            disabled={idx === 0}
                            className="px-2 py-1 text-xs bg-neutral-800 disabled:opacity-30 rounded-lg"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveEditingItem(idx, 'down')}
                            disabled={idx === editingItems.length - 1}
                            className="px-2 py-1 text-xs bg-neutral-800 disabled:opacity-30 rounded-lg"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEditingItem(item.id)}
                            className="px-2 py-1 text-xs bg-red-500/15 text-red-400 rounded-lg"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPost(null)}
                    className="px-4 py-2.5 bg-neutral-800 rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit || uploading}
                    className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl text-xs font-black disabled:opacity-50"
                  >
                    {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            )}

            {loadingPosts ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-xs text-neutral-400">
                Carregando publicações do feed...
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-xs text-neutral-400">
                Nenhuma publicação encontrada nesse filtro.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredPosts.map((post) => {
                  const hasBlur = Boolean(post.force_blur || post.is_vip || post.is_secret);
                  return (
                    <div
                      key={post.id}
                      className="bg-neutral-900 border border-neutral-800 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img
                          src={post.media_url}
                          alt={post.title}
                          className={`w-16 h-16 rounded-2xl object-cover shrink-0 transition ${
                            hasBlur ? 'blur-sm brightness-75' : ''
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white truncate">{post.title}</p>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            R$ {Number(post.album_price || 0).toFixed(2).replace('.', ',')} •{' '}
                            {post.token_price || 0} tokens
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {post.is_album && (
                              <span className="text-[10px] font-bold bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-full">
                                ÁLBUM
                              </span>
                            )}
                            {post.is_vip && (
                              <span className="text-[10px] font-bold bg-pink-500/15 text-pink-300 px-2 py-0.5 rounded-full">
                                VIP
                              </span>
                            )}
                            {post.is_secret && (
                              <span className="text-[10px] font-bold bg-yellow-500/15 text-yellow-300 px-2 py-0.5 rounded-full">
                                SECRETA
                              </span>
                            )}
                            {post.force_blur && (
                              <span className="text-[10px] font-bold bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded-full">
                                BLUR ATIVO
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                post.is_published
                                  ? 'bg-green-500/15 text-green-300'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}
                            >
                              {post.is_published ? 'PUBLICADO' : 'OCULTO'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuickToggleField(post, 'force_blur')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                            post.force_blur
                              ? 'bg-cyan-600/25 border-cyan-500 text-cyan-200'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                          }`}
                        >
                          {post.force_blur ? 'Blur: Ligado' : 'Deixar Blur'}
                        </button>

                        <button
                          type="button"
                          onClick={() => openPostEditor(post)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white transition"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/15 hover:bg-red-500/25 text-red-400 transition"
                        >
                          Apagar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab !== 'posts' && activeTab !== 'feed_manager' && (
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 text-xs text-neutral-300">
            Módulo <strong className="text-white">{currentItem.label}</strong> pronto para entrar na
            próxima etapa.
          </div>
        )}
      </main>
    </div>
  );
}
