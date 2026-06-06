// functions/api/live.ts
export interface Env {
  FARONE_EA_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const data = await context.env.FARONE_EA_DATA.get("live");
  
  return new Response(data || JSON.stringify({ status: "offline" }), {
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*" // Biar bisa diakses React
    },
  });
};
