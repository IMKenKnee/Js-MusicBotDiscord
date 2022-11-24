// const config loads config.json file holding bot token
const config = require("./config.json");
const { Client, GuildMember, GatewayIntentBits } = require("discord.js");
const { Player, QueryType } = require("discord-player");
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.MessageContent ] 
});

// prompt terminal if bot successfully launches
client.on("ready", () => {
    console.log("Bot is online!");
});
client.on("error", console.error);
client.on("warn", console.warn);

// Creating new player after bot initialization
const player = new Player(client);

// player.on prints messages to discord chat based on specific events
player.on("trackStart", (queue, track) => {
    queue.metadata.send(`▶ **>>** Now playing: **${track.title}** in channel **${queue.connection.channel.name}**!`);
});
player.on("trackAdd", (queue, track) => {
    queue.metadata.send(`⏺️ **>>** **${track.title}** queued!`);
});
player.on("error", (queue, error) => {
    console.log(`[${queue.guild.name}] Queue Error: ${error.message}`);
});
player.on("connectionError", (queue, error) => {
    console.log(`[${queue.guild.name}] Connection Error: ${error.message}`);
});
player.on("channelEmpty", (queue) => {
    queue.metadata.send("⁉️ **>>** Nobody in channel, leaving channel.");
});
player.on("botDisconnect", (queue) => {
    queue.metadata.send("⁉️ **>>** Removed from channel by moderator, clearing queue!");
});
player.on("queueEnd", (queue) => {
    queue.metadata.send("✅ **>>** Queue finished, leaving channel.");
});

// async to listen for build message -> then submits body request form to discord server to create slash commands
client.on("messageCreate", async (message) => {
    if (message.content === "!build") {
        // body request form for slash commands
        await message.guild.commands.set([
            { name: "play", description: "Plays a song", options: [
            { required: true, name: "query", 
            type: 3, description: "The song you want to search",} ]
            },
            {
                name: "skip", description: "Skip current song"
            },
            {
                name: "stop", description: "Stop the bot"
            },
        ]);

        // commands created
        await message.reply("Slash commands created.");
    }
});

// Stop, skip, and play functions -> errors printed if commands fail
client.on("interactionCreate", async (interaction) => {
    // if user not in a voice channel
    if (!(interaction.member instanceof GuildMember) || !interaction.member.voice.channel) {
        return void interaction.reply({ content: "⁉️ **>>** You are not in a channel, join a channel and try again.", ephemeral: true });
    }
    // Play Command
    if (interaction.commandName === "play") {
        await interaction.deferReply();
        const query = interaction.options.get("query").value;
        const searchResult = await player
            .search(query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO
            })
            .catch(() => {});
        if (!searchResult || !searchResult.tracks.length) return void interaction.followUp({ content: "⁉️ **>>** No results found." });
        const queue = await player.createQueue(interaction.guild, {
            metadata: interaction.channel
        });
        try {
            if (!queue.connection) await queue.connect(interaction.member.voice.channel);
        } catch {
            void player.deleteQueue(interaction.guildId);
            return void interaction.followUp({ content: "⁉️ **>>** Could not join channel." });
        }
        await interaction.followUp({ content: `Loading ${searchResult.playlist ? "playlist" : "track"}...` });
        searchResult.playlist ? queue.addTracks(searchResult.tracks) : queue.addTrack(searchResult.tracks[0]);
        if (!queue.playing) await queue.play();
      //Skip Command  
    } else if (interaction.commandName === "skip") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "⁉️ **>>** No music is playing." });
        const currentTrack = queue.current;
        const success = queue.skip();
        return void interaction.followUp({
            content: success ? `⏭️ >> Skipping **${currentTrack}**.` : "⁉️ **>>** Error skipping song."
        });
      // Stop Command
    } else if (interaction.commandName === "stop") {
        await interaction.deferReply();
        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "⁉️ **>>** No music is playing." });
        queue.destroy();
        return void interaction.followUp({ content: "⏹️ **>>** Music stopped." });
    } else {
        interaction.reply({
            content: "⁉️ **>>** Unknown command, please use a known command.",
            ephemeral: true
        });
    }
});

client.login(config.token);