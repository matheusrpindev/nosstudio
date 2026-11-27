/**
 * Zod sem compilação dinâmica no NAVEGADOR. O zod 4 testa se pode usar `new Function` (para acelerar a
 * validação) na primeira vez que um `z.object` é criado; sob a Content-Security-Policy (sem `'unsafe-eval'`,
 * ver src/lib/security/csp.ts) esse teste é bloqueado e o navegador registra uma violação, mesmo com o erro
 * engolido. `jitless` pula o teste. No servidor (sem CSP) o zod continua com a validação compilada.
 *
 * Importe como PRIMEIRA linha de todo módulo que cria `z.object` e pode chegar ao navegador (o teste
 * src/lib/zod-setup.test.ts confere).
 */
import { config } from "zod";

if (typeof window !== "undefined") config({ jitless: true });
