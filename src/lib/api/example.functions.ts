import { supabase } from "@/integrations/supabase/client";

/**
 * Example function invoking a remote Supabase Edge Function.
 * Usage:
 *   const result = await getGreeting("Ada");
 *   console.log(result.message); // "Hello Ada!"
 */
export async function getGreeting(name: string) {
  const { data, error } = await supabase.functions.invoke("greet", {
    body: { name },
  });
  if (error) {
    throw new Error(error.message || "Failed to invoke edge function");
  }
  return data as { message: string };
}
