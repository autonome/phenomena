let domainName;
let authUrl;
let addBotLink;
const domainNameTitle = document.getElementsByClassName("domain-name-title");
const addBotCopy = document.getElementById("add-bot-link");

const oauthUrl = document.getElementById("oauth-url");
const oauthUrlGo = document.getElementById("oauth-url-go");

const noClientFound = document.getElementById("no-client-found");
noClientFound.style.display = "none";

const clientFound = document.getElementById("client-found");
clientFound.style.display = "none";


const readmeFileLink = document.getElementById("readme-file-link");



function getDomain() {
  console.log("test");
  return fetch("/botinfo/")
    .then(res => res.json())
    .then(resJson => {
      if (resJson.error) {
        console.log(resJson.error);
      } else {
        domainName = resJson.domain;
        authUrl = resJson.url;

        console.log("domain name " + domainName);
        readmeFileLink.href = "https://glitch.com/edit/#!/" + domainName + "?path=readme.md:2:0";


        [...domainNameTitle].forEach(function(element) {
          element.innerHTML = domainName;
        });

        console.log(resJson);
        if (authUrl) {
          oauthUrl.value = authUrl;
          oauthUrlGo.href = authUrl;
          clientFound.style.display = "block";
        } else {
          noClientFound.style.display = "block";
        }

      }
      return Promise.resolve();
    });
}

getDomain();


function clipboard(element) {
  let copyText = document.getElementById(element);
  copyText.select();
  document.execCommand("Copy");
}
