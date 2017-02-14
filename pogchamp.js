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

let yt = new youtube();

yt.setKey('AIzaSyBqDoSJstUftFYevR9gR_34bAFMaI6YUUI');

let nicknames = new Map
([
    ["532092405",   "David"],
    ["722210172",   "Patrick"],
    ["1677897853",  "Kassian"],
    ["1384616951",  "Pete"],
    ["1337032824",  "Tom"],
    ["1187113581",  "Wesley"],
]);

let ids = new Map
([
    ["David",   "532092405"],
    ["Patrick", "722210172"],
    ["Kassian", "1677897853"],
    ["Pete",    "1384616951"],
    ["Tom",     "1337032824"],
    ["Wesley",  "1187113581"],
]);

let commandHistory = new Map();

let superuser = "1384616951";

let sudoers = ["532092405"];

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


let account = JSON.parse(fs.readFileSync('account.json', {encoding:'utf8', flag:'a+'}));

login({email: account.email, password: account.password}, loginCallback);

var htv_sock = net.Socket();
var skip_votes = new Map();
var votelock = false;
var online_status = new Map();


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
        parseCommand(api, event);
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
    else
        var cmds = event.body.split(";");

    console.log(cmds.length);

    for(var i = 0; i < cmds.length; i++) {
            if(i > 10)
                return;

            var str = cmds[i].trim().split(" ");
            console.log(str);

            if(str[0].trim().charAt(0) == "%") {
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
    } else if(command == "lock" && testGroup(api, event, sudoers)) {
        votelock = true;
    } else if(command == "unlock" && testGroup(api, event, sudoers)) {
        votelock = false;
    } else if(command == "restart" && testGroup(api, event, sudoers)) {
        process.exit(0);
    } else if(command == "frink" || command == "frinkiac" || command == "fr") {
        frinkOut(api, event, args.join(" "), false);
    } else if(command == "frinkqueue") {
        frinkOut(api, event, args.join(" "), true);
    } else if(command == "spin") {
        console.log(emoji.random({count: 1})[0].name);
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
        yt.search(args.join(" "), 1, function(err, res) {
            if(err) {
                sendReply(err.message);
                console.log(err.message);
            } else if(res.items[0] && res.items[0].id && res.items[0].id.videoId) {
                let message = "https://www.youtube.com/watch?v=" + res.items[0].id.videoId;
                api.sendMessage({body: message, url: message}, event.threadID, defaultError2);
            } else {
                sendReply("Nuh-uuuh");
            }
        });
    } else if(command == "man") {
         sendReply(api, event, 
            ["[requestshow|rs] showname: Request a show",
             "[]:",
             "[]:"]);
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


function voteSkipHTV(api, event, id, verbose) {
    if(votelock) {
        sendReply(api, event, "Locked!");
        return;
    }

    if(verbose)
            sendHTVCommand(api, event, {"command":"skip"}, noReply);
    else 
            sendHTVCommand(api, event, {"command":"skip"}, function(data) {return "";});


    /*
    //If they voted, they must be online.
    if(!online_status.has(id) || !online_status.get(id))
        online_status.set(id, true);

    var count = countOnline();
    var votes = skip_votes.size;

    ///Check to see if this user has already voted to skip. 
    //If they have, just recount the votes (online status may have changed).
    if(skip_votes.has(id)) {
        sendReply(api, event, "Recounting...");
    } else {
        skip_votes.set(id, true);
        votes = skip_votes.size;
//        sendReply(api, event, "Voted to skip! (" + votes + "/" + count + ")");
    }

    if(votes >= Math.floor(count/2)) {
        sendHTVCommand(api, event, {"command":"skip"}, noReply);
        skip_votes = new Map();
    }
    */
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

