import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  port: number;
  host: string;
  jwtSecret: string;
  databaseUrl: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  openaiApiKey: string;
  cohereApiKey: string;
  anthropicApiKey: string;
}

export const config: Config = {
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST || 'localhost',
  jwtSecret: process.env.JWT_SECRET || '',
  databaseUrl: process.env.DATABASE_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  cohereApiKey: process.env.COHERE_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
};
