const checkInstallButton = document.getElementById("checkInstallButton");
checkInstallButton.addEventListener("click", checkInstall);

const refreshPageButton = document.getElementById("refreshPageButton");
refreshPageButton.addEventListener("click", refreshPage);

const connectedSection = document.getElementById("connectedSection");
connectedSection.style.display = "none";

const errorSection = document.getElementById("errorSection");
errorSection.style.display = "none";

const apiErrorSection = document.getElementById("apiErrorSection");
apiErrorSection.style.display = "none";

const timedOut = document.getElementById("timedOut");
timedOut.style.display = "none";


const envFileLinkDiscord = document.getElementById("envFileLinkDiscord");


const projectURL = document.getElementById("project_url");

let domainName = "";



function checkInstall() {
  return fetch("/checkinstall/")
    .then(res => res.json())
    .then(resJson => {
      if (resJson.error) {
        console.log(resJson.error);
        if (resJson.error == "notoken") {
          errorSection.style.display = "block";
        }

        if (resJson.error == "apierror") {
          apiErrorSection.style.display = "block";
        }

        if (resJson.error == "timeout") {
          timedOut.style.display = "block";
        }
      } else {
        connectedSection.style.display = "block";
      }
      return Promise.resolve();
    });
}

function refreshPage() {
  location.reload();
}

function getDomain() {  return fetch("/domainname/")
    .then(res => res.json())
    .then(resJson => {
      if (resJson.error) {
        console.log(resJson.error);
      } else {
        console.log(resJson.message);
        domainName = resJson.message;
        console.log("domain name " + domainName);
        if (domainName == "starter-botkit-discord") {
          console.log("starter botkit")
        }
        projectURL.innerHTML = "https://" + domainName + ".glitch.me";

        envFileLinkDiscord.href = "https://glitch.com/edit/#!/" + domainName + "?path=.env:9";
      }
      return Promise.resolve();
    });
}

getDomain();

