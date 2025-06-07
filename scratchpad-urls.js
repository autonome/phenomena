import 'dotenv/config';
import { addFileToRepo, getFileFromRepo } from './github.js';
import clean from './clean.js';
import matchURLs from './matchURLs.js';

const githubToken = process.env.GH_TOKEN;

const owner = 'ua-community';
const repo = 'ua-discord-archive';

// string of today's date in YYYY-MM-DD format
const todayStr = () => {
  const today = new Date();
  const str = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
    .toISOString().split('T')[0];
  return str;
};

const newURLs = [
  'https://two.com',
  'https://three.com',
  'https://four.com',
];

// path for today's link file
const path = `urls/${todayStr()}.txt`;
console.log('path:', path);

// get sha if file for today exists
const file = await getFileFromRepo(githubToken, path);
const sha = file.hasOwnProperty('sha') ? file.sha : null;

// get URLs already saved today
const oldURLs = [];
if (sha) {
  const response = await fetch(file.download_url);
  const txt = await response.text();
  oldURLs.push(...txt.split('\n'));
}

// check if there's a delta or not
const setsAreEqual = (a, b) => a.size === b.size && [...a].every(value => b.has(value));
const uniqueNew = new Set(newURLs);
const uniqueOld = new Set(oldURLs);

// if the new urls are already saved, do nothing
// otherwise merge the new and old urls
// and upload, replacing the old file
if (!setsAreEqual(uniqueNew, uniqueOld)) {
  const uniqueMerged = [...new Set([...uniqueNew, ...uniqueOld])];
  const content = uniqueMerged.join('\n');
  await addFileToRepo(githubToken, path, 'new url(s)', content, sha);
}

console.log('done.');
