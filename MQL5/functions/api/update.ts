// functions/api/update.ts
export interface Env {
  FARONE_EA_DATA: KVNamespace; // Kita pake KV buat simpen data terakhir
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json();
    
    // Simpen data terakhir dari EA ke KV, key = "live"
    await context.env.FARONE_EA_DATA.put("live", JSON.stringify({
      ...data,
      serverTime: Date.now() // Tambah timestamp server
    }));

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
    
  } catch (err) {
    return new Response(JSON.stringify({ error: "invalid json" }), { 
      status: 400 
    });
  }
};
