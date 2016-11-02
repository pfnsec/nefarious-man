/* vim: set tabstop=4 expandtab : */

'use strict';

let login = require("facebook-chat-api");
let fs = require('fs');
let request = require('request');
let net = require('net');

let nicknames = new Map
([
    ["532092405",   "David"],
    ["722210172",   "Patrick"],
    ["1677897853",  "Kassian"],
    ["1384616951",  "Pete"],
    ["1337032824",  "Tom"],
    ["1187113581",  "Wesley"],
]);


let superuser = 1384616951;

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
var online_status = new Map();


function loginCallback(err, api)
{
    if (err)
        return console.error(err);

    api.setOptions({logLevel: "error"});
    api.setOptions({selfListen: false});
    api.setOptions({listenEvents: true});
//  api.setOptions({updatePresence: true});
    api.setOptions({forceLogin: true});
    
    api.listen((err, event) => { listenCallback(err, event, api); });
}

function listenCallback(err, event, api)
{
    if (err)
        return console.error(err);

    if (event.type == "message") {
//        if(event.senderID == superuser) {
            parseCommand(api, event);
//        }
        
    } else if (event.type == "presence") {
        console.log(event.userID + " " + event.statuses);

        if(event.statuses.status == "active"){
            online_status.set(event.userID, true);
        } else {
            online_status.set(event.userID, false);
        }
    } else {
    }
}

function parseCommand(api, event)
{
    try {

    let str = event.body.split(" ");

    if(str[0].charAt(0) == "%") {
        return dispatchCommand(api, event, str[0].slice(1), str.slice(1));
    }

    } catch(err) {
        console.log(err.message);
    }
}

function dispatchCommand(api, event, command, args)
{
    console.log(command + "(" + args + ")");
    if(command == "wrlog") {
    } else if(command == "quote") {
//        sendReply(event, api, quotelist[Math.floor(Math.random() * quotelist.length)]);
    } else if(command == "voteskip") {
        voteSkipHTV(api, event, event.senderID);
    } else if(command == "nextshow") {
        nextShowHTV(api, event, args[0]);
    } else if(command == "currentepisode") {
        currentEpisodeHTV(api, event);
    } else if(command == "showlist") {
        showListHTV(api, event);
    } else if(command == "requestshow") {
        requestShowHTV(api, event, args.join(" "));
    } else if(command == "chatstats") {
//       chatHistorySize(api, event);
    }
}

function countOnline() {
    var count = 0;
    for (id in online_status) {
        if (!online_status.hasOwnProperty(id) || !online_status.get(id)) {
                continue;
        }
        
        count = count + 1;
    }

    console.log(count + " people are currently online.");
    return count;
}

function noReply(data) {
    return "";
}

//let quotelist = JSON.parse(fs.readFileSync('quotes.json', {encoding:'utf8', flag:'a+'}));

function okReply(data) {
    if(data === "True") {
//        return quotelist[Math.floor(Math.random() * quotelist.length)];
    }

    return data;
}

function voteSkipHTV(api, event, id) {
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
        sendReply(api, event, "Voted to skip! (" + votes + "/" + count + ")");
    }

    if(votes >= Math.floor(count/2)) {
        sendHTVCommand(api, event, {"command":"skip"}, noReply);
        skip_votes = new Map();
    }
}

function nextShowHTV(api, event, tvShow) {
    sendHTVCommand(api, event, {"command":"nextShow", "tvShow":tvShow}, okReply);
}

function showListHTV(api, event) {
    var showList = [];
    sendHTVCommand(api, event, {"command":"idList"}, function(data) {
        JSON.parse(data.toString('utf8'), (key, value) => {
            if(key != "name" && key != "path")
                showList.push(key);
        });

        return showList.join(", ");
    });
}

function currentEpisodeHTV(api, event) {
    sendHTVCommand(api, event, {"command":"currentEpisode"}, okReply);
}

function requestShowHTV(api, event, tvShow) {
    sendHTVCommand(api, event, {"command":"request", "tvShow":tvShow}, okReply);
}

function sendHTVCommand(api, event, command, parseReply) {
    htv_sock = net.connect(5005, account.htv_url, function() {
        console.log(JSON.stringify(command));
        htv_sock.write(JSON.stringify(command));
    }).on("data", function(data) {
        console.log("Data : " + data.toString('ascii')  + " \n");
        sendReply(api, event, parseReply(data));
    }).on("error", function(error) {
        console.log(error);
        sendReply(api, event, "Couldn't send HTV command: " + error.message);
        htv_sock.end();
        htv_sock.destroy();
    }).on("close", function() {
        htv_sock.end();
        htv_sock.destroy();
    }).on("end", function() {
        htv_sock.end();
        htv_sock.destroy();
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

