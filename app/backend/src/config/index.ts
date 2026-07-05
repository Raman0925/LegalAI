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
  // Razorpay Plan IDs (created in Razorpay dashboard, per plan per billing cycle)
  razorpayPlanStarterMonthly: string;
  razorpayPlanStarterYearly: string;
  razorpayPlanGrowthMonthly: string;
  razorpayPlanGrowthYearly: string;
  razorpayPlanProMonthly: string;
  razorpayPlanProYearly: string;
  resendApiKey: string;
  frontendUrl: string;
  // GST details for invoice generation (India tax compliance)
  gstin: string;
  gstState: string;
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
  razorpayPlanStarterMonthly: process.env.RAZORPAY_PLAN_STARTER_MONTHLY || '',
  razorpayPlanStarterYearly: process.env.RAZORPAY_PLAN_STARTER_YEARLY || '',
  razorpayPlanGrowthMonthly: process.env.RAZORPAY_PLAN_GROWTH_MONTHLY || '',
  razorpayPlanGrowthYearly: process.env.RAZORPAY_PLAN_GROWTH_YEARLY || '',
  razorpayPlanProMonthly: process.env.RAZORPAY_PLAN_PRO_MONTHLY || '',
  razorpayPlanProYearly: process.env.RAZORPAY_PLAN_PRO_YEARLY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  gstin: process.env.YOUR_GSTIN || '',
  gstState: process.env.YOUR_STATE || '',
};
