// The device language, as the Zepp OS integer code. 2 is English.
let language = 2;

export function setLanguage(code) {
  language = code;
}

export function getLanguage() {
  return language;
}
