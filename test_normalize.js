const fs = require('fs');
const code = fs.readFileSync('gallery.js', 'utf8');

const regex = /function normalizeManifest\([\s\S]*?return out;\s*\}/;
const match = code.match(regex);

eval(match[0]);

const fakeData = [
  {path: "A/Aegon's_wars1.png"},
  {path: "A/A (Test).jpg"},
  {path: "/B/Test.png"},
  {path: "./C/Test.png"}
];

console.log(normalizeManifest(fakeData));
