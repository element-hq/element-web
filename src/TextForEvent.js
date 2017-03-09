/*
Copyright 2015, 2016 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var MatrixClientPeg = require("./MatrixClientPeg");
var CallHandler = require("./CallHandler");

function textForMemberEvent(ev) {
    // XXX: SYJS-16 "sender is sometimes null for join messages"
    var senderName = ev.sender ? ev.sender.name : ev.getSender();
    var targetName = ev.target ? ev.target.name : ev.getStateKey();
    var ConferenceHandler = CallHandler.getConferenceHandler();
    var reason = ev.getContent().reason ? (
        " Reason: " + ev.getContent().reason
    ) : "";
    switch (ev.getContent().membership) {
        case 'invite':
            var threePidContent = ev.getContent().third_party_invite;
            if (threePidContent) {
                if (threePidContent.display_name) {
                    return targetName + " accepted the invitation for " +
                        threePidContent.display_name + ".";
                } else {
                    return targetName + " accepted an invitation.";
                }
            }
            else {
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return senderName + " requested a VoIP conference";
                }
                else {
                    return senderName + " invited " + targetName + ".";
                }
            }
        case 'ban':
            return senderName + " banned " + targetName + "." + reason;
        case 'join':
            if (ev.getPrevContent() && ev.getPrevContent().membership == 'join') {
                if (ev.getPrevContent().displayname && ev.getContent().displayname && ev.getPrevContent().displayname != ev.getContent().displayname) {
                    return ev.getSender() + " changed their display name from " +
                        ev.getPrevContent().displayname + " to " +
                        ev.getContent().displayname;
                } else if (!ev.getPrevContent().displayname && ev.getContent().displayname) {
                    return ev.getSender() + " set their display name to " + ev.getContent().displayname;
                } else if (ev.getPrevContent().displayname && !ev.getContent().displayname) {
                    return ev.getSender() + " removed their display name (" + ev.getPrevContent().displayname + ")";
                } else if (ev.getPrevContent().avatar_url && !ev.getContent().avatar_url) {
                    return senderName + " removed their profile picture";
                } else if (ev.getPrevContent().avatar_url && ev.getContent().avatar_url && ev.getPrevContent().avatar_url != ev.getContent().avatar_url) {
                    return senderName + " changed their profile picture";
                } else if (!ev.getPrevContent().avatar_url && ev.getContent().avatar_url) {
                    return senderName + " set a profile picture";
                } else {
                    // hacky hack for https://github.com/vector-im/vector-web/issues/2020
                    return senderName + " rejoined the room.";
                }
            } else {
                if (!ev.target) console.warn("Join message has no target! -- " + ev.getContent().state_key);
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return "VoIP conference started";
                }
                else {
                    return targetName + " joined the room.";
                }
            }
        case 'leave':
            if (ev.getSender() === ev.getStateKey()) {
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return "VoIP conference finished";
                }
                else if (ev.getPrevContent().membership === "invite") {
                    return targetName + " rejected the invitation.";
                }
                else {
                    return targetName + " left the room.";
                }
            }
            else if (ev.getPrevContent().membership === "ban") {
                return senderName + " unbanned " + targetName + ".";
            }
            else if (ev.getPrevContent().membership === "join") {
                return senderName + " kicked " + targetName + "." + reason;
            }
            else if (ev.getPrevContent().membership === "invite") {
                return senderName + " withdrew " + targetName + "'s invitation." + reason;
            }
            else {
                return targetName + " left the room.";
            }
    }
}

function textForTopicEvent(ev) {
    var senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();

    return senderDisplayName + ' changed the topic to "' + ev.getContent().topic + '"';
}

function textForRoomNameEvent(ev) {
    var senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();

    return senderDisplayName + ' changed the room name to "' + ev.getContent().name + '"';
}

function textForMessageEvent(ev) {
    var senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    var message = senderDisplayName + ': ' + ev.getContent().body;
    if (ev.getContent().msgtype === "m.emote") {
        message = "* " + senderDisplayName + " " + message;
    } else if (ev.getContent().msgtype === "m.image") {
        message = senderDisplayName + " sent an image.";
    }
    return message;
}

function textForCallAnswerEvent(event) {
    var senderName = event.sender ? event.sender.name : "Someone";
    var supported = MatrixClientPeg.get().supportsVoip() ? "" : " (not supported by this browser)";
    return senderName + " answered the call." + supported;
}

function textForCallHangupEvent(event) {
    var senderName = event.sender ? event.sender.name : "Someone";
    var supported = MatrixClientPeg.get().supportsVoip() ? "" : " (not supported by this browser)";
    return senderName + " ended the call." + supported;
}

function textForCallInviteEvent(event) {
    var senderName = event.sender ? event.sender.name : "Someone";
    // FIXME: Find a better way to determine this from the event?
    var type = "voice";
    if (event.getContent().offer && event.getContent().offer.sdp &&
            event.getContent().offer.sdp.indexOf('m=video') !== -1) {
        type = "video";
    }
    var supported = MatrixClientPeg.get().supportsVoip() ? "" : " (not supported by this browser)";
    return senderName + " placed a " + type + " call." + supported;
}

function textForThreePidInviteEvent(event) {
    var senderName = event.sender ? event.sender.name : event.getSender();
    return senderName + " sent an invitation to " + event.getContent().display_name +
     " to join the room.";
}

function textForHistoryVisibilityEvent(event) {
    var senderName = event.sender ? event.sender.name : event.getSender();
    var vis = event.getContent().history_visibility;
    var text = senderName + " made future room history visible to ";
    if (vis === "invited") {
        text += "all room members, from the point they are invited.";
    }
    else if (vis === "joined") {
        text += "all room members, from the point they joined.";
    }
    else if (vis === "shared") {
        text += "all room members.";
    }
    else if (vis === "world_readable") {
        text += "anyone.";
    }
    else {
        text += " unknown (" + vis + ")";
    }
    return text;
}

function textForEncryptionEvent(event) {
    var senderName = event.sender ? event.sender.name : event.getSender();
    return senderName + " turned on end-to-end encryption (algorithm " + event.getContent().algorithm + ")";
}

var handlers = {
    'm.room.message': textForMessageEvent,
    'm.room.name':    textForRoomNameEvent,
    'm.room.topic':   textForTopicEvent,
    'm.room.member':  textForMemberEvent,
    'm.call.invite':  textForCallInviteEvent,
    'm.call.answer':  textForCallAnswerEvent,
    'm.call.hangup':  textForCallHangupEvent,
    'm.room.third_party_invite': textForThreePidInviteEvent,
    'm.room.history_visibility': textForHistoryVisibilityEvent,
    'm.room.encryption': textForEncryptionEvent,
};

module.exports = {
    textForEvent: function(ev) {
        var hdlr = handlers[ev.getType()];
        if (!hdlr) return "";
        return hdlr(ev);
    }
};
