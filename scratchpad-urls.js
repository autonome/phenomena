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

// get today's file, if it exists
const file = await getFileFromRepo(githubToken, owner, repo, path);

// URLs already saved today
const oldURLs = new Set(
  file.exists ? file.content.split('\n').filter(url => url.length > 0) : []
);

// merge and upload, replacing the old file
const merged = [...new Set([...oldURLs, ...newURLs])];

if (merged.length > oldURLs.size) {
  await addFileToRepo(
    githubToken, owner, repo, path, 'new url(s)', merged.join('\n'), file.sha
  );
}

console.log('done.');
