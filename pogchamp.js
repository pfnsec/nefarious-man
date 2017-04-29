/* vim: set shiftwidth=4 tabstop=4 expandtab : */

'use strict';

let login = require("facebook-chat-api");
let fs = require('fs');
let youtube = require('youtube-node');
let request = require('request');
let https = require('https');
let net = require('net');
let emoji = require('random-emoji');
let frinkiac = require('frinkiac');
let pg = require('pg');


let nicknames = new Map
([
    ["532092405",   "David"],
    ["722210172",   "Patrick"],
    ["1677897853",  "Kassian"],
    ["1384616951",  "Pete"],
    ["1337032824",  "Tom"],
    ["1187113581",  "Wesley"],
    ["100011414462173",  "H. Man"],
]);

let ids = new Map
([
    ["david", "532092405"],
    ["pat",   "722210172"],
    ["kass",  "1677897853"],
    ["pete",  "1384616951"],
    ["tom",   "1337032824"],
    ["wes",   "1187113581"],
    ["hm",    "100011414462173"],
]);

let superuser = "1384616951";

let sudoers = ["532092405"];



//Configuration 



let commandHistory = new Map();

let account = JSON.parse(fs.readFileSync('account.json', {encoding:'utf8', flag:'a+'}));

let config = JSON.parse(fs.readFileSync('config.json', {encoding:'utf8', flag:'a+'}));

let yt = new youtube();

yt.setKey(account.yt_key);
yt.addParam('type', 'video');

var secret_bang = config.secret_bang;

let banlist = JSON.parse(fs.readFileSync('banlist.json', {encoding:'utf8', flag:'a+'}));

login({email: account.email, password: account.password}, loginCallback);

var htv_sock = net.Socket();
var skip_votes = new Map();
var votelock = false;
var online_status = new Map();

var dbConfig = JSON.parse(fs.readFileSync('pg-config.json'), {encoding:'utf8', flag:'r+'});
var dbPool = new pg.Pool(dbConfig);

dbPool.on('error', function(err, client) {
    console.error('error: ', err);
});


// Helper Functions


function defaultError(err)
{
    if (err)
        console.error(err);
}

function defaultError2(err, ignored)
{
    if (err)
        console.error(err);
}


//Callbacks


function loginCallback(err, api)
{
    if (err)
        return console.error(err);

    api.setOptions({logLevel: "error"});
    api.setOptions({selfListen: false});
    api.setOptions({listenEvents: true});
//    api.setOptions({updatePresence: true});
    api.setOptions({forceLogin: true});
    
    api.listen((err, event) => { listenCallback(err, event, api); });
}

function listenCallback(err, event, api)
{
    if (err)
        return console.error(err);

    console.log(event.type);

    if (event.type == "message") {
        if(!parseCommand(api, event))  {
          //  if(event.userID == ids["pat"]) {
                logChatQuote(event);
          //  }
        }
        /*
         * Removed to prevent nuclear bot war
        if(!parseCommand(api, event))
            if(Math.floor(Math.random() * 20) == 0)
                frinkOut(api, event, event.body);
         */
    } else if (event.type == "presence") {
        console.log(event.userID + " " + event.status);

        if(event.statuses.status == "active"){
            online_status.set(event.senderID, true);
        } else {
            online_status.set(event.senderID, false);
        }
    } else {
    }
}



function parseCommand(api, event)
{
    try {

    var gotCmd = false;

    if(event.body == "`")
        var cmds = commandHistory[event.senderID];
    else if(event.body == ".")
        var cmds = ["%vsc"];
    else
        var cmds = event.body.split(";");

    console.log(cmds.length);

    for(var i = 0; i < cmds.length; i++) {
            if(i > 4)
                return;

            var str = cmds[i].trim().split(" ");
            console.log(str);

            var bang = str[0].trim().charAt(0);

            if(bang == "%" || bang == secret_bang) {
                if(banlist[event.senderID] && event.senderID != superuser){
                    sendReply(api, event, "Banned");
                    return false;
                }

                dispatchCommand(api, event, str[0].slice(1), str.slice(1));
                gotCmd = true;
                commandHistory[event.senderID] = cmds;
            }
    }

    } catch(err) {
        console.log(err.message);
    }
    return gotCmd;
}

function dispatchCommand(api, event, command, args)
{
    console.log(command + "(" + args + ")");

    if(command == "wrlog") {
    } else if(command == "ban" && testGroup(api, event, sudoers)) {
        var victim_id = ids.get(args[0]);
        banlist[victim_id] = true;
        fs.writeFileSync('banlist.json', JSON.stringify(banlist, null, 4), {encoding:'utf-8', flag:'w'});
    } else if(command == "unban" && testGroup(api, event, sudoers)) {
        var victim_id = ids.get(args[0]);
        banlist[victim_id] = false;
        fs.writeFileSync('banlist.json', JSON.stringify(banlist, null, 4), {encoding:'utf-8', flag:'w'});
    } else if(command == "lock" && testGroup(api, event, sudoers)) {
        votelock = true;
    } else if(command == "unlock" && testGroup(api, event, sudoers)) {
        votelock = false;
    } else if(command == "restart" && testGroup(api, event, sudoers)) {
        process.exit(0);
    } else if(command == "restream" && testGroup(api, event, sudoers)) {
        sendHTVCommand(api, event, {"command":"restart"}, noReply);
    } else if(command == "toggleshuffle" && testGroup(api, event, sudoers)) {
        sendHTVCommand(api, event, {"command":"toggleShuffle", "tvShow":args[0]}, noReply);
    } else if(command == "frink" || command == "frinkiac" || command == "fr") {
        frinkOut(api, event, args.join(" "), false);
    } else if(command == "frinkqueue") {
        frinkOut(api, event, args.join(" "), true);
    } else if(command == "morbo" || command == "morbotron" || command == "mo") {
        morbOut(api, event, args.join(" "), false);
    } else if(command == "spin") {
        api.changeThreadEmoji(emoji.random({count: 1})[0].character, event.threadID, defaultError);
    } else if(command == "voteskip" || command == "vs") {
        voteSkipHTV(api, event, event.senderID, false);
    } else if(command == "vsc") {
        voteSkipHTV(api, event, event.senderID, true);
    } else if(command == "nextshow" || command == "ns") {
        nextShowHTV(api, event, args[0]);
    } else if(command == "pickepisode" || command == "pe") {
        pickEpisodeHTV(api, event, args[0]);
    } else if(command == "currentepisode" || command == "ce") {
        currentEpisodeHTV(api, event);
    } else if(command == "showlist" || command == "sl") {
        showListHTV(api, event);
    } else if(command == "requestshow"|| command == "rs") {
        requestShowHTV(api, event, args.join(" "));
    } else if(command == "yt") {
        ytSearch(api, event, args.join(" "), true);
    } else if(command == "yte") {
        ytSearch(api, event, args.join(" "), false);
    } else if(command == "rebang" && testGroup(api, event, sudoers)) {
        if(args[0])
            config.secret_bang = args[0][0];
        fs.writeFileSync('config.json', JSON.stringify(config, null, 4), {encoding:'utf-8', flag:'w'});
        secret_bang = args[0][0];
    } else if(command == "man") {
         sendReply(api, event, 
            ["[requestshow|rs] showname: Request a show",
             "[]:",
             "[]:"]);
    } else if(command == "grep" ) {
        doChatQuote(api, event, args.join(" "));
    } else if(command == "chatstats") {
//       chatHistorySize(api, event);
    }
}

function countOnline() {
    var count = 0;
    online_status.forEach((key, value) => {
        if(value === true)
            count++;
    });
/*
    for (id in online_status) {
        if (!online_status.hasOwnProperty(id) || !online_status.get(id)) {
                continue;
        }
        
        count = count + 1;
    }*/

    console.log(count + " people are currently online.");
    return count;
}

//let quotelist = JSON.parse(fs.readFileSync('quotes.json', {encoding:'utf8', flag:'a+'}));

function noReply(data) {
    if(data === "True") {
//        return quotelist[Math.floor(Math.random() * quotelist.length)];
        return "";
    }

    return data;
}

function passReply(data) {
    return data;
}

function okReply(data) {
    if(data === "True") {
//        return quotelist[Math.floor(Math.random() * quotelist.length)];
    }

    return data;
}

function ytSearch(api, event, search, fallback) {
        yt.search(search, 1, function(err, res) {
            console.log(res);
            console.log(res.items.id);
            if(err) {
                console.log(err.message);
                if(fallback)
                    sendReply(api, event, "/yte " + search);
                else
                    sendReply(api, event, err.message);
            } else if(res.items[0] && res.items[0].id && res.items[0].id.videoId) {
                let message = "https://www.youtube.com/watch?v=" + res.items[0].id.videoId;
                api.sendMessage({body: message, url: message}, event.threadID, defaultError2);
            } else {
                sendReply(api, event, "Nuh-uuuh");
            }
        });
}

function voteSkipHTV(api, event, id, verbose) {
    if(votelock) {
        sendReply(api, event, "Locked!");
        return;
    }

    if(verbose)
            sendHTVCommand(api, event, {"command":"skip"}, noReply);
    else 
            sendHTVCommand(api, event, {"command":"skip"}, function(data) {return "";});
}

function nextShowHTV(api, event, tvShow) {
    sendHTVCommand(api, event, {"command":"nextShow", "tvShow":tvShow}, okReply);
}

function pickEpisodeHTV(api, event, episode) {
    sendHTVCommand(api, event, {"command":"pickEpisode", "tvShow":episode}, okReply);
}

function showListHTV(api, event) {
    var showList = [];
    sendHTVCommand(api, event, {"command":"idList"}, passReply);

    /* For reference - parsing fields from a json response
    sendHTVCommand(api, event, {"command":"idList"}, function(data) {
        JSON.parse(data.toString('utf8'), (key, value) => {
            if(key != "name" && key != "path")
                showList.push(key);
        });

        return showList.join(", ");
    });
    */
}

var cmdTimeouts = new Map(
    [
    ]);

function testTimeout(api, event, command) {
}


function testGroup(api, event, group) {
    if(event.senderID === superuser || group.includes(event.senderID)) {
        return true;
    } else {
        console.log(nicknames);
        console.log(event.UserID);
        sendReply(api, event, nicknames.get(event.senderID) + " is not in the sudoers file. This incident will be reported.");
        return false;
    }
}

function currentEpisodeHTV(api, event) {
    sendHTVCommand(api, event, {"command":"currentEpisode"}, okReply);
}

function requestShowHTV(api, event, tvShow) {
    sendHTVCommand(api, event, {"command":"request", "tvShow":tvShow}, okReply);
}

function sendHTVCommand(api, event, command, parseReply) {
    var resp = "";
    var done = false;
    htv_sock = net.connect(5005, account.htv_url, function() {
        console.log(JSON.stringify(command));
        htv_sock.write(JSON.stringify(command));
    }).on("data", function(data) {
        console.log("Data : " + data.toString('ascii')  + ", " + data.length + " \n");
        resp += data;
        if(resp.length % 1400) {
            sendReply(api, event, parseReply(resp));
            htv_sock.end();
            htv_sock.destroy();
            done = true;
        }
    }).on("error", function(error) {
        console.log(error);
        sendReply(api, event, "Couldn't send HTV command: " + error.message);
        htv_sock.end();
        htv_sock.destroy();
        done = true;
    }).on("close", function() {
        htv_sock.end();
        htv_sock.destroy();
        done = true;
    }).on("end", function() {
        htv_sock.end();
        htv_sock.destroy();
        done = true;
    });

     
}

function frinkOut(api, event, message, playEpisode){
    var SEARCH_URL = 'https://frinkiac.com/api/search?%s';
    var MEME_URL = 'https://frinkiac.com/meme/%s/%s?%s';
    var CAPTION_URL = 'https://frinkiac.com/api/caption?%s';
    frinkiac.setURL("frinkiac");

    frinkiac.search(message)
    .then(function(res) {
        if (res.status !== 200) {
            throw res;
        } else {
            return res.data;
        }
    })
    .catch(function(err) {
        throw err;
    })
    .then(function(data) {
            let frinkURLRegexp = /https\:\/\/frinkiac\.com\/meme\/(.+)\/(.+)\?/i;
            var memes = data.map(frinkiac.memeMap, frinkiac);
            var memeURL = "";
        //    var memeURL = memes[Math.floor(Math.random() * memes.length)];
            console.log("Retrieved " + memes.length + "memes.");

            if(memes.length == 0) {
                sendReply(api, event, "D'oh!");
            }

            var n = 0;
            while(memeURL == "") {
                if(Math.random() < 0.60) {
                    memeURL = memes[n];
                    console.log("Selected meme " + n + ".");
                }
                if(n >= memes.length)
                    n = 0;
                n++;
            }
            var caption = frinkiac.captionURL(frinkURLRegexp.exec(memeURL)[1], frinkURLRegexp.exec(memeURL)[2]);
            var captionData = "";
            var captionParse = [];
            var captionText = "";
            var episode = "";
            
            https.get(caption, (res) => {
                    
                    res.setEncoding('utf-8');
                    res.on('data', (d) => {
                            captionData += d;
                    });
                    
                    res.on('end', function() {
                        captionParse = JSON.parse(captionData);
                        captionText = captionParse.Subtitles.map(function(s){return s.Content;}).join("\n");
                        if(playEpisode) {
                            nextShowHTV(api, event, "simpsons:" + captionParse.Episode.Season + ":" + captionParse.Episode.EpisodeNumber);
                        }
                        console.log(captionParse);
                        api.sendMessage({body: captionText, url: memeURL}, event.threadID);
                    });
            });
    });
}




function morbOut(api, event, message, playEpisode){

    var SEARCH_URL = 'https://morbotron.com/api/search?%s';
    var MEME_URL = 'https://morbotron.com/meme/%s/%s?%s';
    var CAPTION_URL = 'https://morbotron.com/api/caption?%s';

    frinkiac.setURL("morbotron");

    frinkiac.search(message)
    .then(function(res) {
        if (res.status !== 200) {
            throw res;
        } else {
            return res.data;
        }
    })
    .catch(function(err) {
        throw err;
    })
    .then(function(data) {
            let frinkURLRegexp = /https\:\/\/morbotron\.com\/meme\/(.+)\/(.+)\?/i;
            var memes = data.map(frinkiac.memeMap, frinkiac);
            var memeURL = "";
        //    var memeURL = memes[Math.floor(Math.random() * memes.length)];
            console.log("Retrieved " + memes.length + "memes.");

            if(memes.length == 0) {
                sendReply(api, event, "Bite my shiny metal ass");
            }

            var n = 0;
            while(memeURL == "") {
                if(Math.random() < 0.60) {
                    memeURL = memes[n];
                    console.log("Selected meme " + n + ".");
                    console.log(memeURL);
                }
                if(n >= memes.length)
                    n = 0;
                n++;
            }
            var caption = frinkiac.captionURL(frinkURLRegexp.exec(memeURL)[1], frinkURLRegexp.exec(memeURL)[2]);
            var captionData = "";
            var captionParse = [];
            var captionText = "";
            var episode = "";

            console.log(caption);
            
            https.get(caption, (res) => {
                    
                    res.setEncoding('utf-8');
                    res.on('data', (d) => {
                            captionData += d;
                    });
                    
                    res.on('end', function() {
                        captionParse = JSON.parse(captionData);
                        captionText = captionParse.Subtitles.map(function(s){return s.Content;}).join("\n");
                        console.log(captionParse);

                        if(playEpisode) {
                            nextShowHTV(api, event, "simpsons:" + captionParse.Episode.Season + ":" + captionParse.Episode.EpisodeNumber);
                        }

                        console.log(captionParse);
                        api.sendMessage({body: captionText, url: memeURL}, event.threadID);
                    });
            });
    });
}



function quoteMessage(api, event, message) 
{

}


function sendReply(api, event, message) 
{
    let msg = {body: message};
    if(message != "")
        api.sendMessage(msg, event.threadID);
}

function chatHistorySize(api, event) 
{
    api.getThreadHistory(event.threadID, 0, 1024, 0, function (err, history) {
        if(err)
            return console.error(err);
        else
            sendReply(api, event, `chatstat: This chat contains ${history.length} messages.`);
    });
}


function logChatQuote(event) {

    console.log(event);

    dbPool.connect(function(err, client, done) {

        if(err) {
            console.error('error fetching client from pool', err);
        }

        client.query("INSERT INTO messages VALUES ( $1, $2, $3, $4);", 
            [event.senderID,
             event.threadID,  
             event.timestamp,
             event.body], 
            function(err, result) {
                done(err);

                if(err) {
                    console.error('error inserting into db', err);
                }

                console.log(result);
        });
    });


}

function doChatQuote(api, event, query) {
    dbPool.connect(function(err, client, done) {
        var response = "D'oh!";

        if(err) {
            console.error('error fetching client from pool', err);
            sendReply(api, event, "No database! " + err);
        }

        var resultCallback = function(err, result) {
            done(err);


            if(err ) {
                console.error('error searching db', err);
                sendReply(api, event, "D'oh!" + err);
                return;
            } else if(typeof(result) == 'undefined' || result.rowCount != 1) {
                sendReply(api, event, "D'oh!");
                return;
            }

            console.log(result);
            sendReply(api, event, "<" + nicknames.get(result.rows[0].sender_id) + "> " + result.rows[0].body); 
        }

        client.query("SELECT * FROM messages WHERE thread_id = $1 AND body LIKE $2 ORDER BY random() LIMIT 1",
            [event.threadID,
             "%" + query + "%"],
            resultCallback);

    });
}
