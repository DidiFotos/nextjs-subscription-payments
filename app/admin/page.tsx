'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface PostItem {
  id: string;
  title: string;
  media_url: string;
  is_vip: boolean;
  is_secret: boolean;
  created_at?: string;
}

export default function AdminPage() {
  const supabase = createClient() as any;

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [title, setTitle] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isVip, setIsVip] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234';

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passInput.trim() === ADMIN_PIN) {
      setIsUnlocked(true);
      setAuthError('');
      loadPosts();
    } else {
      setAuthError('Código de acesso incorreto.');
    }
  };

  const loadPosts = async () => {
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
    if (isUnlocked) {
      loadPosts();
    }
  }, [isUnlocked]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');

    if (!mediaUrl.trim()) {
      setFeedback('Informe a URL da foto ou vídeo.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('posts').insert([
        {
          title: title.trim() || 'Publicação Exclusiva',
          media_url: mediaUrl.trim(),
          is_vip: isVip,
          is_secret: isSecret
        }
      ]);

      if (error) {
        setFeedback(`Erro ao salvar no Supabase: ${error.message}`);
      } else {
        setTitle('');
        setMediaUrl('');
        setIsVip(false);
        setIsSecret(false);
        setFeedback('Publicação salva com sucesso no feed!');
        await loadPosts();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (!error) {
      setPosts((prev) => prev.filter((item) => item.id !== id));
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
            <h1 className="text-lg font-black text-pink-400">⚙️ Painel Admin</h1>
            <Link
              href="/"
              className="text-xs text-neutral-400 hover:text-white underline"
            >
              ← Voltar ao Feed
            </Link>
          </div>
          <p className="text-xs text-neutral-400 mb-4">
            Digite o PIN de administrador para gerenciar o feed e as configurações do app.
          </p>
          <input
            type="password"
            placeholder="PIN do administrador (padrão: 1234)"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white mb-3 focus:outline-none focus:border-pink-500"
          />
          {authError && (
            <p className="text-xs text-red-400 mb-3 font-semibold">{authError}</p>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl text-xs font-bold hover:opacity-90 transition"
          >
            Acessar Painel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-16">
      <header className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base font-black bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              ADMIN DIDIFOTOS
            </span>
            <span className="text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-300 px-2.5 py-0.5 rounded-full">
              Gestão do App
            </span>
          </div>
          <Link
            href="/"
            className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold px-3.5 py-1.5 rounded-full transition"
          >
            ← Ver Feed VIP
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        {/* Status de Configuração */}
        <section className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-5">
          <h2 className="text-sm font-black text-white mb-3">
            🔧 Onde cada parte do app é configurada
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-3.5">
              <p className="font-bold text-pink-400 mb-1">1. Feed, VIP e Fotos Secretas</p>
              <p className="text-neutral-400">
                Nesta tela (`/admin`) e na tabela <code className="text-neutral-200">posts</code> no Supabase.
              </p>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-3.5">
              <p className="font-bold text-green-400 mb-1">2. Cobranças Pix (Asaas)</p>
              <p className="text-neutral-400">
                Variável <code className="text-neutral-200">ASAAS_API_KEY</code> na Vercel e rota <code className="text-neutral-200">/api/create-pix</code>.
              </p>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-3.5">
              <p className="font-bold text-yellow-400 mb-1">3. Tokens e Perfil de Membros</p>
              <p className="text-neutral-400">
                Tabela <code className="text-neutral-200">profiles</code> (colunas <code className="text-neutral-200">role</code> e <code className="text-neutral-200">tokens_balance</code>) no Supabase.
              </p>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-3.5">
              <p className="font-bold text-purple-400 mb-1">4. Login, Contas e Variáveis</p>
              <p className="text-neutral-400">
                Rotas <code className="text-neutral-200">/signin</code> e <code className="text-neutral-200">/account</code> + Environment Variables na Vercel.
              </p>
            </div>
          </div>
        </section>

        {/* Formulário de Nova Publicação */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
          <h2 className="text-base font-black mb-4">➕ Nova Publicação no Feed</h2>
          <form onSubmit={handleCreatePost} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Título / Legenda
              </label>
              <input
                type="text"
                placeholder="Ex: Ensaio exclusivo de hoje"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                URL da Mídia (Imagem ou Vídeo)
              </label>
              <input
                type="url"
                required
                placeholder="https://..."
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>

            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-pink-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVip}
                  onChange={(e) => setIsVip(e.target.checked)}
                  className="rounded accent-pink-500"
                />
                Marcar como Conteúdo VIP
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-yellow-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSecret}
                  onChange={(e) => setIsSecret(e.target.checked)}
                  className="rounded accent-yellow-500"
                />
                Marcar como Foto Secreta (10 Tokens)
              </label>
            </div>

            {feedback && (
              <p className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                {feedback}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl text-xs font-black hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? 'Publicando...' : 'Publicar no Feed'}
            </button>
          </form>
        </section>

        {/* Lista de Publicações */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black">🖼️ Publicações Cadastradas</h2>
            <button
              onClick={loadPosts}
              className="text-xs text-neutral-400 hover:text-white underline"
            >
              Atualizar lista
            </button>
          </div>

          {loadingPosts ? (
            <p className="text-xs text-neutral-400">Carregando...</p>
          ) : posts.length === 0 ? (
            <p className="text-xs text-neutral-400">
              Nenhuma publicação encontrada na tabela <code className="text-neutral-200">posts</code> ainda (enquanto isso, o feed exibe posts de demonstração).
            </p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between gap-3 bg-neutral-950 border border-neutral-800 rounded-2xl p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={post.media_url}
                      alt={post.title}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{post.title}</p>
                      <div className="flex gap-2 mt-1">
                        {post.is_vip && (
                          <span className="text-[10px] font-bold text-pink-400">VIP</span>
                        )}
                        {post.is_secret && (
                          <span className="text-[10px] font-bold text-yellow-400">SECRETA</span>
                        )}
                        {!post.is_vip && !post.is_secret && (
                          <span className="text-[10px] font-bold text-neutral-400">PÚBLICO</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-xs text-red-400 hover:text-red-300 font-bold px-2.5 py-1 rounded-lg bg-red-500/10"
                  >
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
