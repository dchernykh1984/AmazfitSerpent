// A stand-in for the watch's local storage, with a switch for the watch that has
// none: `breakStorage` makes every call throw, which is what the page has to
// survive without losing a game.
let values = {};
let broken = false;

export function seed(initial) {
  values = Object.assign({}, initial);
}

export function stored() {
  return Object.assign({}, values);
}

export function breakStorage() {
  broken = true;
}

export class LocalStorage {
  constructor() {
    if (broken) {
      throw new Error("no storage on this device");
    }
  }

  getItem(key) {
    return values[key];
  }

  setItem(key, value) {
    values[key] = value;
  }
}
