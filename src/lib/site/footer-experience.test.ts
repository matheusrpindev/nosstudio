import { describe, expect, it } from "vitest";
import { defaultFooterExperienceSettings, FOOTER_CLIPS_MAX, FOOTER_PHOTOS_MAX, footerExperienceMediaIds, resolveFooterExperienceSettings } from "./footer-experience";

describe("rodapé interativo: configurações", () => {
  it("nasce ligado e sem mídia (o site mostra a composição da marca, nunca foto inventada)", () => {
    expect(resolveFooterExperienceSettings(undefined)).toEqual({ enabled: true, photos: [], clips: [] });
    expect(resolveFooterExperienceSettings(null)).toBe(defaultFooterExperienceSettings);
  });

  it("valor corrompido ou acima do limite cai no padrão; ids repetidos saem", () => {
    expect(resolveFooterExperienceSettings({ enabled: "sim" })).toBe(defaultFooterExperienceSettings);
    const tooMany = { enabled: true, photos: Array.from({ length: FOOTER_PHOTOS_MAX + 1 }, (_, i) => ({ mediaId: i + 1 })), clips: [] };
    expect(resolveFooterExperienceSettings(tooMany)).toBe(defaultFooterExperienceSettings);
    const clips = Array.from({ length: FOOTER_CLIPS_MAX }, (_, i) => ({ mediaId: 50 + i, caption: "" }));
    const resolved = resolveFooterExperienceSettings({ enabled: false, photos: [{ mediaId: 3 }, { mediaId: 3 }, { mediaId: 4 }], clips });
    expect(resolved.photos).toEqual([{ mediaId: 3 }, { mediaId: 4 }]);
    expect(resolved.enabled).toBe(false);
    expect(footerExperienceMediaIds(resolved)).toEqual([3, 4, 50, 51, 52, 53]);
  });
});
