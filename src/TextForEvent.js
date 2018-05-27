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
import MatrixClientPeg from './MatrixClientPeg';
import CallHandler from './CallHandler';
import { _t } from './languageHandler';
import * as Roles from './Roles';

function textForMemberEvent(ev) {
    // XXX: SYJS-16 "sender is sometimes null for join messages"
    const senderName = ev.sender ? ev.sender.name : ev.getSender();
    const targetName = ev.target ? ev.target.name : ev.getStateKey();
    const prevContent = ev.getPrevContent();
    const content = ev.getContent();

    const ConferenceHandler = CallHandler.getConferenceHandler();
    const reason = content.reason ? (_t('Reason') + ': ' + content.reason) : '';
    switch (content.membership) {
        case 'invite': {
            const threePidContent = content.third_party_invite;
            if (threePidContent) {
                if (threePidContent.display_name) {
                    return _t('%(targetName)s accepted the invitation for %(displayName)s.', {
                        targetName,
                        displayName: threePidContent.display_name,
                    });
                } else {
                    return _t('%(targetName)s accepted an invitation.', {targetName});
                }
            } else {
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return _t('%(senderName)s requested a VoIP conference.', {senderName});
                } else {
                    return _t('%(senderName)s invited %(targetName)s.', {senderName, targetName});
                }
            }
        }
        case 'ban':
            return _t('%(senderName)s banned %(targetName)s.', {senderName, targetName}) + ' ' + reason;
        case 'join':
            if (prevContent && prevContent.membership === 'join') {
                if (prevContent.displayname && content.displayname && prevContent.displayname !== content.displayname) {
                    return _t('%(oldDisplayName)s changed their display name to %(displayName)s.', {
                        oldDisplayName: prevContent.displayname,
                        displayName: content.displayname,
                    });
                } else if (!prevContent.displayname && content.displayname) {
                    return _t('%(senderName)s set their display name to %(displayName)s.', {
                        senderName: ev.getSender(),
                        displayName: content.displayname,
                    });
                } else if (prevContent.displayname && !content.displayname) {
                    return _t('%(senderName)s removed their display name (%(oldDisplayName)s).', {
                        senderName,
                        oldDisplayName: prevContent.displayname,
                    });
                } else if (prevContent.avatar_url && !content.avatar_url) {
                    return _t('%(senderName)s removed their profile picture.', {senderName});
                } else if (prevContent.avatar_url && content.avatar_url &&
                    prevContent.avatar_url !== content.avatar_url) {
                    return _t('%(senderName)s changed their profile picture.', {senderName});
                } else if (!prevContent.avatar_url && content.avatar_url) {
                    return _t('%(senderName)s set a profile picture.', {senderName});
                } else {
                    // suppress null rejoins
                    return '';
                }
            } else {
                if (!ev.target) console.warn("Join message has no target! -- " + ev.getContent().state_key);
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return _t('VoIP conference started.');
                } else {
                    return _t('%(targetName)s joined the room.', {targetName});
                }
            }
        case 'leave':
            if (ev.getSender() === ev.getStateKey()) {
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return _t('VoIP conference finished.');
                } else if (prevContent.membership === "invite") {
                    return _t('%(targetName)s rejected the invitation.', {targetName});
                } else {
                    return _t('%(targetName)s left the room.', {targetName});
                }
            } else if (prevContent.membership === "ban") {
                return _t('%(senderName)s unbanned %(targetName)s.', {senderName, targetName});
            } else if (prevContent.membership === "join") {
                return _t('%(senderName)s kicked %(targetName)s.', {senderName, targetName}) + ' ' + reason;
            } else if (prevContent.membership === "invite") {
                return _t('%(senderName)s withdrew %(targetName)s\'s invitation.', {
                    senderName,
                    targetName,
                }) + ' ' + reason;
            } else {
                return _t('%(targetName)s left the room.', {targetName});
            }
    }
}

function textForTopicEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    return _t('%(senderDisplayName)s changed the topic to "%(topic)s".', {
        senderDisplayName,
        topic: ev.getContent().topic,
    });
}

function textForRoomNameEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();

    if (!ev.getContent().name || ev.getContent().name.trim().length === 0) {
        return _t('%(senderDisplayName)s removed the room name.', {senderDisplayName});
    }
    return _t('%(senderDisplayName)s changed the room name to %(roomName)s.', {
        senderDisplayName,
        roomName: ev.getContent().name,
    });
}

function textForMessageEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    let message = senderDisplayName + ': ' + ev.getContent().body;
    if (ev.getContent().msgtype === "m.emote") {
        message = "* " + senderDisplayName + " " + message;
    } else if (ev.getContent().msgtype === "m.image") {
        message = _t('%(senderDisplayName)s sent an image.', {senderDisplayName});
    }
    return message;
}

function textForCallAnswerEvent(event) {
    const senderName = event.sender ? event.sender.name : _t('Someone');
    const supported = MatrixClientPeg.get().supportsVoip() ? '' : _t('(not supported by this browser)');
    return _t('%(senderName)s answered the call.', {senderName}) + ' ' + supported;
}

function textForCallHangupEvent(event) {
    const senderName = event.sender ? event.sender.name : _t('Someone');
    const eventContent = event.getContent();
    let reason = "";
    if (!MatrixClientPeg.get().supportsVoip()) {
        reason = _t('(not supported by this browser)');
    } else if (eventContent.reason) {
        if (eventContent.reason === "ice_failed") {
            reason = _t('(could not connect media)');
        } else if (eventContent.reason === "invite_timeout") {
            reason = _t('(no answer)');
        } else {
            reason = _t('(unknown failure: %(reason)s)', {reason: eventContent.reason});
        }
    }
    return _t('%(senderName)s ended the call.', {senderName}) + ' ' + reason;
}

function textForCallInviteEvent(event) {
    const senderName = event.sender ? event.sender.name : _t('Someone');
    // FIXME: Find a better way to determine this from the event?
    let callType = "voice";
    if (event.getContent().offer && event.getContent().offer.sdp &&
            event.getContent().offer.sdp.indexOf('m=video') !== -1) {
        callType = "video";
    }
    const supported = MatrixClientPeg.get().supportsVoip() ? "" : _t('(not supported by this browser)');
    return _t('%(senderName)s placed a %(callType)s call.', {senderName, callType}) + ' ' + supported;
}

function textForThreePidInviteEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    return _t('%(senderName)s sent an invitation to %(targetDisplayName)s to join the room.', {
        senderName,
        targetDisplayName: event.getContent().display_name,
    });
}

function textForHistoryVisibilityEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    switch (event.getContent().history_visibility) {
        case 'invited':
            return _t('%(senderName)s made future room history visible to all room members, '
                + 'from the point they are invited.', {senderName});
        case 'joined':
            return _t('%(senderName)s made future room history visible to all room members, '
                + 'from the point they joined.', {senderName});
        case 'shared':
            return _t('%(senderName)s made future room history visible to all room members.', {senderName});
        case 'world_readable':
            return _t('%(senderName)s made future room history visible to anyone.', {senderName});
        default:
            return _t('%(senderName)s made future room history visible to unknown (%(visibility)s).', {
                senderName,
                visibility: event.getContent().history_visibility,
            });
    }
}

function textForEncryptionEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    return _t('%(senderName)s turned on end-to-end encryption (algorithm %(algorithm)s).', {
        senderName,
        algorithm: event.getContent().algorithm,
    });
}

// Currently will only display a change if a user's power level is changed
function textForPowerEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    if (!event.getPrevContent() || !event.getPrevContent().users) {
        return '';
    }
    const userDefault = event.getContent().users_default || 0;
    // Construct set of userIds
    const users = [];
    Object.keys(event.getContent().users).forEach(
        (userId) => {
            if (users.indexOf(userId) === -1) users.push(userId);
        },
    );
    Object.keys(event.getPrevContent().users).forEach(
        (userId) => {
            if (users.indexOf(userId) === -1) users.push(userId);
        },
    );
    const diff = [];
    // XXX: This is also surely broken for i18n
    users.forEach((userId) => {
        // Previous power level
        const from = event.getPrevContent().users[userId];
        // Current power level
        const to = event.getContent().users[userId];
        if (to !== from) {
            diff.push(
                _t('%(userId)s from %(fromPowerLevel)s to %(toPowerLevel)s', {
                    userId,
                    fromPowerLevel: Roles.textualPowerLevel(from, userDefault),
                    toPowerLevel: Roles.textualPowerLevel(to, userDefault),
                }),
            );
        }
    });
    if (!diff.length) {
        return '';
    }
    return _t('%(senderName)s changed the power level of %(powerLevelDiffText)s.', {
        senderName,
        powerLevelDiffText: diff.join(", "),
    });
}

function textForPinnedEvent(event) {
    const senderName = event.getSender();
    return _t("%(senderName)s changed the pinned messages for the room.", {senderName});
}

function textForWidgetEvent(event) {
    const senderName = event.getSender();
    const {name: prevName, type: prevType, url: prevUrl} = event.getPrevContent();
    const {name, type, url} = event.getContent() || {};

    let widgetName = name || prevName || type || prevType || '';
    // Apply sentence case to widget name
    if (widgetName && widgetName.length > 0) {
        widgetName = widgetName[0].toUpperCase() + widgetName.slice(1) + ' ';
    }

    // If the widget was removed, its content should be {}, but this is sufficiently
    // equivalent to that condition.
    if (url) {
        if (prevUrl) {
            return _t('%(widgetName)s widget modified by %(senderName)s', {
                widgetName, senderName,
            });
        } else {
            return _t('%(widgetName)s widget added by %(senderName)s', {
                widgetName, senderName,
            });
        }
    } else {
        return _t('%(widgetName)s widget removed by %(senderName)s', {
            widgetName, senderName,
        });
    }
}

const handlers = {
    'm.room.message': textForMessageEvent,
    'm.call.invite': textForCallInviteEvent,
    'm.call.answer': textForCallAnswerEvent,
    'm.call.hangup': textForCallHangupEvent,
};

const stateHandlers = {
    'm.room.name': textForRoomNameEvent,
    'm.room.topic': textForTopicEvent,
    'm.room.member': textForMemberEvent,
    'm.room.third_party_invite': textForThreePidInviteEvent,
    'm.room.history_visibility': textForHistoryVisibilityEvent,
    'm.room.encryption': textForEncryptionEvent,
    'm.room.power_levels': textForPowerEvent,
    'm.room.pinned_events': textForPinnedEvent,

    'im.vector.modular.widgets': textForWidgetEvent,
};

module.exports = {
    textForEvent: function(ev) {
        const handler = (ev.isState() ? stateHandlers : handlers)[ev.getType()];
        if (handler) return handler(ev);
        return '';
    },
};
