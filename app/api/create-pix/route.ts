import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { title, value, type, tokensAmount, userId, userEmail } = await req.json();

    const apiKey = process.env.ASAAS_API_KEY;
    const isSandbox = process.env.ASAAS_ENV === 'sandbox';
    const baseUrl = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY não configurada nas variáveis de ambiente da Vercel.' },
        { status: 500 }
      );
    }

    const numericValue = Number(value);
    if (!numericValue || numericValue <= 0) {
      return NextResponse.json({ error: 'Valor da cobrança inválido.' }, { status: 400 });
    }

    // 1. Busca ou cria cliente no Asaas
    const emailToUse = userEmail || 'cliente@didifotos.vip';
    let customerId: string | null = null;

    const searchRes = await fetch(
      `${baseUrl}/customers?email=${encodeURIComponent(emailToUse)}`,
      {
        headers: { access_token: apiKey }
      }
    );
    const searchData = await searchRes.json();

    if (searchData?.data?.length > 0) {
      customerId = searchData.data[0].id;
    } else {
      const createCustomerRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: apiKey
        },
        body: JSON.stringify({
          name: emailToUse.split('@')[0] || 'Membro VIP',
          email: emailToUse,
          cpfCnpj: '24971563792'
        })
      });
      const createdCustomer = await createCustomerRes.json();
      if (!createCustomerRes.ok || !createdCustomer.id) {
        return NextResponse.json(
          { error: createdCustomer?.errors?.[0]?.description || 'Erro ao criar cliente no Asaas.' },
          { status: 400 }
        );
      }
      customerId = createdCustomer.id;
    }

    // 2. Cria cobrança Pix no Asaas (vencimento para amanhã)
    const dueDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: apiKey
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: numericValue,
        dueDate,
        description: title || 'Assinatura / Tokens DidiFotos VIP',
        externalReference: JSON.stringify({
          userId: userId || null,
          type: type || 'vip',
          tokensAmount: tokensAmount || 0
        })
      })
    });

    const paymentData = await paymentRes.json();
    if (!paymentRes.ok || !paymentData.id) {
      return NextResponse.json(
        { error: paymentData?.errors?.[0]?.description || 'Erro ao gerar cobrança Pix no Asaas.' },
        { status: 400 }
      );
    }

    // 3. Busca QR Code e código Pix Copia e Cola
    const qrRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
      headers: { access_token: apiKey }
    });
    const qrData = await qrRes.json();

    return NextResponse.json({
      paymentId: paymentData.id,
      encodedImage: qrData?.encodedImage || null,
      payload: qrData?.payload || null,
      invoiceUrl: paymentData?.invoiceUrl || null
    });
  } catch (error) {
    console.error('Erro na rota /api/create-pix:', error);
    return NextResponse.json(
      { error: 'Falha interna ao comunicar com o servidor de pagamento.' },
      { status: 500 }
    );
  }
}
