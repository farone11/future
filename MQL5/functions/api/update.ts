// functions/api/update.ts
export interface Env {
  FARONE_EA_DATA: KVNamespace;
}

// Biar bisa test dari browser
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    await context.env.FARONE_EA_DATA.put("live", JSON.stringify({
      price: 1234.56,
      symbol: "TEST_DARI_GET", 
      status: "online",
      serverTime: Date.now()
    }));
    return new Response('OK - Data TEST_DARI_GET udah ditulis ke KV. Cek KV sekarang.')
  } catch (err) {
    return new Response('ERROR KV: ' + err.message, { status: 500 })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json();
    console.log('DAPET DATA:', data) // ini bakal nongol di log
    
    await context.env.FARONE_EA_DATA.put("live", JSON.stringify({
      ...data,
      serverTime: Date.now()
    }));

    return new Response(JSON.stringify({ status: "ok", data: data }), {
      headers: { "Content-Type": "application/json" },
    });
    
  } catch (err) {
    console.log('ERROR:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400 
    });
  }
};
