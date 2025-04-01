/* This section of code is used by the install and setup guides, if you modify it make sure you still are hosting a webpage (seen in "show") */

const express = require("express");
const router = express.Router();
const discordBotkit = require("botkit-discord");
const discordBot = require("./bot");

router.get("/guide", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

router.get("/install", function(request, response) {
  response.sendFile(__dirname + "/views/install.html");
});

router.get("/domainname", function(request, response) {
  let domain = process.env.PROJECT_DOMAIN;
  response.status(200).json({
    message: domain
  });
});

router.get("/botinfo", async function(request, response) {
  let authURL;
  let domain = process.env.PROJECT_DOMAIN;

  try {
    authURL =
      "https://discordapp.com/api/oauth2/authorize?client_id=" +
      discordBot.config.client.user.id +
      "&permissions=0&scope=bot";
  } catch (e) {
    console.error(e);
  }

  response.status(200).json({
    url: authURL,
    domain: domain,
  });
});

router.get("/checkinstall", function(request, response) {
  if (!process.env.DISCORD_TOKEN) {
    console.log("no token");
    response.send(500, { error: "notoken" });
  } else {
    console.log("token");

    const testBotConfig = {
      token: process.env.DISCORD_TOKEN
    };

    var customTimeout = 5000;

    response.setTimeout(customTimeout, function() {
      response.send(500, { error: "timeout" });
    });

    const testBot = discordBotkit(testBotConfig);
    console.log(testBot);
    testBot.on("disconnect", event => {
      response.send(500, { error: "apierror" });
    });

    testBot.on("ready", event => {
      response.status(200).json({
        message: "yay"
      });
    });
  }
});
if (process.env.GUIDE) {
  router.get("/", function(request, response) {
    response.sendFile(__dirname + "/views/remix.html");
  });
} else if (!process.env.DISCORD_TOKEN) {
  router.get("/", function(request, response) {
    response.sendFile(__dirname + "/views/install.html");
  });
} else {
  router.get("/", function(request, response) {
    response.sendFile(__dirname + "/views/index.html");
  });
}

module.exports = router;
