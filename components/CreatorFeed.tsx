'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface Post {
  id: string;
  title: string;
  media_url: string;
  is_vip: boolean;
  is_secret: boolean;
}

interface CreatorFeedProps {
  user: any;
}

export default function CreatorFeed({ user }: CreatorFeedProps) {
  const supabase = createClient() as any;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'free' | 'vip'>('free');
  const [tokensBalance, setTokensBalance] = useState<number>(10);
  const [unlockedPosts, setUnlockedPosts] = useState<string[]>([]);
  const [isTokensModalOpen, setIsTokensModalOpen] = useState(false);
  const [pixModalData, setPixModalData] = useState<{
    title: string;
    price: string;
    encodedImage?: string;
    payload?: string;
    invoiceUrl?: string;
  } | null>(null);
  const [generatingPix, setGeneratingPix] = useState(false);

  useEffect(() => {
    fetchPosts();
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role, tokens_balance')
        .eq('id', user.id)
        .single();

      if (data) {
        if (data.role === 'vip') setRole('vip');
        if (typeof data.tokens_balance === 'number') {
          setTokensBalance(data.tokens_balance);
        }
      }
    } catch {
      // Mantém valores padrão caso a tabela profiles ainda não exista
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        setPosts([
          {
            id: 'demo-1',
            title: 'Ensaio Exclusivo Urbano',
            media_url:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
            is_vip: false,
            is_secret: false
          },
          {
            id: 'demo-2',
            title: 'Bastidores de Hoje',
            media_url:
              'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
            is_vip: false,
            is_secret: false
          },
          {
            id: 'demo-3',
            title: 'Foto Secreta (Desbloqueie com 10 Tokens)',
            media_url:
              'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80',
            is_vip: false,
            is_secret: true
          },
          {
            id: 'demo-4',
            title: 'Conteúdo VIP Exclusivo',
            media_url:
              'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
            is_vip: true,
            is_secret: false
          }
        ]);
      } else {
        setPosts(data as Post[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsaasPayment = async (
    title: string,
    value: number,
    type: 'vip' | 'tokens',
    tokensAmount = 0
  ) => {
    setGeneratingPix(true);
    try {
      const res = await fetch('/api/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          value,
          type,
          tokensAmount,
          userId: user?.id || null,
          userEmail: user?.email || null
        })
      });
      const data = await res.json();
      if (data.encodedImage || data.payload || data.invoiceUrl) {
        setPixModalData({
          title,
          price: `R$ ${value.toFixed(2).replace('.', ',')}`,
          encodedImage: data.encodedImage,
          payload: data.payload,
          invoiceUrl: data.invoiceUrl
        });
      } else {
        alert(data.error || 'Não foi possível gerar a cobrança no Asaas agora.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao conectar com o servidor de pagamentos.');
    } finally {
      setGeneratingPix(false);
    }
  };

  const unlockSecretPost = async (postId: string) => {
    if (tokensBalance < 10) {
      alert('Saldo insuficiente! Recarregue seus tokens para abrir esta mídia.');
      setIsTokensModalOpen(true);
      return;
    }

    const newBalance = tokensBalance - 10;
    setTokensBalance(newBalance);
    setUnlockedPosts((prev) => [...prev, postId]);

    if (user) {
      await supabase
        .from('profiles')
        .update({ tokens_balance: newBalance })
        .eq('id', user.id);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-20">
      <div className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-wider bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              DIDIFOTOS VIP
            </span>
            <Link
              href="/admin"
              className="bg-neutral-900 hover:bg-neutral-800 text-pink-400 border border-pink-500/30 text-[11px] font-bold px-2.5 py-1 rounded-lg transition"
            >
              ⚙️ Admin
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTokensModalOpen(true)}
              className="bg-neutral-900 border border-yellow-500/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-neutral-800 transition"
            >
              <span>🪙</span>
              <span className="text-yellow-400">{tokensBalance}</span>
            </button>

            <button
              onClick={() => handleCreateAsaasPayment('Assinatura VIP Mensal', 49.9, 'vip')}
              disabled={generatingPix}
              className="bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {generatingPix ? 'Gerando...' : role === 'vip' ? '👑 VIP Ativo' : 'Seja VIP'}
            </button>

            {user ? (
              <Link
                href="/account"
                className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-neutral-700 transition"
              >
                👤 Minha Conta
              </Link>
            ) : (
              <Link
                href="/signin"
                className="bg-white text-black hover:bg-neutral-200 text-xs font-bold px-3.5 py-1.5 rounded-full transition"
              >
                Entrar / Membros
              </Link>
            )}
          </div>
        </div>
      </div>

      <section className="max-w-xl mx-auto px-4 py-5 overflow-x-auto flex gap-4 border-b border-neutral-900">
        {['Destaques', 'Ensaios', 'Bastidores', 'Ao Vivo', 'Pedidos'].map((item, idx) => (
          <div key={idx} className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600">
              <div className="w-full h-full rounded-full bg-neutral-950 p-0.5 overflow-hidden">
                <img
                  src={`https://picsum.photos/120/120?random=${idx + 50}`}
                  alt={item}
                  className="w-full h-full object-cover rounded-full group-hover:scale-110 transition duration-300"
                />
              </div>
            </div>
            <span className="text-[11px] mt-1.5 text-neutral-400 font-semibold">{item}</span>
          </div>
        ))}
      </section>

      <main className="max-w-md mx-auto px-4 mt-6 flex flex-col gap-6">
        {loading ? (
          <div className="text-center py-16 text-neutral-500 text-sm">
            Carregando acervo exclusivo...
          </div>
        ) : (
          posts.map((post) => {
            const isUnlocked = unlockedPosts.includes(post.id);
            const isBlockedVip = post.is_vip && role !== 'vip';
            const isBlockedSecret = post.is_secret && !isUnlocked && role !== 'vip';

            return (
              <article
                key={post.id}
                className="bg-neutral-900/90 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl"
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 p-0.5">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                        alt="Avatar"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">Didifotos Official</h3>
                      <p className="text-[10px] text-neutral-400">{post.title || 'Exclusivo'}</p>
                    </div>
                  </div>
                  {post.is_vip && (
                    <span className="bg-pink-500/10 text-pink-400 border border-pink-500/30 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                      VIP
                    </span>
                  )}
                  {post.is_secret && (
                    <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                      SECRETA
                    </span>
                  )}
                </div>

                <div className="relative aspect-[4/5] bg-neutral-950 overflow-hidden">
                  <img
                    src={post.media_url}
                    alt={post.title}
                    className={`w-full h-full object-cover transition duration-500 ${
                      isBlockedVip || isBlockedSecret ? 'blur-2xl scale-110 brightness-50' : ''
                    }`}
                  />

                  {isBlockedVip && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/75 backdrop-blur-md">
                      <div className="w-14 h-14 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center text-2xl mb-3 border border-pink-500/40">
                        🔒
                      </div>
                      <h4 className="text-base font-black mb-1">Conteúdo VIP Exclusivo</h4>
                      <p className="text-xs text-neutral-300 mb-5">
                        Assine o plano completo por R$ 49,90/mês via Pix ou Cartão para liberar tudo.
                      </p>
                      <button
                        onClick={() =>
                          handleCreateAsaasPayment('Assinatura VIP Mensal', 49.9, 'vip')
                        }
                        className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs rounded-xl shadow-lg hover:opacity-90 transition"
                      >
                        Desbloquear Agora (R$ 49,90)
                      </button>
                    </div>
                  )}

                  {isBlockedSecret && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/75 backdrop-blur-md">
                      <div className="w-14 h-14 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-2xl mb-3 border border-yellow-500/40">
                        🪙
                      </div>
                      <h4 className="text-base font-black mb-1">Foto Secreta</h4>
                      <p className="text-xs text-neutral-300 mb-5">
                        Use 10 Tokens do seu saldo para desbloquear esta publicação.
                      </p>
                      <button
                        onClick={() => unlockSecretPost(post.id)}
                        className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-600 text-neutral-950 font-black text-xs rounded-xl shadow-lg hover:opacity-90 transition"
                      >
                        Abrir por 10 Tokens
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-3.5 border-t border-neutral-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1 text-neutral-300 hover:text-pink-500 transition font-medium">
                      ❤️ <span>Curtir</span>
                    </button>
                    <button className="flex items-center gap-1 text-neutral-300 hover:text-purple-400 transition font-medium">
                      💬 <span>Comentar</span>
                    </button>
                  </div>
                  <button
                    onClick={() => setIsTokensModalOpen(true)}
                    className="flex items-center gap-1 text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20 hover:bg-yellow-500/20 transition font-bold"
                  >
                    🎁 <span>Enviar Mimo</span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </main>

      {isTokensModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-yellow-400">🪙 Recarregar Tokens</h3>
              <button
                onClick={() => setIsTokensModalOpen(false)}
                className="text-neutral-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              Use tokens para abrir fotos secretas, enviar mimos ou pedir conteúdos personalizados.
            </p>
            <div className="flex flex-col gap-2.5">
              {[
                { tokens: 20, price: 19.9, label: '20 Tokens — R$ 19,90' },
                { tokens: 50, price: 39.9, label: '50 Tokens — R$ 39,90 (Mais escolhido)' },
                { tokens: 120, price: 79.9, label: '120 Tokens — R$ 79,90' }
              ].map((pack) => (
                <button
                  key={pack.tokens}
                  onClick={() => {
                    setIsTokensModalOpen(false);
                    handleCreateAsaasPayment(
                      `Pacote ${pack.tokens} Tokens`,
                      pack.price,
                      'tokens',
                      pack.tokens
                    );
                  }}
                  className="w-full py-3 px-4 bg-neutral-950 hover:bg-neutral-800 border border-yellow-500/30 rounded-xl text-xs font-bold text-left flex justify-between items-center transition"
                >
                  <span>{pack.label}</span>
                  <span className="text-yellow-400">Comprar →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {pixModalData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl">
            <h3 className="text-base font-black mb-1">{pixModalData.title}</h3>
            <p className="text-lg font-black text-green-400 mb-4">{pixModalData.price}</p>

            {pixModalData.encodedImage && (
              <div className="bg-white p-3 rounded-2xl inline-block mb-4">
                <img
                  src={`data:image/png;base64,${pixModalData.encodedImage}`}
                  alt="QR Code Pix"
                  className="w-44 h-44"
                />
              </div>
            )}

            {pixModalData.payload && (
              <div className="mb-4">
                <p className="text-[11px] text-neutral-400 mb-1">Pix Copia e Cola:</p>
                <input
                  type="text"
                  readOnly
                  value={pixModalData.payload}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2 text-[11px] text-neutral-300 mb-2"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixModalData.payload!);
                    alert('Código Pix copiado!');
                  }}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded-xl transition"
                >
                  Copiar Código Pix
                </button>
              </div>
            )}

            {pixModalData.invoiceUrl && (
              <a
                href={pixModalData.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs rounded-xl mb-3"
              >
                Abrir Link de Pagamento Asaas ↗
              </a>
            )}

            <button
              onClick={() => setPixModalData(null)}
              className="text-xs text-neutral-400 hover:text-white mt-1"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
