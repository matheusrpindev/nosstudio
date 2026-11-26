"use client";

import { useEffect, useRef } from "react";
import { initialActionState } from "@/lib/action-state";
import { ensureCalendarsAction } from "../actions";

/**
 * Agendas pessoais nascem sob demanda: quando a página percebe que alguma conta do painel ainda não tem a sua,
 * este componente pede a criação (uma vez) — páginas não gravam nada ao renderizar.
 */
export function EnsureCalendars() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void ensureCalendarsAction(initialActionState, new FormData());
  }, []);
  return null;
}
