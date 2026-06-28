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
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  resendApiKey: string;
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
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
};
