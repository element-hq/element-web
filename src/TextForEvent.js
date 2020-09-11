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
import {MatrixClientPeg} from './MatrixClientPeg';
import CallHandler from './CallHandler';
import { _t } from './languageHandler';
import * as Roles from './Roles';
import {isValid3pidInvite} from "./RoomInvite";
import SettingsStore from "./settings/SettingsStore";
import {WidgetType} from "./widgets/WidgetType";
import {ALL_RULE_TYPES, ROOM_RULE_TYPES, SERVER_RULE_TYPES, USER_RULE_TYPES} from "./mjolnir/BanList";

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
                } else if (SettingsStore.getValue("showHiddenEventsInTimeline")) {
                    // This is a null rejoin, it will only be visible if the Labs option is enabled
                    return _t("%(senderName)s made no change.", {senderName});
                } else {
                    return "";
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
            } else if (prevContent.membership === "invite") {
                return _t('%(senderName)s withdrew %(targetName)s\'s invitation.', {
                    senderName,
                    targetName,
                }) + ' ' + reason;
            } else {
                // sender is not target and made the target leave, if not from invite/ban then this is a kick
                return _t('%(senderName)s kicked %(targetName)s.', {senderName, targetName}) + ' ' + reason;
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
    if (ev.getPrevContent().name) {
        return _t('%(senderDisplayName)s changed the room name from %(oldRoomName)s to %(newRoomName)s.', {
            senderDisplayName,
            oldRoomName: ev.getPrevContent().name,
            newRoomName: ev.getContent().name,
        });
    }
    return _t('%(senderDisplayName)s changed the room name to %(roomName)s.', {
        senderDisplayName,
        roomName: ev.getContent().name,
    });
}

function textForTombstoneEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    return _t('%(senderDisplayName)s upgraded this room.', {senderDisplayName});
}

function textForJoinRulesEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    switch (ev.getContent().join_rule) {
        case "public":
            return _t('%(senderDisplayName)s made the room public to whoever knows the link.', {senderDisplayName});
        case "invite":
            return _t('%(senderDisplayName)s made the room invite only.', {senderDisplayName});
        default:
            // The spec supports "knock" and "private", however nothing implements these.
            return _t('%(senderDisplayName)s changed the join rule to %(rule)s', {
                senderDisplayName,
                rule: ev.getContent().join_rule,
            });
    }
}

function textForGuestAccessEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    switch (ev.getContent().guest_access) {
        case "can_join":
            return _t('%(senderDisplayName)s has allowed guests to join the room.', {senderDisplayName});
        case "forbidden":
            return _t('%(senderDisplayName)s has prevented guests from joining the room.', {senderDisplayName});
        default:
            // There's no other options we can expect, however just for safety's sake we'll do this.
            return _t('%(senderDisplayName)s changed guest access to %(rule)s', {
                senderDisplayName,
                rule: ev.getContent().guest_access,
            });
    }
}

function textForRelatedGroupsEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    const groups = ev.getContent().groups || [];
    const prevGroups = ev.getPrevContent().groups || [];
    const added = groups.filter((g) => !prevGroups.includes(g));
    const removed = prevGroups.filter((g) => !groups.includes(g));

    if (added.length && !removed.length) {
        return _t('%(senderDisplayName)s enabled flair for %(groups)s in this room.', {
            senderDisplayName,
            groups: added.join(', '),
        });
    } else if (!added.length && removed.length) {
        return _t('%(senderDisplayName)s disabled flair for %(groups)s in this room.', {
            senderDisplayName,
            groups: removed.join(', '),
        });
    } else if (added.length && removed.length) {
        return _t('%(senderDisplayName)s enabled flair for %(newGroups)s and disabled flair for ' +
            '%(oldGroups)s in this room.', {
            senderDisplayName,
            newGroups: added.join(', '),
            oldGroups: removed.join(', '),
        });
    } else {
        // Don't bother rendering this change (because there were no changes)
        return '';
    }
}

function textForServerACLEvent(ev) {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    const prevContent = ev.getPrevContent();
    const changes = [];
    const current = ev.getContent();
    const prev = {
        deny: Array.isArray(prevContent.deny) ? prevContent.deny : [],
        allow: Array.isArray(prevContent.allow) ? prevContent.allow : [],
        allow_ip_literals: !(prevContent.allow_ip_literals === false),
    };
    let text = "";
    if (prev.deny.length === 0 && prev.allow.length === 0) {
        text = `${senderDisplayName} set server ACLs for this room: `;
    } else {
        text = `${senderDisplayName} changed the server ACLs for this room: `;
    }

    if (!Array.isArray(current.allow)) {
        current.allow = [];
    }
    /* If we know for sure everyone is banned, don't bother showing the diff view */
    if (current.allow.length === 0) {
        return text + "🎉 All servers are banned from participating! This room can no longer be used.";
    }

    if (!Array.isArray(current.deny)) {
        current.deny = [];
    }

    const bannedServers = current.deny.filter((srv) => typeof(srv) === 'string' && !prev.deny.includes(srv));
    const unbannedServers = prev.deny.filter((srv) => typeof(srv) === 'string' && !current.deny.includes(srv));
    const allowedServers = current.allow.filter((srv) => typeof(srv) === 'string' && !prev.allow.includes(srv));
    const unallowedServers = prev.allow.filter((srv) => typeof(srv) === 'string' && !current.allow.includes(srv));

    if (bannedServers.length > 0) {
        changes.push(`Servers matching ${bannedServers.join(", ")} are now banned.`);
    }

    if (unbannedServers.length > 0) {
        changes.push(`Servers matching ${unbannedServers.join(", ")} were removed from the ban list.`);
    }

    if (allowedServers.length > 0) {
        changes.push(`Servers matching ${allowedServers.join(", ")} are now allowed.`);
    }

    if (unallowedServers.length > 0) {
        changes.push(`Servers matching ${unallowedServers.join(", ")} were removed from the allowed list.`);
    }

    if (prev.allow_ip_literals !== current.allow_ip_literals) {
        const allowban = current.allow_ip_literals ? "allowed" : "banned";
        changes.push(`Participating from a server using an IP literal hostname is now ${allowban}.`);
    }

    return text + changes.join(" ");
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

function textForCanonicalAliasEvent(ev) {
    const senderName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    const oldAlias = ev.getPrevContent().alias;
    const oldAltAliases = ev.getPrevContent().alt_aliases || [];
    const newAlias = ev.getContent().alias;
    const newAltAliases = ev.getContent().alt_aliases || [];
    const removedAltAliases = oldAltAliases.filter(alias => !newAltAliases.includes(alias));
    const addedAltAliases = newAltAliases.filter(alias => !oldAltAliases.includes(alias));

    if (!removedAltAliases.length && !addedAltAliases.length) {
        if (newAlias) {
            return _t('%(senderName)s set the main address for this room to %(address)s.', {
                senderName: senderName,
                address: ev.getContent().alias,
            });
        } else if (oldAlias) {
            return _t('%(senderName)s removed the main address for this room.', {
                senderName: senderName,
            });
        }
    } else if (newAlias === oldAlias) {
        if (addedAltAliases.length && !removedAltAliases.length) {
            return _t('%(senderName)s added the alternative addresses %(addresses)s for this room.', {
                senderName: senderName,
                addresses: addedAltAliases.join(", "),
                count: addedAltAliases.length,
            });
        } if (removedAltAliases.length && !addedAltAliases.length) {
            return _t('%(senderName)s removed the alternative addresses %(addresses)s for this room.', {
                senderName: senderName,
                addresses: removedAltAliases.join(", "),
                count: removedAltAliases.length,
            });
        } if (removedAltAliases.length && addedAltAliases.length) {
            return _t('%(senderName)s changed the alternative addresses for this room.', {
                senderName: senderName,
            });
        }
    } else {
        // both alias and alt_aliases where modified
        return _t('%(senderName)s changed the main and alternative addresses for this room.', {
            senderName: senderName,
        });
    }
    // in case there is no difference between the two events,
    // say something as we can't simply hide the tile from here
    return _t('%(senderName)s changed the addresses for this room.', {
        senderName: senderName,
    });
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
        } else if (eventContent.reason === "user hangup") {
            // workaround for https://github.com/vector-im/element-web/issues/5178
            // it seems Android randomly sets a reason of "user hangup" which is
            // interpreted as an error code :(
            // https://github.com/vector-im/riot-android/issues/2623
            reason = '';
        } else {
            reason = _t('(unknown failure: %(reason)s)', {reason: eventContent.reason});
        }
    }
    return _t('%(senderName)s ended the call.', {senderName}) + ' ' + reason;
}

function textForCallInviteEvent(event) {
    const senderName = event.sender ? event.sender.name : _t('Someone');
    // FIXME: Find a better way to determine this from the event?
    let isVoice = true;
    if (event.getContent().offer && event.getContent().offer.sdp &&
            event.getContent().offer.sdp.indexOf('m=video') !== -1) {
        isVoice = false;
    }
    const isSupported = MatrixClientPeg.get().supportsVoip();

    // This ladder could be reduced down to a couple string variables, however other languages
    // can have a hard time translating those strings. In an effort to make translations easier
    // and more accurate, we break out the string-based variables to a couple booleans.
    if (isVoice && isSupported) {
        return _t("%(senderName)s placed a voice call.", {senderName});
    } else if (isVoice && !isSupported) {
        return _t("%(senderName)s placed a voice call. (not supported by this browser)", {senderName});
    } else if (!isVoice && isSupported) {
        return _t("%(senderName)s placed a video call.", {senderName});
    } else if (!isVoice && !isSupported) {
        return _t("%(senderName)s placed a video call. (not supported by this browser)", {senderName});
    }
}

function textForThreePidInviteEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();

    if (!isValid3pidInvite(event)) {
        const targetDisplayName = event.getPrevContent().display_name || _t("Someone");
        return _t('%(senderName)s revoked the invitation for %(targetDisplayName)s to join the room.', {
            senderName,
            targetDisplayName,
        });
    }

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

// Currently will only display a change if a user's power level is changed
function textForPowerEvent(event) {
    const senderName = event.sender ? event.sender.name : event.getSender();
    if (!event.getPrevContent() || !event.getPrevContent().users ||
        !event.getContent() || !event.getContent().users) {
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
    const senderName = event.sender ? event.sender.name : event.getSender();
    return _t("%(senderName)s changed the pinned messages for the room.", {senderName});
}

function textForWidgetEvent(event) {
    const senderName = event.getSender();
    const {name: prevName, type: prevType, url: prevUrl} = event.getPrevContent();
    const {name, type, url} = event.getContent() || {};

    if (WidgetType.JITSI.matches(type) || WidgetType.JITSI.matches(prevType)) {
        return textForJitsiWidgetEvent(event, senderName, url, prevUrl);
    }

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

function textForJitsiWidgetEvent(event, senderName, url, prevUrl) {
    if (url) {
        if (prevUrl) {
            return _t('Group call modified by %(senderName)s', {
                senderName,
            });
        } else {
            return _t('Group call started by %(senderName)s', {
                senderName,
            });
        }
    } else {
        return _t('Group call ended by %(senderName)s', {
            senderName,
        });
    }
}

function textForMjolnirEvent(event) {
    const senderName = event.getSender();
    const {entity: prevEntity} = event.getPrevContent();
    const {entity, recommendation, reason} = event.getContent();

    // Rule removed
    if (!entity) {
        if (USER_RULE_TYPES.includes(event.getType())) {
            return _t("%(senderName)s removed the rule banning users matching %(glob)s",
                {senderName, glob: prevEntity});
        } else if (ROOM_RULE_TYPES.includes(event.getType())) {
            return _t("%(senderName)s removed the rule banning rooms matching %(glob)s",
                {senderName, glob: prevEntity});
        } else if (SERVER_RULE_TYPES.includes(event.getType())) {
            return _t("%(senderName)s removed the rule banning servers matching %(glob)s",
                {senderName, glob: prevEntity});
        }

        // Unknown type. We'll say something, but we shouldn't end up here.
        return _t("%(senderName)s removed a ban rule matching %(glob)s", {senderName, glob: prevEntity});
    }

    // Invalid rule
    if (!recommendation || !reason) return _t(`%(senderName)s updated an invalid ban rule`, {senderName});

    // Rule updated
    if (entity === prevEntity) {
        if (USER_RULE_TYPES.includes(event.getType())) {
            return _t("%(senderName)s updated the rule banning users matching %(glob)s for %(reason)s",
                {senderName, glob: entity, reason});
        } else if (ROOM_RULE_TYPES.includes(event.getType())) {
            return _t("%(senderName)s updated the rule banning rooms matching %(glob)s for %(reason)s",
                {senderName, glob: entity, reason});
        } else if (SERVER_RULE_TYPES.includes(event.getType())) {
            return _t("%(senderName)s updated the rule banning servers matching %(glob)s for %(reason)s",
                {senderName, glob: entity, reason});
        }

        // Unknown type. We'll say something but we shouldn't end up here.
        return _t("%(senderName)s updated a ban rule matching %(glob)s for %(reason)s",
            {senderName, glob: entity, reason});
    }

    // New rule
    if (!prevEntity) {
        if (USER_RULE_TYPES.includes(event.getType())) {
            return _t("%(senderName)s created a rule banning users matching %(glob)s for %(reason)s",
                {senderName, glob: entity, reason});
        } else if (ROOM_RULE_TYPES.includes(event.getType())) {
            return _t("%(senderName)s created a rule banning rooms matching %(glob)s for %(reason)s",
                {senderName, glob: entity, reason});
        } else if (SERVER_RULE_TYPES.includes(event.getType())) {
            return _t("%(senderName)s created a rule banning servers matching %(glob)s for %(reason)s",
                {senderName, glob: entity, reason});
        }

        // Unknown type. We'll say something but we shouldn't end up here.
        return _t("%(senderName)s created a ban rule matching %(glob)s for %(reason)s",
            {senderName, glob: entity, reason});
    }

    // else the entity !== prevEntity - count as a removal & add
    if (USER_RULE_TYPES.includes(event.getType())) {
        return _t("%(senderName)s changed a rule that was banning users matching %(oldGlob)s to matching " +
            "%(newGlob)s for %(reason)s",
            {senderName, oldGlob: prevEntity, newGlob: entity, reason});
    } else if (ROOM_RULE_TYPES.includes(event.getType())) {
        return _t("%(senderName)s changed a rule that was banning rooms matching %(oldGlob)s to matching " +
            "%(newGlob)s for %(reason)s",
            {senderName, oldGlob: prevEntity, newGlob: entity, reason});
    } else if (SERVER_RULE_TYPES.includes(event.getType())) {
        return _t("%(senderName)s changed a rule that was banning servers matching %(oldGlob)s to matching " +
            "%(newGlob)s for %(reason)s",
            {senderName, oldGlob: prevEntity, newGlob: entity, reason});
    }

    // Unknown type. We'll say something but we shouldn't end up here.
    return _t("%(senderName)s updated a ban rule that was matching %(oldGlob)s to matching %(newGlob)s " +
        "for %(reason)s", {senderName, oldGlob: prevEntity, newGlob: entity, reason});
}

const handlers = {
    'm.room.message': textForMessageEvent,
    'm.call.invite': textForCallInviteEvent,
    'm.call.answer': textForCallAnswerEvent,
    'm.call.hangup': textForCallHangupEvent,
};

const stateHandlers = {
    'm.room.canonical_alias': textForCanonicalAliasEvent,
    'm.room.name': textForRoomNameEvent,
    'm.room.topic': textForTopicEvent,
    'm.room.member': textForMemberEvent,
    'm.room.third_party_invite': textForThreePidInviteEvent,
    'm.room.history_visibility': textForHistoryVisibilityEvent,
    'm.room.power_levels': textForPowerEvent,
    'm.room.pinned_events': textForPinnedEvent,
    'm.room.server_acl': textForServerACLEvent,
    'm.room.tombstone': textForTombstoneEvent,
    'm.room.join_rules': textForJoinRulesEvent,
    'm.room.guest_access': textForGuestAccessEvent,
    'm.room.related_groups': textForRelatedGroupsEvent,

    // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
    'im.vector.modular.widgets': textForWidgetEvent,
};

// Add all the Mjolnir stuff to the renderer
for (const evType of ALL_RULE_TYPES) {
    stateHandlers[evType] = textForMjolnirEvent;
}

export function textForEvent(ev) {
    const handler = (ev.isState() ? stateHandlers : handlers)[ev.getType()];
    if (handler) return handler(ev);
    return '';
}
