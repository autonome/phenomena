const discordBotkit = require("botkit-discord");

const configuration = {
  token: process.env.DISCORD_TOKEN
};

const discordBot = discordBotkit(configuration);
var normalizedPath = require("path").join(__dirname, "skills");

require("fs")
  .readdirSync(normalizedPath)
  .forEach(function(file) {
    require("./skills/" + file)(discordBot);
  });

module.exports = discordBot;
