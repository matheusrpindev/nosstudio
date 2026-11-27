"use client";

import { createContext } from "react";

/**
 * O que cada slide do carrossel sabe sobre si (fornecido por <BannerCarousel> em volta de cada banner):
 * - `active`: é o banner em tela;
 * - `near`: já pode carregar a imagem (o banner em tela, o próximo e os que já apareceram);
 * - `playing`: o visitante não pausou o carrossel (o vídeo de fundo acompanha o botão de pausa).
 * Fora de um carrossel (prévia do painel, banner único) vale o padrão: tudo ligado.
 */
export type BannerSlideState = { active: boolean; near: boolean; playing: boolean };

export const BannerSlideContext = createContext<BannerSlideState>({ active: true, near: true, playing: true });
