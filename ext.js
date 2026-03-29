const { normalizeManifest } = require('./normalize.js');


const fakeData = [
  {path: "A/Aegon's_wars1.png"},
  {path: "A/A (Test).jpg"},
  {path: "/B/Test.png"},
  {path: "./C/Test.png"}
];

console.log(normalizeManifest(fakeData));
