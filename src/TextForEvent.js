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
import { _t } from './languageHandler';
import * as Roles from './Roles';

function textForMemberEvent(ev) {
    // XXX: SYJS-16 "sender is sometimes null for join messages"
    var senderName = ev.sender ? ev.sender.name : ev.getSender();
    var targetName = ev.target ? ev.target.name : ev.getStateKey();
    var ConferenceHandler = CallHandler.getConferenceHandler();
    var reason = ev.getContent().reason ? (
        _t('Reason') + ': ' + ev.getContent().reason
    ) : "";
    switch (ev.getContent().membership) {
        case 'invite':
            var threePidContent = ev.getContent().third_party_invite;
            if (threePidContent) {
                if (threePidContent.display_name) {
                    return _t('%(targetName)s accepted the invitation for %(displayName)s.', {targetName: targetName, displayName: threePidContent.display_name});
                } else {
                    return _t('%(targetName)s accepted an invitation.', {targetName: targetName});
                }
            }
            else {
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return _t('%(senderName)s requested a VoIP conference', {senderName: senderName});
                }
                else {
                    return _t('%(senderName)s invited %(targetName)s.', {senderName: senderName, targetName: targetName});
                }
            }
        case 'ban':
            return _t(
                '%(senderName)s banned %(targetName)s. %(reason)s.',
                {senderName: senderName, targetName: targetName, reason: reason}
            );
        case 'join':
            if (ev.getPrevContent() && ev.getPrevContent().membership == 'join') {
                if (ev.getPrevContent().displayname && ev.getContent().displayname && ev.getPrevContent().displayname != ev.getContent().displayname) {
                    return _t('%(senderName)s changed their display name from %(oldDisplayName)s to %(displayName)s', {senderName: ev.getSender(), oldDisplayName: ev.getPrevContent().displayname, displayName: ev.getContent().displayname});
                } else if (!ev.getPrevContent().displayname && ev.getContent().displayname) {
                    return _t('%(senderName)s set their display name to %(displayName)s', {senderName: ev.getSender(), displayName: ev.getContent().displayname});
                } else if (ev.getPrevContent().displayname && !ev.getContent().displayname) {
                    return _t('%(senderName)s removed their display name (%(oldDisplayName)s)', {senderName: ev.getSender(), oldDisplayName: ev.getPrevContent().displayname});
                } else if (ev.getPrevContent().avatar_url && !ev.getContent().avatar_url) {
                    return _t('%(senderName)s removed their profile picture', {senderName: senderName});
                } else if (ev.getPrevContent().avatar_url && ev.getContent().avatar_url && ev.getPrevContent().avatar_url != ev.getContent().avatar_url) {
                    return _t('%(senderName)s changed their profile picture', {senderName: senderName});
                } else if (!ev.getPrevContent().avatar_url && ev.getContent().avatar_url) {
                    return _t('%(senderName)s set a profile picture', {senderName: senderName});
                } else {
                    // suppress null rejoins
                    return '';
                }
            } else {
                if (!ev.target) console.warn("Join message has no target! -- " + ev.getContent().state_key);
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return _t('VoIP conference started');
                }
                else {
                    return _t('%(targetName)s joined the room.', {targetName: targetName});
                }
            }
        case 'leave':
            if (ev.getSender() === ev.getStateKey()) {
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return _t('VoIP conference finished');
                }
                else if (ev.getPrevContent().membership === "invite") {
                    return _t('%(targetName)s rejected the invitation.', {targetName: targetName});
                }
                else {
                    return _t('%(targetName)s left the room.', {targetName: targetName});
                }
            }
            else if (ev.getPrevContent().membership === "ban") {
                return _t('%(senderName)s unbanned %(targetName)s.', {senderName: senderName, targetName: targetName}) + '.';
            }
            else if (ev.getPrevContent().membership === "join") {
                return _t(
                    '%(senderName)s kicked %(targetName)s. %(reason)s',
                    {senderName: senderName, targetName: targetName, reason}
                );
            }
            else if (ev.getPrevContent().membership === "invite") {
                return _t(
                    '%(senderName)s withdrew %(targetName)s\'s inivitation. %(reason)s',
                    {senderName: senderName, targetName: targetName, reason: reason}
                );
            }
            else {
                return _t('%(targetName)s left the room.', {targetName: targetName});
            }
    }
}

function textForTopicEvent(ev) {
    var senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    return _t('%(senderDisplayName)s changed the topic to "%(topic)s"', {senderDisplayName: senderDisplayName, topic: ev.getContent().topic});
}

function textForRoomNameEvent(ev) {
    var senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();

    return _t('%(senderDisplayName)s changed the room name to %(roomName)s', {senderDisplayName: senderDisplayName, roomName: ev.getContent().name});
}

function textForMessageEvent(ev) {
    var senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    var message = senderDisplayName + ': ' + ev.getContent().body;
    if (ev.getContent().msgtype === "m.emote") {
        message = "* " + senderDisplayName + " " + message;
    } else if (ev.getContent().msgtype === "m.image") {
        message = _t('%(senderDisplayName)s sent an image.', {senderDisplayName: senderDisplayName});
    }
    return message;
}

function textForCallAnswerEvent(event) {
    var senderName = event.sender ? event.sender.name : _t('Someone');
    var supported = MatrixClientPeg.get().supportsVoip() ? "" : _t('(not supported by this browser)');
    return _t('%(senderName)s answered the call', {senderName: senderName}) + '. ' + supported;
}

function textForCallHangupEvent(event) {
    var senderName = event.sender ? event.sender.name : _t('Someone');
    var supported = MatrixClientPeg.get().supportsVoip() ? "" : _t('(not supported by this browser)');
    return _t('%(senderName)s ended the call', {senderName: senderName}) + '. ' + supported;
}

function textForCallInviteEvent(event) {
    var senderName = event.sender ? event.sender.name : _t('Someone');
    // FIXME: Find a better way to determine this from the event?
    var type = "voice";
    if (event.getContent().offer && event.getContent().offer.sdp &&
            event.getContent().offer.sdp.indexOf('m=video') !== -1) {
        type = "video";
    }
    var supported = MatrixClientPeg.get().supportsVoip() ? "" : _t('(not supported by this browser)');
    return _t('%(senderName)s placed a %(callType)s call.', {senderName: senderName, callType: type}) + '. ' + supported;
}

function textForThreePidInviteEvent(event) {
    var senderName = event.sender ? event.sender.name : event.getSender();
    return _t('%(senderName)s sent an invitation to %(targetDisplayName)s to join the room.', {senderName: senderName, targetDisplayName: event.getContent().display_name});
}

function textForHistoryVisibilityEvent(event) {
    var senderName = event.sender ? event.sender.name : event.getSender();
    var vis = event.getContent().history_visibility;
    // XXX: This i18n just isn't going to work for languages with different sentence structure.
    var text = _t('%(senderName)s made future room history visible to', {senderName: senderName}) + ' ';
    if (vis === "invited") {
        text += _t('all room members, from the point they are invited') + '.';
    }
    else if (vis === "joined") {
        text += _t('all room members, from the point they joined') + '.';
    }
    else if (vis === "shared") {
        text += _t('all room members') + '.';
    }
    else if (vis === "world_readable") {
        text += _t('anyone') + '.';
    }
    else {
        text += ' ' + _t('unknown') + ' (' + vis + ')';
    }
    return text;
}

function textForEncryptionEvent(event) {
    var senderName = event.sender ? event.sender.name : event.getSender();
    return _t('%(senderName)s turned on end-to-end encryption (algorithm %(algorithm)s)', {senderName: senderName, algorithm: event.getContent().algorithm});
}

// Currently will only display a change if a user's power level is changed
function textForPowerEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    if (!event.getPrevContent() || !event.getPrevContent().users) {
        return '';
    }
    const userDefault = event.getContent().users_default || 0;
    // Construct set of userIds
    let users = [];
    Object.keys(event.getContent().users).forEach(
        (userId) => {
            if (users.indexOf(userId) === -1) users.push(userId);
        }
    );
    Object.keys(event.getPrevContent().users).forEach(
        (userId) => {
            if (users.indexOf(userId) === -1) users.push(userId);
        }
    );
    let diff = [];
    // XXX: This is also surely broken for i18n
    users.forEach((userId) => {
        // Previous power level
        const from = event.getPrevContent().users[userId];
        // Current power level
        const to = event.getContent().users[userId];
        if (to !== from) {
            diff.push(
            	_t('%(userId)s from %(fromPowerLevel)s to %(toPowerLevel)s', {userId: userId, fromPowerLevel: Roles.textualPowerLevel(from, userDefault), toPowerLevel: Roles.textualPowerLevel(to, userDefault)})
            );
        }
    });
    if (!diff.length) {
        return '';
    }
    return _t('%(senderName)s changed the power level of %(powerLevelDiffText)s', {senderName: senderName, powerLevelDiffText: diff.join(", ")});
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
    'm.room.power_levels': textForPowerEvent,
};

module.exports = {
    textForEvent: function(ev) {
        var hdlr = handlers[ev.getType()];
        if (!hdlr) return "";
        return hdlr(ev);
    }
};
