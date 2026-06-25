export interface PromptTemplate {
  name: string;
  version: string;
  template: string; // template with {{variable}} placeholders
}

export interface RenderOptions {
  variables: Record<string, string>;
  validate?: boolean; // check all variables are filled
}

export interface PromptManager {
  register(prompt: PromptTemplate): void;
  render(name: string, options: RenderOptions): string;
  getVersion(name: string): string;
  listPrompts(): Array<{ name: string; version: string }>;
}

export function createPromptManager(): PromptManager {
  const prompts = new Map<string, PromptTemplate>();

  function register(prompt: PromptTemplate): void {
    prompts.set(prompt.name, prompt);
  }

  function render(name: string, options: RenderOptions): string {
    const prompt = prompts.get(name);
    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    let rendered = prompt.template;
    const { variables, validate } = options;

    rendered = rendered.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      if (trimmedKey in variables) {
        return variables[trimmedKey];
      }
      return match;
    });

    if (validate) {
      const hasUnresolved = /\{\{\s*([^}]+?)\s*\}\}/.test(rendered);
      if (hasUnresolved) {
        throw new Error(`Validation failed: Missing variables for template '${name}'`);
      }
    }

    return rendered;
  }

  function getVersion(name: string): string {
    const prompt = prompts.get(name);
    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }
    return prompt.version;
  }

  function listPrompts(): Array<{ name: string; version: string }> {
    return Array.from(prompts.values()).map((p) => ({
      name: p.name,
      version: p.version,
    }));
  }

  return {
    register,
    render,
    getVersion,
    listPrompts,
  };
}

/**
 * System prompt for the LegalAI RAG assistant.
 * {{sources}} is replaced at runtime with retrieved document chunks.
 */
export const legalAiSystemPrompt = `You are LegalAI, an expert AI legal assistant. You help lawyers and legal professionals analyse documents, review contracts, answer legal questions, and extract key obligations and risks.

You have been provided with relevant excerpts from the user's uploaded legal documents. Use them as your primary source of truth.

<sources>
{{sources}}
</sources>

Guidelines:
1. Ground every answer in the provided sources. Cite the relevant passage when it helps the user.
2. If the sources do not contain enough information to answer confidently, say so clearly — do not fabricate legal conclusions.
3. For contract review tasks, identify risks, obligations, and ambiguous clauses explicitly.
4. Use precise legal language where appropriate, but explain technical terms when the user may need clarity.
5. Never provide a definitive legal opinion that substitutes for qualified legal advice. You are an analytical assistant, not a practising lawyer.

Answer the user's question now:`;
