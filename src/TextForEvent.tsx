/*
Copyright 2015 - 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { logger } from "matrix-js-sdk/src/logger";
import { removeDirectionOverrideChars } from "matrix-js-sdk/src/utils";
import { GuestAccess, HistoryVisibility, JoinRule } from "matrix-js-sdk/src/@types/partials";
import { EventType, MsgType } from "matrix-js-sdk/src/@types/event";
import { M_POLL_START, M_POLL_END } from "matrix-js-sdk/src/@types/polls";
import { PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "./languageHandler";
import * as Roles from "./Roles";
import { isValid3pidInvite } from "./RoomInvite";
import SettingsStore from "./settings/SettingsStore";
import { ALL_RULE_TYPES, ROOM_RULE_TYPES, SERVER_RULE_TYPES, USER_RULE_TYPES } from "./mjolnir/BanList";
import { WIDGET_LAYOUT_EVENT_TYPE } from "./stores/widgets/WidgetLayoutStore";
import { RightPanelPhases } from "./stores/right-panel/RightPanelStorePhases";
import defaultDispatcher from "./dispatcher/dispatcher";
import { RoomSettingsTab } from "./components/views/dialogs/RoomSettingsDialog";
import AccessibleButton, { ButtonEvent } from "./components/views/elements/AccessibleButton";
import RightPanelStore from "./stores/right-panel/RightPanelStore";
import { highlightEvent, isLocationEvent } from "./utils/EventUtils";
import { ElementCall } from "./models/Call";
import { textForVoiceBroadcastStoppedEvent, VoiceBroadcastInfoEventType } from "./voice-broadcast";
import { getSenderName } from "./utils/event/getSenderName";

function getRoomMemberDisplayname(client: MatrixClient, event: MatrixEvent, userId = event.getSender()): string {
    const roomId = event.getRoomId();
    const member = client.getRoom(roomId)?.getMember(userId!);
    return member?.name || member?.rawDisplayName || userId || _t("Someone");
}

function textForCallEvent(event: MatrixEvent, client: MatrixClient): () => string {
    const roomName = client.getRoom(event.getRoomId()!)?.name;
    const isSupported = client.supportsVoip();

    return isSupported
        ? () => _t("Video call started in %(roomName)s.", { roomName })
        : () => _t("Video call started in %(roomName)s. (not supported by this browser)", { roomName });
}

// These functions are frequently used just to check whether an event has
// any text to display at all. For this reason they return deferred values
// to avoid the expense of looking up translations when they're not needed.

function textForCallInviteEvent(event: MatrixEvent, client: MatrixClient): (() => string) | null {
    const senderName = getSenderName(event);
    // FIXME: Find a better way to determine this from the event?
    const isVoice = !event.getContent().offer?.sdp?.includes("m=video");
    const isSupported = client.supportsVoip();

    // This ladder could be reduced down to a couple string variables, however other languages
    // can have a hard time translating those strings. In an effort to make translations easier
    // and more accurate, we break out the string-based variables to a couple booleans.
    if (isVoice && isSupported) {
        return () => _t("%(senderName)s placed a voice call.", { senderName });
    } else if (isVoice && !isSupported) {
        return () => _t("%(senderName)s placed a voice call. (not supported by this browser)", { senderName });
    } else if (!isVoice && isSupported) {
        return () => _t("%(senderName)s placed a video call.", { senderName });
    } else if (!isVoice && !isSupported) {
        return () => _t("%(senderName)s placed a video call. (not supported by this browser)", { senderName });
    }

    return null;
}

enum Modification {
    None,
    Unset,
    Set,
    Changed,
}

function getModification(prev?: string, value?: string): Modification {
    if (prev && value && prev !== value) {
        return Modification.Changed;
    }
    if (prev && !value) {
        return Modification.Unset;
    }
    if (!prev && value) {
        return Modification.Set;
    }

    return Modification.None;
}

function textForMemberEvent(
    ev: MatrixEvent,
    client: MatrixClient,
    allowJSX: boolean,
    showHiddenEvents?: boolean,
): (() => string) | null {
    // XXX: SYJS-16 "sender is sometimes null for join messages"
    const senderName = ev.sender?.name || getRoomMemberDisplayname(client, ev);
    const targetName = ev.target?.name || getRoomMemberDisplayname(client, ev, ev.getStateKey());
    const prevContent = ev.getPrevContent();
    const content = ev.getContent();
    const reason = content.reason;

    switch (content.membership) {
        case "invite": {
            const threePidContent = content.third_party_invite;
            if (threePidContent) {
                if (threePidContent.display_name) {
                    return () =>
                        _t("%(targetName)s accepted the invitation for %(displayName)s", {
                            targetName,
                            displayName: threePidContent.display_name,
                        });
                } else {
                    return () => _t("%(targetName)s accepted an invitation", { targetName });
                }
            } else {
                return () => _t("%(senderName)s invited %(targetName)s", { senderName, targetName });
            }
        }
        case "ban":
            return () =>
                reason
                    ? _t("%(senderName)s banned %(targetName)s: %(reason)s", { senderName, targetName, reason })
                    : _t("%(senderName)s banned %(targetName)s", { senderName, targetName });
        case "join":
            if (prevContent && prevContent.membership === "join") {
                const modDisplayname = getModification(prevContent.displayname, content.displayname);
                const modAvatarUrl = getModification(prevContent.avatar_url, content.avatar_url);

                if (modDisplayname !== Modification.None && modAvatarUrl !== Modification.None) {
                    // Compromise to provide the user with more context without needing 16 translations
                    return () =>
                        _t("%(oldDisplayName)s changed their display name and profile picture", {
                            // We're taking the display namke directly from the event content here so we need
                            // to strip direction override chars which the js-sdk would normally do when
                            // calculating the display name
                            oldDisplayName: removeDirectionOverrideChars(prevContent.displayname!),
                        });
                } else if (modDisplayname === Modification.Changed) {
                    return () =>
                        _t("%(oldDisplayName)s changed their display name to %(displayName)s", {
                            // We're taking the display name directly from the event content here so we need
                            // to strip direction override chars which the js-sdk would normally do when
                            // calculating the display name
                            oldDisplayName: removeDirectionOverrideChars(prevContent.displayname!),
                            displayName: removeDirectionOverrideChars(content.displayname!),
                        });
                } else if (modDisplayname === Modification.Set) {
                    return () =>
                        _t("%(senderName)s set their display name to %(displayName)s", {
                            senderName: ev.getSender(),
                            displayName: removeDirectionOverrideChars(content.displayname!),
                        });
                } else if (modDisplayname === Modification.Unset) {
                    return () =>
                        _t("%(senderName)s removed their display name (%(oldDisplayName)s)", {
                            senderName,
                            oldDisplayName: removeDirectionOverrideChars(prevContent.displayname!),
                        });
                } else if (modAvatarUrl === Modification.Unset) {
                    return () => _t("%(senderName)s removed their profile picture", { senderName });
                } else if (modAvatarUrl === Modification.Changed) {
                    return () => _t("%(senderName)s changed their profile picture", { senderName });
                } else if (modAvatarUrl === Modification.Set) {
                    return () => _t("%(senderName)s set a profile picture", { senderName });
                } else if (showHiddenEvents ?? SettingsStore.getValue("showHiddenEventsInTimeline")) {
                    // This is a null rejoin, it will only be visible if using 'show hidden events' (labs)
                    return () => _t("%(senderName)s made no change", { senderName });
                } else {
                    return null;
                }
            } else {
                if (!ev.target) logger.warn("Join message has no target! -- " + ev.getContent().state_key);
                return () => _t("%(targetName)s joined the room", { targetName });
            }
        case "leave":
            if (ev.getSender() === ev.getStateKey()) {
                if (prevContent.membership === "invite") {
                    return () => _t("%(targetName)s rejected the invitation", { targetName });
                } else {
                    return () =>
                        reason
                            ? _t("%(targetName)s left the room: %(reason)s", { targetName, reason })
                            : _t("%(targetName)s left the room", { targetName });
                }
            } else if (prevContent.membership === "ban") {
                return () => _t("%(senderName)s unbanned %(targetName)s", { senderName, targetName });
            } else if (prevContent.membership === "invite") {
                return () =>
                    reason
                        ? _t("%(senderName)s withdrew %(targetName)s's invitation: %(reason)s", {
                              senderName,
                              targetName,
                              reason,
                          })
                        : _t("%(senderName)s withdrew %(targetName)s's invitation", { senderName, targetName });
            } else if (prevContent.membership === "join") {
                return () =>
                    reason
                        ? _t("%(senderName)s removed %(targetName)s: %(reason)s", {
                              senderName,
                              targetName,
                              reason,
                          })
                        : _t("%(senderName)s removed %(targetName)s", { senderName, targetName });
            } else {
                return null;
            }
    }

    return null;
}

function textForTopicEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    return () =>
        _t('%(senderDisplayName)s changed the topic to "%(topic)s".', {
            senderDisplayName,
            topic: ev.getContent().topic,
        });
}

function textForRoomAvatarEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev?.sender?.name || ev.getSender();
    return () => _t("%(senderDisplayName)s changed the room avatar.", { senderDisplayName });
}

function textForRoomNameEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();

    if (!ev.getContent().name || ev.getContent().name.trim().length === 0) {
        return () => _t("%(senderDisplayName)s removed the room name.", { senderDisplayName });
    }
    if (ev.getPrevContent().name) {
        return () =>
            _t("%(senderDisplayName)s changed the room name from %(oldRoomName)s to %(newRoomName)s.", {
                senderDisplayName,
                oldRoomName: ev.getPrevContent().name,
                newRoomName: ev.getContent().name,
            });
    }
    return () =>
        _t("%(senderDisplayName)s changed the room name to %(roomName)s.", {
            senderDisplayName,
            roomName: ev.getContent().name,
        });
}

function textForTombstoneEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    return () => _t("%(senderDisplayName)s upgraded this room.", { senderDisplayName });
}

const onViewJoinRuleSettingsClick = (): void => {
    defaultDispatcher.dispatch({
        action: "open_room_settings",
        initial_tab_id: RoomSettingsTab.Security,
    });
};

function textForJoinRulesEvent(ev: MatrixEvent, client: MatrixClient, allowJSX: boolean): () => Renderable {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    switch (ev.getContent().join_rule) {
        case JoinRule.Public:
            return () =>
                _t("%(senderDisplayName)s made the room public to whoever knows the link.", {
                    senderDisplayName,
                });
        case JoinRule.Invite:
            return () =>
                _t("%(senderDisplayName)s made the room invite only.", {
                    senderDisplayName,
                });
        case JoinRule.Restricted:
            if (allowJSX) {
                return () => (
                    <span>
                        {_t(
                            "%(senderDisplayName)s changed who can join this room. <a>View settings</a>.",
                            {
                                senderDisplayName,
                            },
                            {
                                a: (sub) => (
                                    <AccessibleButton kind="link_inline" onClick={onViewJoinRuleSettingsClick}>
                                        {sub}
                                    </AccessibleButton>
                                ),
                            },
                        )}
                    </span>
                );
            }

            return () => _t("%(senderDisplayName)s changed who can join this room.", { senderDisplayName });
        default:
            // The spec supports "knock" and "private", however nothing implements these.
            return () =>
                _t("%(senderDisplayName)s changed the join rule to %(rule)s", {
                    senderDisplayName,
                    rule: ev.getContent().join_rule,
                });
    }
}

function textForGuestAccessEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    switch (ev.getContent().guest_access) {
        case GuestAccess.CanJoin:
            return () => _t("%(senderDisplayName)s has allowed guests to join the room.", { senderDisplayName });
        case GuestAccess.Forbidden:
            return () => _t("%(senderDisplayName)s has prevented guests from joining the room.", { senderDisplayName });
        default:
            // There's no other options we can expect, however just for safety's sake we'll do this.
            return () =>
                _t("%(senderDisplayName)s changed guest access to %(rule)s", {
                    senderDisplayName,
                    rule: ev.getContent().guest_access,
                });
    }
}

function textForServerACLEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    const prevContent = ev.getPrevContent();
    const current = ev.getContent();
    const prev = {
        deny: Array.isArray(prevContent.deny) ? prevContent.deny : [],
        allow: Array.isArray(prevContent.allow) ? prevContent.allow : [],
        allow_ip_literals: prevContent.allow_ip_literals !== false,
    };

    let getText: () => string;
    if (prev.deny.length === 0 && prev.allow.length === 0) {
        getText = () => _t("%(senderDisplayName)s set the server ACLs for this room.", { senderDisplayName });
    } else {
        getText = () => _t("%(senderDisplayName)s changed the server ACLs for this room.", { senderDisplayName });
    }

    if (!Array.isArray(current.allow)) {
        current.allow = [];
    }

    // If we know for sure everyone is banned, mark the room as obliterated
    if (current.allow.length === 0) {
        return () =>
            getText() + " " + _t("🎉 All servers are banned from participating! This room can no longer be used.");
    }

    return getText;
}

function textForMessageEvent(ev: MatrixEvent, client: MatrixClient): (() => string) | null {
    if (isLocationEvent(ev)) {
        return textForLocationEvent(ev);
    }

    return () => {
        const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
        let message = ev.getContent().body;
        if (ev.isRedacted()) {
            message = textForRedactedPollAndMessageEvent(ev, client);
        }

        if (ev.getContent().msgtype === MsgType.Emote) {
            message = "* " + senderDisplayName + " " + message;
        } else if (ev.getContent().msgtype === MsgType.Image) {
            message = _t("%(senderDisplayName)s sent an image.", { senderDisplayName });
        } else if (ev.getType() == EventType.Sticker) {
            message = _t("%(senderDisplayName)s sent a sticker.", { senderDisplayName });
        } else {
            // in this case, parse it as a plain text message
            message = senderDisplayName + ": " + message;
        }
        return message;
    };
}

function textForCanonicalAliasEvent(ev: MatrixEvent): (() => string) | null {
    const senderName = getSenderName(ev);
    const oldAlias = ev.getPrevContent().alias;
    const oldAltAliases = ev.getPrevContent().alt_aliases || [];
    const newAlias = ev.getContent().alias;
    const newAltAliases = ev.getContent().alt_aliases || [];
    const removedAltAliases = oldAltAliases.filter((alias: string) => !newAltAliases.includes(alias));
    const addedAltAliases = newAltAliases.filter((alias: string) => !oldAltAliases.includes(alias));

    if (!removedAltAliases.length && !addedAltAliases.length) {
        if (newAlias) {
            return () =>
                _t("%(senderName)s set the main address for this room to %(address)s.", {
                    senderName,
                    address: ev.getContent().alias,
                });
        } else if (oldAlias) {
            return () =>
                _t("%(senderName)s removed the main address for this room.", {
                    senderName,
                });
        }
    } else if (newAlias === oldAlias) {
        if (addedAltAliases.length && !removedAltAliases.length) {
            return () =>
                _t("%(senderName)s added the alternative addresses %(addresses)s for this room.", {
                    senderName,
                    addresses: addedAltAliases.join(", "),
                    count: addedAltAliases.length,
                });
        }
        if (removedAltAliases.length && !addedAltAliases.length) {
            return () =>
                _t("%(senderName)s removed the alternative addresses %(addresses)s for this room.", {
                    senderName,
                    addresses: removedAltAliases.join(", "),
                    count: removedAltAliases.length,
                });
        }
        if (removedAltAliases.length && addedAltAliases.length) {
            return () =>
                _t("%(senderName)s changed the alternative addresses for this room.", {
                    senderName,
                });
        }
    } else {
        // both alias and alt_aliases where modified
        return () =>
            _t("%(senderName)s changed the main and alternative addresses for this room.", {
                senderName,
            });
    }
    // in case there is no difference between the two events,
    // say something as we can't simply hide the tile from here
    return () =>
        _t("%(senderName)s changed the addresses for this room.", {
            senderName,
        });
}

function textForThreePidInviteEvent(event: MatrixEvent): (() => string) | null {
    const senderName = getSenderName(event);

    if (!isValid3pidInvite(event)) {
        return () =>
            _t("%(senderName)s revoked the invitation for %(targetDisplayName)s to join the room.", {
                senderName,
                targetDisplayName: event.getPrevContent().display_name || _t("Someone"),
            });
    }

    return () =>
        _t("%(senderName)s sent an invitation to %(targetDisplayName)s to join the room.", {
            senderName,
            targetDisplayName: event.getContent().display_name,
        });
}

function textForHistoryVisibilityEvent(event: MatrixEvent): (() => string) | null {
    const senderName = getSenderName(event);
    switch (event.getContent().history_visibility) {
        case HistoryVisibility.Invited:
            return () =>
                _t(
                    "%(senderName)s made future room history visible to all room members, " +
                        "from the point they are invited.",
                    { senderName },
                );
        case HistoryVisibility.Joined:
            return () =>
                _t(
                    "%(senderName)s made future room history visible to all room members, " +
                        "from the point they joined.",
                    { senderName },
                );
        case HistoryVisibility.Shared:
            return () => _t("%(senderName)s made future room history visible to all room members.", { senderName });
        case HistoryVisibility.WorldReadable:
            return () => _t("%(senderName)s made future room history visible to anyone.", { senderName });
        default:
            return () =>
                _t("%(senderName)s made future room history visible to unknown (%(visibility)s).", {
                    senderName,
                    visibility: event.getContent().history_visibility,
                });
    }
}

// Currently will only display a change if a user's power level is changed
function textForPowerEvent(event: MatrixEvent, client: MatrixClient): (() => string) | null {
    const senderName = getSenderName(event);
    if (!event.getPrevContent()?.users || !event.getContent()?.users) {
        return null;
    }
    const previousUserDefault: number = event.getPrevContent().users_default || 0;
    const currentUserDefault: number = event.getContent().users_default || 0;
    // Construct set of userIds
    const users: string[] = [];
    Object.keys(event.getContent().users).forEach((userId) => {
        if (users.indexOf(userId) === -1) users.push(userId);
    });
    Object.keys(event.getPrevContent().users).forEach((userId) => {
        if (users.indexOf(userId) === -1) users.push(userId);
    });

    const diffs: {
        userId: string;
        name: string;
        from: number;
        to: number;
    }[] = [];
    users.forEach((userId) => {
        // Previous power level
        let from: number = event.getPrevContent().users[userId];
        if (!Number.isInteger(from)) {
            from = previousUserDefault;
        }
        // Current power level
        let to = event.getContent().users[userId];
        if (!Number.isInteger(to)) {
            to = currentUserDefault;
        }
        if (from === previousUserDefault && to === currentUserDefault) {
            return;
        }
        if (to !== from) {
            const name = getRoomMemberDisplayname(client, event, userId);
            diffs.push({ userId, name, from, to });
        }
    });
    if (!diffs.length) {
        return null;
    }

    // XXX: This is also surely broken for i18n
    return () =>
        _t("%(senderName)s changed the power level of %(powerLevelDiffText)s.", {
            senderName,
            powerLevelDiffText: diffs
                .map((diff) =>
                    _t("%(userId)s from %(fromPowerLevel)s to %(toPowerLevel)s", {
                        userId: diff.name,
                        fromPowerLevel: Roles.textualPowerLevel(diff.from, previousUserDefault),
                        toPowerLevel: Roles.textualPowerLevel(diff.to, currentUserDefault),
                    }),
                )
                .join(", "),
        });
}

const onPinnedMessagesClick = (): void => {
    RightPanelStore.instance.setCard({ phase: RightPanelPhases.PinnedMessages }, false);
};

function textForPinnedEvent(event: MatrixEvent, client: MatrixClient, allowJSX: boolean): (() => Renderable) | null {
    if (!SettingsStore.getValue("feature_pinning")) return null;
    const senderName = getSenderName(event);
    const roomId = event.getRoomId()!;

    const pinned = event.getContent<{ pinned: string[] }>().pinned ?? [];
    const previouslyPinned: string[] = event.getPrevContent().pinned ?? [];
    const newlyPinned = pinned.filter((item) => previouslyPinned.indexOf(item) < 0);
    const newlyUnpinned = previouslyPinned.filter((item) => pinned.indexOf(item) < 0);

    if (newlyPinned.length === 1 && newlyUnpinned.length === 0) {
        // A single message was pinned, include a link to that message.
        if (allowJSX) {
            const messageId = newlyPinned.pop()!;

            return () => (
                <span>
                    {_t(
                        "%(senderName)s pinned <a>a message</a> to this room. See all <b>pinned messages</b>.",
                        { senderName },
                        {
                            a: (sub) => (
                                <AccessibleButton
                                    kind="link_inline"
                                    onClick={(e: ButtonEvent) => highlightEvent(roomId, messageId)}
                                >
                                    {sub}
                                </AccessibleButton>
                            ),
                            b: (sub) => (
                                <AccessibleButton kind="link_inline" onClick={onPinnedMessagesClick}>
                                    {sub}
                                </AccessibleButton>
                            ),
                        },
                    )}
                </span>
            );
        }

        return () => _t("%(senderName)s pinned a message to this room. See all pinned messages.", { senderName });
    }

    if (newlyUnpinned.length === 1 && newlyPinned.length === 0) {
        // A single message was unpinned, include a link to that message.
        if (allowJSX) {
            const messageId = newlyUnpinned.pop()!;

            return () => (
                <span>
                    {_t(
                        "%(senderName)s unpinned <a>a message</a> from this room. See all <b>pinned messages</b>.",
                        { senderName },
                        {
                            a: (sub) => (
                                <AccessibleButton
                                    kind="link_inline"
                                    onClick={(e: ButtonEvent) => highlightEvent(roomId, messageId)}
                                >
                                    {sub}
                                </AccessibleButton>
                            ),
                            b: (sub) => (
                                <AccessibleButton kind="link_inline" onClick={onPinnedMessagesClick}>
                                    {sub}
                                </AccessibleButton>
                            ),
                        },
                    )}
                </span>
            );
        }

        return () => _t("%(senderName)s unpinned a message from this room. See all pinned messages.", { senderName });
    }

    if (allowJSX) {
        return () => (
            <span>
                {_t(
                    "%(senderName)s changed the <a>pinned messages</a> for the room.",
                    { senderName },
                    {
                        a: (sub) => (
                            <AccessibleButton kind="link_inline" onClick={onPinnedMessagesClick}>
                                {sub}
                            </AccessibleButton>
                        ),
                    },
                )}
            </span>
        );
    }

    return () => _t("%(senderName)s changed the pinned messages for the room.", { senderName });
}

function textForWidgetEvent(event: MatrixEvent): (() => string) | null {
    const senderName = getSenderName(event);
    const { name: prevName, type: prevType, url: prevUrl } = event.getPrevContent();
    const { name, type, url } = event.getContent() || {};

    let widgetName = name || prevName || type || prevType || "";
    // Apply sentence case to widget name
    if (widgetName && widgetName.length > 0) {
        widgetName = widgetName[0].toUpperCase() + widgetName.slice(1);
    }

    // If the widget was removed, its content should be {}, but this is sufficiently
    // equivalent to that condition.
    if (url) {
        if (prevUrl) {
            return () =>
                _t("%(widgetName)s widget modified by %(senderName)s", {
                    widgetName,
                    senderName,
                });
        } else {
            return () =>
                _t("%(widgetName)s widget added by %(senderName)s", {
                    widgetName,
                    senderName,
                });
        }
    } else {
        return () =>
            _t("%(widgetName)s widget removed by %(senderName)s", {
                widgetName,
                senderName,
            });
    }
}

function textForWidgetLayoutEvent(event: MatrixEvent): (() => string) | null {
    const senderName = getSenderName(event);
    return () => _t("%(senderName)s has updated the room layout", { senderName });
}

function textForMjolnirEvent(event: MatrixEvent): (() => string) | null {
    const senderName = getSenderName(event);
    const { entity: prevEntity } = event.getPrevContent();
    const { entity, recommendation, reason } = event.getContent();

    // Rule removed
    if (!entity) {
        if (USER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("%(senderName)s removed the rule banning users matching %(glob)s", { senderName, glob: prevEntity });
        } else if (ROOM_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("%(senderName)s removed the rule banning rooms matching %(glob)s", { senderName, glob: prevEntity });
        } else if (SERVER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("%(senderName)s removed the rule banning servers matching %(glob)s", {
                    senderName,
                    glob: prevEntity,
                });
        }

        // Unknown type. We'll say something, but we shouldn't end up here.
        return () => _t("%(senderName)s removed a ban rule matching %(glob)s", { senderName, glob: prevEntity });
    }

    // Invalid rule
    if (!recommendation || !reason) return () => _t(`%(senderName)s updated an invalid ban rule`, { senderName });

    // Rule updated
    if (entity === prevEntity) {
        if (USER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("%(senderName)s updated the rule banning users matching %(glob)s for %(reason)s", {
                    senderName,
                    glob: entity,
                    reason,
                });
        } else if (ROOM_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("%(senderName)s updated the rule banning rooms matching %(glob)s for %(reason)s", {
                    senderName,
                    glob: entity,
                    reason,
                });
        } else if (SERVER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("%(senderName)s updated the rule banning servers matching %(glob)s for %(reason)s", {
                    senderName,
                    glob: entity,
                    reason,
                });
        }

        // Unknown type. We'll say something but we shouldn't end up here.
        return () =>
            _t("%(senderName)s updated a ban rule matching %(glob)s for %(reason)s", {
                senderName,
                glob: entity,
                reason,
            });
    }

    // New rule
    if (!prevEntity) {
        if (USER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("%(senderName)s created a rule banning users matching %(glob)s for %(reason)s", {
                    senderName,
                    glob: entity,
                    reason,
                });
        } else if (ROOM_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("%(senderName)s created a rule banning rooms matching %(glob)s for %(reason)s", {
                    senderName,
                    glob: entity,
                    reason,
                });
        } else if (SERVER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("%(senderName)s created a rule banning servers matching %(glob)s for %(reason)s", {
                    senderName,
                    glob: entity,
                    reason,
                });
        }

        // Unknown type. We'll say something but we shouldn't end up here.
        return () =>
            _t("%(senderName)s created a ban rule matching %(glob)s for %(reason)s", {
                senderName,
                glob: entity,
                reason,
            });
    }

    // else the entity !== prevEntity - count as a removal & add
    if (USER_RULE_TYPES.includes(event.getType())) {
        return () =>
            _t(
                "%(senderName)s changed a rule that was banning users matching %(oldGlob)s to matching " +
                    "%(newGlob)s for %(reason)s",
                { senderName, oldGlob: prevEntity, newGlob: entity, reason },
            );
    } else if (ROOM_RULE_TYPES.includes(event.getType())) {
        return () =>
            _t(
                "%(senderName)s changed a rule that was banning rooms matching %(oldGlob)s to matching " +
                    "%(newGlob)s for %(reason)s",
                { senderName, oldGlob: prevEntity, newGlob: entity, reason },
            );
    } else if (SERVER_RULE_TYPES.includes(event.getType())) {
        return () =>
            _t(
                "%(senderName)s changed a rule that was banning servers matching %(oldGlob)s to matching " +
                    "%(newGlob)s for %(reason)s",
                { senderName, oldGlob: prevEntity, newGlob: entity, reason },
            );
    }

    // Unknown type. We'll say something but we shouldn't end up here.
    return () =>
        _t(
            "%(senderName)s updated a ban rule that was matching %(oldGlob)s to matching %(newGlob)s " +
                "for %(reason)s",
            { senderName, oldGlob: prevEntity, newGlob: entity, reason },
        );
}

export function textForLocationEvent(event: MatrixEvent): () => string {
    return () =>
        _t("%(senderName)s has shared their location", {
            senderName: getSenderName(event),
        });
}

function textForRedactedPollAndMessageEvent(ev: MatrixEvent, client: MatrixClient): string {
    let message = _t("Message deleted");
    const unsigned = ev.getUnsigned();
    const redactedBecauseUserId = unsigned?.redacted_because?.sender;
    if (redactedBecauseUserId && redactedBecauseUserId !== ev.getSender()) {
        const room = client.getRoom(ev.getRoomId());
        const sender = room?.getMember(redactedBecauseUserId);
        message = _t("Message deleted by %(name)s", {
            name: sender?.name || redactedBecauseUserId,
        });
    }

    return message;
}

function textForPollStartEvent(event: MatrixEvent, client: MatrixClient): (() => string) | null {
    return () => {
        let message = "";

        if (event.isRedacted()) {
            message = textForRedactedPollAndMessageEvent(event, client);
            const senderDisplayName = event.sender?.name ?? event.getSender();
            message = senderDisplayName + ": " + message;
        } else {
            message = _t("%(senderName)s has started a poll - %(pollQuestion)s", {
                senderName: getSenderName(event),
                pollQuestion: (event.unstableExtensibleEvent as PollStartEvent)?.question?.text,
            });
        }

        return message;
    };
}

function textForPollEndEvent(event: MatrixEvent): (() => string) | null {
    return () =>
        _t("%(senderName)s has ended a poll", {
            senderName: getSenderName(event),
        });
}

type Renderable = string | React.ReactNode | null;

interface IHandlers {
    [type: string]: (
        ev: MatrixEvent,
        client: MatrixClient,
        allowJSX: boolean,
        showHiddenEvents?: boolean,
    ) => (() => Renderable) | null;
}

const handlers: IHandlers = {
    [EventType.RoomMessage]: textForMessageEvent,
    [EventType.Sticker]: textForMessageEvent,
    [EventType.CallInvite]: textForCallInviteEvent,
    [M_POLL_START.name]: textForPollStartEvent,
    [M_POLL_END.name]: textForPollEndEvent,
    [M_POLL_START.altName]: textForPollStartEvent,
    [M_POLL_END.altName]: textForPollEndEvent,
};

const stateHandlers: IHandlers = {
    [EventType.RoomCanonicalAlias]: textForCanonicalAliasEvent,
    [EventType.RoomName]: textForRoomNameEvent,
    [EventType.RoomTopic]: textForTopicEvent,
    [EventType.RoomMember]: textForMemberEvent,
    [EventType.RoomAvatar]: textForRoomAvatarEvent,
    [EventType.RoomThirdPartyInvite]: textForThreePidInviteEvent,
    [EventType.RoomHistoryVisibility]: textForHistoryVisibilityEvent,
    [EventType.RoomPowerLevels]: textForPowerEvent,
    [EventType.RoomPinnedEvents]: textForPinnedEvent,
    [EventType.RoomServerAcl]: textForServerACLEvent,
    [EventType.RoomTombstone]: textForTombstoneEvent,
    [EventType.RoomJoinRules]: textForJoinRulesEvent,
    [EventType.RoomGuestAccess]: textForGuestAccessEvent,

    // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
    "im.vector.modular.widgets": textForWidgetEvent,
    [WIDGET_LAYOUT_EVENT_TYPE]: textForWidgetLayoutEvent,
    [VoiceBroadcastInfoEventType]: textForVoiceBroadcastStoppedEvent,
};

// Add all the Mjolnir stuff to the renderer
for (const evType of ALL_RULE_TYPES) {
    stateHandlers[evType] = textForMjolnirEvent;
}

// Add both stable and unstable m.call events
for (const evType of ElementCall.CALL_EVENT_TYPE.names) {
    stateHandlers[evType] = textForCallEvent;
}

/**
 * Determines whether the given event has text to display.
 *
 * @param client The Matrix Client instance for the logged-in user
 * @param ev The event
 * @param showHiddenEvents An optional cached setting value for showHiddenEventsInTimeline
 *     to avoid hitting the settings store
 */
export function hasText(ev: MatrixEvent, client: MatrixClient, showHiddenEvents?: boolean): boolean {
    const handler = (ev.isState() ? stateHandlers : handlers)[ev.getType()];
    return Boolean(handler?.(ev, client, false, showHiddenEvents));
}

/**
 * Gets the textual content of the given event.
 *
 * @param ev The event
 * @param client The Matrix Client instance for the logged-in user
 * @param allowJSX Whether to output rich JSX content
 * @param showHiddenEvents An optional cached setting value for showHiddenEventsInTimeline
 *     to avoid hitting the settings store
 */
export function textForEvent(ev: MatrixEvent, client: MatrixClient): string;
export function textForEvent(
    ev: MatrixEvent,
    client: MatrixClient,
    allowJSX: true,
    showHiddenEvents?: boolean,
): string | React.ReactNode;
export function textForEvent(
    ev: MatrixEvent,
    client: MatrixClient,
    allowJSX = false,
    showHiddenEvents?: boolean,
): string | React.ReactNode {
    const handler = (ev.isState() ? stateHandlers : handlers)[ev.getType()];
    return handler?.(ev, client, allowJSX, showHiddenEvents)?.() || "";
}
