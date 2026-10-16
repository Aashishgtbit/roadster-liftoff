// Handles to the page's elements, looked up once.

/** The element with this id; throws if the page does not have it, so a renamed id fails loudly. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} is missing from the page`);
  return element as T;
}

/** Set the text of a button's label (the span after its icon). */
export function setLabel(button: HTMLElement, text: string) {
  if (button.lastElementChild) button.lastElementChild.textContent = text;
}

export const stage = byId("stage");
export const canvas = byId<HTMLCanvasElement>("scene");
export const stageMessage = byId("stageMsg");

export const hud = {
  phase: byId("hudPhase"),
  height: byId("hudAlt"),
  speed: byId("hudSpd"),
  rotation: byId("hudRot"),
  jets: byId("hudJets"),
  suction: byId("hudFan"),
};

export const buttons = {
  sound: byId<HTMLButtonElement>("soundBtn"),
  pause: byId<HTMLButtonElement>("pauseBtn"),
  replay: byId<HTMLButtonElement>("replayBtn"),
  freeLook: byId<HTMLButtonElement>("camBtn"),
  wing: byId<HTMLButtonElement>("wingBtn"),
  fullScreen: byId<HTMLButtonElement>("fsBtn"),
  exitFullScreen: byId<HTMLButtonElement>("fsFloat"),
};

export const stuntTabs = [...document.querySelectorAll<HTMLButtonElement>("[data-stunt]")];

export const isSmallScreen = () => stage.clientWidth < 700;
