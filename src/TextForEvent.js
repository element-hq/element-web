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
import dis from "./dispatcher";
import React from 'react';
import PropTypes from 'prop-types';

class ClickableUsername extends React.PureComponent {
    static propTypes = {
        mxid: PropTypes.string.isRequired,
        text: PropTypes.string.isRequired,
    };

    constructor(props) {
        super(props);
        this.onClick = this.onClick.bind(this);
    }

    onClick() {
        dis.dispatch({
            action: 'insert_mention',
            user_id: this.props.mxid,
        });
    }

    render() {
        const {mxid, text} = this.props;
        return <a className="mx_TextForEvent_username" dir="auto" onClick={this.onClick} data-mxid={mxid}>{ text }</a>;
    }
}

function textForMemberEvent(ev) {
    // XXX: SYJS-16 "sender is sometimes null for join messages"
    const senderName = ev.sender ? ev.sender.name : ev.getSender();
    const targetName = ev.target ? ev.target.name : ev.getStateKey();

    const sender = <ClickableUsername mxid={ev.getSender()} text={senderName} />;
    const target = <ClickableUsername mxid={ev.getStateKey()} text={targetName} />;

    const prevContent = ev.getPrevContent();
    const content = ev.getContent();

    const ConferenceHandler = CallHandler.getConferenceHandler();
    const reason = content.reason ? (_t('Reason') + ': ' + content.reason) : '';
    switch (content.membership) {
        case 'invite': {
            const threePidContent = content.third_party_invite;
            if (threePidContent) {
                if (threePidContent.display_name) {
                    return _t('<target> accepted the invitation for %(displayName)s.', {
                        displayName: threePidContent.display_name,
                    }, {
                        target,
                    });
                } else {
                    return _t('<target> accepted an invitation.', {}, {target});
                }
            } else {
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return _t('<sender> requested a VoIP conference.', {}, {sender});
                } else {
                    return _t('<sender> invited <target>.', {}, {sender, target});
                }
            }
        }
        case 'ban':
            return _t('<sender> banned <target>.', {}, {sender, target}) + ' ' + reason;
        case 'join':
            if (prevContent && prevContent.membership === 'join') {
                if (prevContent.displayname && content.displayname && prevContent.displayname !== content.displayname) {
                    return _t('<oldDisplayName> changed their display name to <displayName>.', {}, {
                        oldDisplayName: <ClickableUsername mxid={ev.getStateKey()} text={prevContent.displayname} />,
                        displayName: <ClickableUsername mxid={ev.getStateKey()} text={content.displayname} />,
                    });
                } else if (!prevContent.displayname && content.displayname) {
                    return _t('<sender> set their display name to <displayName>.', {}, {
                        sender,
                        displayName: <ClickableUsername mxid={ev.getSender()} text={content.displayname} />,
                    });
                } else if (prevContent.displayname && !content.displayname) {
                    return _t('<sender> removed their display name (<oldDisplayName>).', {
                        sender,
                        oldDisplayName: <ClickableUsername mxid={ev.getSender()} text={prevContent.displayname} />,
                    });
                } else if (prevContent.avatar_url && !content.avatar_url) {
                    return _t('<sender> removed their profile picture.', {}, {sender});
                } else if (prevContent.avatar_url && content.avatar_url &&
                    prevContent.avatar_url !== content.avatar_url) {
                    return _t('<sender> changed their profile picture.', {}, {sender});
                } else if (!prevContent.avatar_url && content.avatar_url) {
                    return _t('<sender> set a profile picture.', {}, {sender});
                } else {
                    // suppress null rejoins
                    return '';
                }
            } else {
                if (!ev.target) console.warn("Join message has no target! -- " + ev.getContent().state_key);
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return _t('VoIP conference started.');
                } else {
                    return _t('<target> joined the room.', {}, {target});
                }
            }
        case 'leave':
            if (ev.getSender() === ev.getStateKey()) {
                if (ConferenceHandler && ConferenceHandler.isConferenceUser(ev.getStateKey())) {
                    return _t('VoIP conference finished.');
                } else if (prevContent.membership === "invite") {
                    return _t('<target> rejected the invitation.', {}, {target});
                } else {
                    return _t('<target> left the room.', {}, {target});
                }
            } else if (prevContent.membership === "ban") {
                return _t('<sender> unbanned <target>.', {}, {sender, target});
            } else if (prevContent.membership === "join") {
                return _t('<sender> kicked <target>.', {}, {sender, target}) + ' ' + reason;
            } else if (prevContent.membership === "invite") {
                return _t('<sender> withdrew <target>\'s invitation.', {}, {sender, target}) + ' ' + reason;
            } else {
                return _t('<target> left the room.', {}, {target});
            }
    }
}

function textForTopicEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    return _t('<sender> changed the topic to "%(topic)s".', {
        topic: ev.getContent().topic,
    }, {
        sender: <ClickableUsername mxid={ev.getSender()} text={senderDisplayName} />,
    });
}

function textForRoomNameEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    const sender = <ClickableUsername mxid={ev.getSender()} text={senderDisplayName} />;

    if (!ev.getContent().name || ev.getContent().name.trim().length === 0) {
        return _t('<sender> removed the room name.', {}, {sender});
    }
    return _t('<sender> changed the room name to %(roomName)s.', {
        roomName: ev.getContent().name,
    }, {
        sender,
    });
}

function textForMessageEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    let message = senderDisplayName + ': ' + ev.getContent().body;
    if (ev.getContent().msgtype === "m.emote") {
        message = "* " + senderDisplayName + " " + message;
    } else if (ev.getContent().msgtype === "m.image") {
        message = _t('<sender> sent an image.', {}, {
            sender: <ClickableUsername mxid={ev.getSender()} text={senderDisplayName} />,
        });
    }
    return message;
}

function textForCallAnswerEvent(event) {
    const senderName = event.sender ? event.sender.name : _t('Someone');
    const supported = MatrixClientPeg.get().supportsVoip() ? '' : _t('(not supported by this browser)');
    return _t('<sender> answered the call.', {}, {
        sender: <ClickableUsername mxid={event.getSender()} text={senderName} />,
    }) + ' ' + supported;
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
    return _t('<sender> ended the call.', {}, {
        sender: <ClickableUsername mxid={event.getSender()} text={senderName} />,
    }) + ' ' + reason;
}

function textForCallInviteEvent(event) {
    const senderName = event.sender ? event.sender.name : _t('Someone');
    const sender = <ClickableUsername mxid={event.getSender()} text={senderName} />;
    // FIXME: Find a better way to determine this from the event?
    let callType = "voice";
    if (event.getContent().offer && event.getContent().offer.sdp &&
            event.getContent().offer.sdp.indexOf('m=video') !== -1) {
        callType = "video";
    }
    const supported = MatrixClientPeg.get().supportsVoip() ? "" : _t('(not supported by this browser)');
    return _t('<sender> placed a %(callType)s call.', {callType}, {sender}) + ' ' + supported;
}

function textForThreePidInviteEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    return _t('<sender> sent an invitation to %(targetDisplayName)s to join the room.', {
        targetDisplayName: event.getContent().display_name,
    }, {
        sender: <ClickableUsername mxid={event.getSender()} text={senderName} />,
    });
}

function textForHistoryVisibilityEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    const sender = <ClickableUsername mxid={event.getSender()} text={senderName} />;
    switch (event.getContent().history_visibility) {
        case 'invited':
            return _t('<sender> made future room history visible to all room members, '
                + 'from the point they are invited.', {}, {sender});
        case 'joined':
            return _t('<sender> made future room history visible to all room members, '
                + 'from the point they joined.', {}, {sender});
        case 'shared':
            return _t('<sender> made future room history visible to all room members.', {}, {sender});
        case 'world_readable':
            return _t('<sender> made future room history visible to anyone.', {}, {sender});
        default:
            return _t('<sender> made future room history visible to unknown (%(visibility)s).', {
                visibility: event.getContent().history_visibility,
            }, {
                sender,
            });
    }
}

function textForEncryptionEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    return _t('<sender> turned on end-to-end encryption (algorithm %(algorithm)s).', {
        algorithm: event.getContent().algorithm,
    }, {
        sender: <ClickableUsername mxid={event.getSender()} text={senderName} />,
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
                _t('<user> from %(fromPowerLevel)s to %(toPowerLevel)s', {
                    fromPowerLevel: Roles.textualPowerLevel(from, userDefault),
                    toPowerLevel: Roles.textualPowerLevel(to, userDefault),
                }, {
                    user: <ClickableUsername mxid={userId} text={userId} />,
                }),
            );
        }
    });
    if (!diff.length) {
        return '';
    }
    return _t('<sender> changed the power level of %(powerLevelDiffText)s.', {
        powerLevelDiffText: diff.join(", "),
    }, {
        sender: <ClickableUsername mxid={event.getSender()} text={senderName} />,
    });
}

function textForPinnedEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    const sender = <ClickableUsername mxid={event.getSender()} text={senderName} />;
    return _t("<sender> changed the pinned messages for the room.", {}, {sender});
}

function textForWidgetEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    const sender = <ClickableUsername mxid={event.getSender()} text={senderName} />;

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
            return _t('%(widgetName)s widget modified by <sender>', {widgetName}, {sender});
        } else {
            return _t('%(widgetName)s widget added by <sender>', {widgetName}, {sender});
        }
    } else {
        return _t('%(widgetName)s widget removed by <sender>', {widgetName}, {sender});
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
