import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecoverPasswordPage() {
  return (
    <>
      <h1 className="text-grafite text-[1.75rem] leading-tight font-extrabold tracking-tight">Esqueceu a senha?</h1>
      <p className="text-cinza mt-2 text-[0.9375rem] leading-relaxed">Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>
      <RecoverForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="link inline-flex items-center gap-1.5">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
