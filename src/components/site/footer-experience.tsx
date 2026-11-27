/**
 * Rodapé interativo — "Antes de ir, deixe sua marca." (briefing v2, seção 11). Fica logo acima do rodapé
 * institucional, em todas as páginas do site (é montado pelo <SiteShell>), e é o DONO desse espaço: o contador de
 * visitas entra aqui dentro. Com a experiência desligada (Editar site › Rodapé), o espaço volta a ser só a faixa do
 * contador — e, com o contador também desligado, nada é renderizado.
 *
 * - SIMULAÇÃO: nada usa a câmera nem o microfone do visitante (nada de getUserMedia) e nada é gravado ou enviado.
 * - Tudo o que se vê nasce aqui, no servidor (página estática, sem salto de layout). O código interativo
 *   (footer-experience-engine.ts) só é baixado quando a seção chega perto da tela — ver <FooterExperienceLoader>.
 * - Fotos e trechos: SÓ os cadastrados no painel (`getFooterExperience`). Sem eles, a foto instantânea e a tela do
 *   celular mostram composições gráficas da marca — nunca uma foto inventada.
 * - Textos: `content.footerExperience` (Editar site › Textos › Rodapé interativo). Os rótulos dos botões
 *   ("Tirar foto", "Gravar", "Ligar som") são de interface.
 */
import { getFooterExperience, getSiteContent } from "@/server/site/queries";
import { BrandComposition, CameraArt, PhoneIdleScreen } from "./footer-experience-art";
import { FooterExperienceLoader } from "./footer-experience-loader";
import { Accented } from "./layout";
import { stripAccent } from "./text";
import { loadVisitCounter, VisitCounterBand, VisitCounterView } from "./visit-counter";
import "./footer-experience.css";

export async function FooterExperience() {
  const [content, experience, counter] = await Promise.all([getSiteContent(), getFooterExperience(), loadVisitCounter()]);
  if (!experience) return counter ? <VisitCounterBand counter={counter} /> : null;

  const text = content.footerExperience;
  const frameText = text.frameText.trim();
  const title = text.title.trim();

  return (
    <section
      className="s-fx"
      id="rodape-interativo"
      data-tone="paper"
      data-menu-inert
      {...(title ? { "aria-labelledby": "fx-titulo" } : { "aria-label": "Câmera e celular interativos" })}
    >
      <FooterExperienceLoader className="s-wrap s-fx__grid" data={{ photos: experience.photos, clips: experience.clips, frameText }}>
        <div className="s-fx__intro">
          {title ? (
            <h2 id="fx-titulo" className="s-h2 s-fx__title">
              <Accented text={title} fallback="tail" />
            </h2>
          ) : null}
          {text.subtitle ? <p className="s-lead s-fx__subtitle">{text.subtitle}</p> : null}
          <button type="button" className="s-fx__sound" data-fx-action="sound">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="s-fx__sound-icon">
              <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
              <path className="s-fx__sound-waves" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path className="s-fx__sound-off" d="M15.5 9.5l5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span data-fx-sound-label>Ligar som</span>
          </button>
        </div>

        <div className="s-fx__stage">
          <span className="s-fx__flash" aria-hidden="true" />

          <div className="s-fx__device s-fx__device--camera">
            <div className="s-fx__camera-box">
              <button type="button" className="s-fx__camera" data-fx-action="shoot" aria-describedby={text.cameraCaption ? "fx-camera-legenda" : undefined}>
                <CameraArt />
                <span className="s-fx__chip s-fx__chip--camera">
                  <span className="s-fx__chip-dot" aria-hidden="true" />
                  Tirar foto
                </span>
              </button>
              {/* fotos reveladas: o motor clona o modelo (oculto) a cada clique */}
              <div className="s-fx__tray" data-fx-tray>
                <figure className="s-fx__print" data-fx-print-template hidden>
                  <div className="s-fx__print-photo">
                    <BrandComposition />
                    <span className="s-fx__print-veil" aria-hidden="true" />
                  </div>
                  {frameText ? <figcaption className="s-fx__print-caption">{stripAccent(frameText)}</figcaption> : null}
                </figure>
              </div>
            </div>
            {text.cameraCaption ? (
              <p className="s-fx__caption" id="fx-camera-legenda">
                {text.cameraCaption}
              </p>
            ) : null}
          </div>

          <div className="s-fx__device s-fx__device--phone">
            <div className="s-fx__phone">
              <div className="s-fx__screen">
                <PhoneIdleScreen frameText={frameText} />
                <div className="s-fx__screen-clips" data-fx-clips aria-hidden="true" />
                <span className="s-frame s-fx__screen-frame" aria-hidden="true" />
                <div className="s-fx__hud" aria-hidden="true">
                  <span className="s-fx__rec">REC</span>
                  <span className="s-fx__timer" data-fx-timer>
                    00:00
                  </span>
                  <span className="s-fx__take" data-fx-take>
                    Take 01
                  </span>
                </div>
                <p className="s-fx__clip-caption" data-fx-clip-caption aria-hidden="true" />
                <button type="button" className="s-fx__record" data-fx-action="record" aria-describedby={text.phoneCaption ? "fx-celular-legenda" : undefined}>
                  <span className="s-fx__record-ring" aria-hidden="true">
                    <span className="s-fx__record-core" />
                  </span>
                  <span className="s-fx__record-label" data-fx-record-label>
                    Gravar
                  </span>
                </button>
                <span className="s-fx__island" aria-hidden="true" />
              </div>
            </div>
            {text.phoneCaption ? (
              <p className="s-fx__caption" id="fx-celular-legenda">
                {text.phoneCaption}
              </p>
            ) : null}
          </div>
        </div>

        <div className="s-fx__aside">
          {text.simulationNote ? <p className="s-fx__note">{text.simulationNote}</p> : null}
          {counter ? (
            <div className="s-fx__counter" id="contador-de-visitas" data-tone="grafite">
              <VisitCounterView counter={counter} className="s-fx__counter-row" />
            </div>
          ) : null}
          {/* anúncios para leitores de tela ("Foto revelada…", "Gravando…") */}
          <p className="sr-only" aria-live="polite" data-fx-status />
        </div>
      </FooterExperienceLoader>
    </section>
  );
}
