import { Injectable } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { loadSupabaseRuntimeConfig } from "@stealth-trails-bank/config/api";

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor() {
    const runtimeConfig = loadSupabaseRuntimeConfig();

    this.client = createClient(
      runtimeConfig.supabaseUrl,
      runtimeConfig.supabaseAnonKey
    );
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
