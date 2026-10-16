// Drive it: handles to the game's panel, toast and results card.
import { byId } from "../ui/dom";

export const gameUI = {
  root: byId("gameUI"),
  toast: byId("gameToast"),
  speed: byId("gameSpeed"),
  fuelBar: byId("fuelBar"),
  fuelNumber: byId("fuelNum"),
  score: byId("gameScore"),
  toFinish: byId("gameLeft"),
  time: byId("gameTime"),
  best: byId("gameBest"),
  courseNumber: byId("gameCourse"),
  damage: byId("gameDamage"),
};

export const resultsCard = {
  root: byId("gameOver"),
  title: byId("goTitle"),
  score: byId("goScore"),
  time: byId("goTime"),
  busts: byId("goBusts"),
  cans: byId("goCans"),
  best: byId("goBest"),
  newBest: byId("goNew"),
  sameCourse: byId<HTMLButtonElement>("againBtn"),
  newCourse: byId<HTMLButtonElement>("newCourseBtn"),
};
