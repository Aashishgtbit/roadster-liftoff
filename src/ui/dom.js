// Handles to the page's elements, looked up once.

const stage = document.getElementById("stage");
const canvas = document.getElementById("scene");
const msg = document.getElementById("stageMsg");
const hudPhase = document.getElementById("hudPhase"), hudRot = document.getElementById("hudRot"), hudJets = document.getElementById("hudJets"), hudAlt = document.getElementById("hudAlt"), hudSpd = document.getElementById("hudSpd");
const soundBtn = document.getElementById("soundBtn"), stuntBtns = [...document.querySelectorAll("[data-stunt]")], hudFan = document.getElementById("hudFan");
const pauseBtn = document.getElementById("pauseBtn"), replayBtn = document.getElementById("replayBtn"), camBtn = document.getElementById("camBtn"), wingBtn = document.getElementById("wingBtn");
const small = () => stage.clientWidth < 700;

export { camBtn, canvas, hudAlt, hudFan, hudJets, hudPhase, hudRot, hudSpd, msg, pauseBtn, replayBtn, small, soundBtn, stage, stuntBtns, wingBtn };
