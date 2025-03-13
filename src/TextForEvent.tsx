/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    type MatrixEvent,
    type MatrixClient,
    GuestAccess,
    HistoryVisibility,
    JoinRule,
    EventType,
    MsgType,
    M_POLL_START,
    M_POLL_END,
    ContentHelpers,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";
import { removeDirectionOverrideChars } from "matrix-js-sdk/src/utils";
import { type PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";

import { _t } from "./languageHandler";
import * as Roles from "./Roles";
import { isValid3pidInvite } from "./RoomInvite";
import SettingsStore from "./settings/SettingsStore";
import { ALL_RULE_TYPES, ROOM_RULE_TYPES, SERVER_RULE_TYPES, USER_RULE_TYPES } from "./mjolnir/BanList";
import { WIDGET_LAYOUT_EVENT_TYPE } from "./stores/widgets/WidgetLayoutStore";
import { RightPanelPhases } from "./stores/right-panel/RightPanelStorePhases";
import defaultDispatcher from "./dispatcher/dispatcher";
import { RoomSettingsTab } from "./components/views/dialogs/RoomSettingsDialog";
import AccessibleButton from "./components/views/elements/AccessibleButton";
import RightPanelStore from "./stores/right-panel/RightPanelStore";
import { highlightEvent, isLocationEvent } from "./utils/EventUtils";
import { ElementCall } from "./models/Call";
import { getSenderName } from "./utils/event/getSenderName";
import PosthogTrackers from "./PosthogTrackers.ts";

function getRoomMemberDisplayname(client: MatrixClient, event: MatrixEvent, userId = event.getSender()): string {
    const roomId = event.getRoomId();
    const member = client.getRoom(roomId)?.getMember(userId!);
    return member?.name || member?.rawDisplayName || userId || _t("common|someone");
}

function textForCallEvent(event: MatrixEvent, client: MatrixClient): () => string {
    const roomName = client.getRoom(event.getRoomId()!)?.name;
    const isSupported = client.supportsVoip();

    return isSupported
        ? () => _t("timeline|m.call|video_call_started", { roomName })
        : () => _t("timeline|m.call|video_call_started_unsupported", { roomName });
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
        return () => _t("timeline|m.call.invite|voice_call", { senderName });
    } else if (isVoice && !isSupported) {
        return () => _t("timeline|m.call.invite|voice_call_unsupported", { senderName });
    } else if (!isVoice && isSupported) {
        return () => _t("timeline|m.call.invite|video_call", { senderName });
    } else if (!isVoice && !isSupported) {
        return () => _t("timeline|m.call.invite|video_call_unsupported", { senderName });
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
        case KnownMembership.Invite: {
            const threePidContent = content.third_party_invite;
            if (threePidContent) {
                if (threePidContent.display_name) {
                    return () =>
                        _t("timeline|m.room.member|accepted_3pid_invite", {
                            targetName,
                            displayName: threePidContent.display_name,
                        });
                } else {
                    return () => _t("timeline|m.room.member|accepted_invite", { targetName });
                }
            } else {
                return () => _t("timeline|m.room.member|invite", { senderName, targetName });
            }
        }
        case KnownMembership.Ban:
            return () =>
                reason
                    ? _t("timeline|m.room.member|ban_reason", { senderName, targetName, reason })
                    : _t("timeline|m.room.member|ban", { senderName, targetName });
        case KnownMembership.Join:
            if (prevContent && prevContent.membership === KnownMembership.Join) {
                const modDisplayname = getModification(prevContent.displayname, content.displayname);
                const modAvatarUrl = getModification(prevContent.avatar_url, content.avatar_url);

                if (modDisplayname !== Modification.None && modAvatarUrl !== Modification.None) {
                    // Compromise to provide the user with more context without needing 16 translations
                    return () =>
                        _t("timeline|m.room.member|change_name_avatar", {
                            // We're taking the display namke directly from the event content here so we need
                            // to strip direction override chars which the js-sdk would normally do when
                            // calculating the display name
                            oldDisplayName: removeDirectionOverrideChars(prevContent.displayname!),
                        });
                } else if (modDisplayname === Modification.Changed) {
                    return () =>
                        _t("timeline|m.room.member|change_name", {
                            // We're taking the display name directly from the event content here so we need
                            // to strip direction override chars which the js-sdk would normally do when
                            // calculating the display name
                            oldDisplayName: removeDirectionOverrideChars(prevContent.displayname!),
                            displayName: removeDirectionOverrideChars(content.displayname!),
                        });
                } else if (modDisplayname === Modification.Set) {
                    return () =>
                        _t("timeline|m.room.member|set_name", {
                            senderName: ev.getSender(),
                            displayName: removeDirectionOverrideChars(content.displayname!),
                        });
                } else if (modDisplayname === Modification.Unset) {
                    return () =>
                        _t("timeline|m.room.member|remove_name", {
                            senderName,
                            oldDisplayName: removeDirectionOverrideChars(prevContent.displayname!),
                        });
                } else if (modAvatarUrl === Modification.Unset) {
                    return () => _t("timeline|m.room.member|remove_avatar", { senderName });
                } else if (modAvatarUrl === Modification.Changed) {
                    return () => _t("timeline|m.room.member|change_avatar", { senderName });
                } else if (modAvatarUrl === Modification.Set) {
                    return () => _t("timeline|m.room.member|set_avatar", { senderName });
                } else if (showHiddenEvents ?? SettingsStore.getValue("showHiddenEventsInTimeline")) {
                    // This is a null rejoin, it will only be visible if using 'show hidden events' (labs)
                    return () => _t("timeline|m.room.member|no_change", { senderName });
                } else {
                    return null;
                }
            } else {
                if (!ev.target) logger.warn("Join message has no target! -- " + ev.getContent().state_key);
                return () => _t("timeline|m.room.member|join", { targetName });
            }
        case KnownMembership.Leave:
            if (ev.getSender() === ev.getStateKey()) {
                if (prevContent.membership === KnownMembership.Invite) {
                    return () =>
                        reason
                            ? _t("timeline|m.room.member|reject_invite_reason", { targetName, reason })
                            : _t("timeline|m.room.member|reject_invite", { targetName });
                } else {
                    return () =>
                        reason
                            ? _t("timeline|m.room.member|left_reason", { targetName, reason })
                            : _t("timeline|m.room.member|left", { targetName });
                }
            } else if (prevContent.membership === KnownMembership.Ban) {
                return () => _t("timeline|m.room.member|unban", { senderName, targetName });
            } else if (prevContent.membership === KnownMembership.Invite) {
                return () =>
                    reason
                        ? _t("timeline|m.room.member|withdrew_invite_reason", {
                              senderName,
                              targetName,
                              reason,
                          })
                        : _t("timeline|m.room.member|withdrew_invite", { senderName, targetName });
            } else if (prevContent.membership === KnownMembership.Join) {
                return () =>
                    reason
                        ? _t("timeline|m.room.member|kick_reason", {
                              senderName,
                              targetName,
                              reason,
                          })
                        : _t("timeline|m.room.member|kick", { senderName, targetName });
            } else {
                return null;
            }
    }

    return null;
}

function textForTopicEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    const topic = ContentHelpers.parseTopicContent(ev.getContent()).text;
    return () =>
        topic
            ? _t("timeline|m.room.topic|changed", {
                  senderDisplayName,
                  topic,
              })
            : _t("timeline|m.room.topic|removed", {
                  senderDisplayName,
              });
}

function textForRoomAvatarEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev?.sender?.name || ev.getSender();
    return () => _t("timeline|m.room.avatar|changed", { senderDisplayName });
}

function textForRoomNameEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();

    if (!ev.getContent().name || ev.getContent().name.trim().length === 0) {
        return () => _t("timeline|m.room.name|remove", { senderDisplayName });
    }
    if (ev.getPrevContent().name) {
        return () =>
            _t("timeline|m.room.name|change", {
                senderDisplayName,
                oldRoomName: ev.getPrevContent().name,
                newRoomName: ev.getContent().name,
            });
    }
    return () =>
        _t("timeline|m.room.name|set", {
            senderDisplayName,
            roomName: ev.getContent().name,
        });
}

function textForTombstoneEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    return () => _t("timeline|m.room.tombstone", { senderDisplayName });
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
                _t("timeline|m.room.join_rules|public", {
                    senderDisplayName,
                });
        case JoinRule.Invite:
            return () =>
                _t("timeline|m.room.join_rules|invite", {
                    senderDisplayName,
                });
        case JoinRule.Knock:
            return () => _t("timeline|m.room.join_rules|knock", { senderDisplayName });
        case JoinRule.Restricted:
            if (allowJSX) {
                return () => (
                    <span>
                        {_t(
                            "timeline|m.room.join_rules|restricted_settings",
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

            return () => _t("timeline|m.room.join_rules|restricted", { senderDisplayName });
        default:
            // The spec supports "knock" and "private", however nothing implements these.
            return () =>
                _t("timeline|m.room.join_rules|unknown", {
                    senderDisplayName,
                    rule: ev.getContent().join_rule,
                });
    }
}

function textForGuestAccessEvent(ev: MatrixEvent): (() => string) | null {
    const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();
    switch (ev.getContent().guest_access) {
        case GuestAccess.CanJoin:
            return () => _t("timeline|m.room.guest_access|can_join", { senderDisplayName });
        case GuestAccess.Forbidden:
            return () => _t("timeline|m.room.guest_access|forbidden", { senderDisplayName });
        default:
            // There's no other options we can expect, however just for safety's sake we'll do this.
            return () =>
                _t("timeline|m.room.guest_access|unknown", {
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
        getText = () => _t("timeline|m.room.server_acl|set", { senderDisplayName });
    } else {
        getText = () => _t("timeline|m.room.server_acl|changed", { senderDisplayName });
    }

    if (!Array.isArray(current.allow)) {
        current.allow = [];
    }

    // If we know for sure everyone is banned, mark the room as obliterated
    if (current.allow.length === 0) {
        return () => getText() + " " + _t("timeline|m.room.server_acl|all_servers_banned");
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
            message = _t("timeline|m.image|sent", { senderDisplayName });
        } else if (ev.getType() == EventType.Sticker) {
            message = _t("timeline|m.sticker", { senderDisplayName });
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
                _t("timeline|m.room.canonical_alias|set", {
                    senderName,
                    address: ev.getContent().alias,
                });
        } else if (oldAlias) {
            return () =>
                _t("timeline|m.room.canonical_alias|removed", {
                    senderName,
                });
        }
    } else if (newAlias === oldAlias) {
        if (addedAltAliases.length && !removedAltAliases.length) {
            return () =>
                _t("timeline|m.room.canonical_alias|alt_added", {
                    senderName,
                    addresses: addedAltAliases.join(", "),
                    count: addedAltAliases.length,
                });
        }
        if (removedAltAliases.length && !addedAltAliases.length) {
            return () =>
                _t("timeline|m.room.canonical_alias|alt_removed", {
                    senderName,
                    addresses: removedAltAliases.join(", "),
                    count: removedAltAliases.length,
                });
        }
        if (removedAltAliases.length && addedAltAliases.length) {
            return () =>
                _t("timeline|m.room.canonical_alias|changed_alternative", {
                    senderName,
                });
        }
    } else {
        // both alias and alt_aliases where modified
        return () =>
            _t("timeline|m.room.canonical_alias|changed_main_and_alternative", {
                senderName,
            });
    }
    // in case there is no difference between the two events,
    // say something as we can't simply hide the tile from here
    return () =>
        _t("timeline|m.room.canonical_alias|changed", {
            senderName,
        });
}

function textForThreePidInviteEvent(event: MatrixEvent): (() => string) | null {
    const senderName = getSenderName(event);

    if (!isValid3pidInvite(event)) {
        return () =>
            _t("timeline|m.room.third_party_invite|revoked", {
                senderName,
                targetDisplayName: event.getPrevContent().display_name || _t("common|someone"),
            });
    }

    return () =>
        _t("timeline|m.room.third_party_invite|sent", {
            senderName,
            targetDisplayName: event.getContent().display_name,
        });
}

function textForHistoryVisibilityEvent(event: MatrixEvent): (() => string) | null {
    const senderName = getSenderName(event);
    switch (event.getContent().history_visibility) {
        case HistoryVisibility.Invited:
            return () => _t("timeline|m.room.history_visibility|invited", { senderName });
        case HistoryVisibility.Joined:
            return () =>
                _t("timeline|m.room.history_visibility|joined", {
                    senderName,
                });
        case HistoryVisibility.Shared:
            return () => _t("timeline|m.room.history_visibility|shared", { senderName });
        case HistoryVisibility.WorldReadable:
            return () => _t("timeline|m.room.history_visibility|world_readable", { senderName });
        default:
            return () =>
                _t("timeline|m.room.history_visibility|unknown", {
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
        _t("timeline|m.room.power_levels|changed", {
            senderName,
            powerLevelDiffText: diffs
                .map((diff) =>
                    _t("timeline|m.room.power_levels|user_from_to", {
                        userId: diff.name,
                        fromPowerLevel: Roles.textualPowerLevel(diff.from, previousUserDefault),
                        toPowerLevel: Roles.textualPowerLevel(diff.to, currentUserDefault),
                    }),
                )
                .join(", "),
        });
}

const onPinnedMessagesClick = (): void => {
    PosthogTrackers.trackInteraction("PinnedMessageStateEventClick");
    RightPanelStore.instance.setCard({ phase: RightPanelPhases.PinnedMessages }, false);
};

function textForPinnedEvent(event: MatrixEvent, client: MatrixClient, allowJSX: boolean): (() => Renderable) | null {
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
                        "timeline|m.room.pinned_events|pinned_link",
                        { senderName },
                        {
                            a: (sub) => (
                                <AccessibleButton
                                    kind="link_inline"
                                    onClick={() => {
                                        PosthogTrackers.trackInteraction("PinnedMessageStateEventClick");
                                        highlightEvent(roomId, messageId);
                                    }}
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

        return () => _t("timeline|m.room.pinned_events|pinned", { senderName });
    }

    if (newlyUnpinned.length === 1 && newlyPinned.length === 0) {
        // A single message was unpinned, include a link to that message.
        if (allowJSX) {
            const messageId = newlyUnpinned.pop()!;

            return () => (
                <span>
                    {_t(
                        "timeline|m.room.pinned_events|unpinned_link",
                        { senderName },
                        {
                            a: (sub) => (
                                <AccessibleButton
                                    kind="link_inline"
                                    onClick={() => {
                                        PosthogTrackers.trackInteraction("PinnedMessageStateEventClick");
                                        highlightEvent(roomId, messageId);
                                    }}
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

        return () => _t("timeline|m.room.pinned_events|unpinned", { senderName });
    }

    if (allowJSX) {
        return () => (
            <span>
                {_t(
                    "timeline|m.room.pinned_events|changed_link",
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

    return () => _t("timeline|m.room.pinned_events|changed", { senderName });
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
                _t("timeline|m.widget|modified", {
                    widgetName,
                    senderName,
                });
        } else {
            return () =>
                _t("timeline|m.widget|added", {
                    widgetName,
                    senderName,
                });
        }
    } else {
        return () =>
            _t("timeline|m.widget|removed", {
                widgetName,
                senderName,
            });
    }
}

function textForWidgetLayoutEvent(event: MatrixEvent): (() => string) | null {
    const senderName = getSenderName(event);
    return () => _t("timeline|io.element.widgets.layout", { senderName });
}

function textForMjolnirEvent(event: MatrixEvent): (() => string) | null {
    const senderName = getSenderName(event);
    const { entity: prevEntity } = event.getPrevContent();
    const { entity, recommendation, reason } = event.getContent();

    // Rule removed
    if (!entity) {
        if (USER_RULE_TYPES.includes(event.getType())) {
            return () => _t("timeline|mjolnir|removed_rule_users", { senderName, glob: prevEntity });
        } else if (ROOM_RULE_TYPES.includes(event.getType())) {
            return () => _t("timeline|mjolnir|removed_rule_rooms", { senderName, glob: prevEntity });
        } else if (SERVER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("timeline|mjolnir|removed_rule_servers", {
                    senderName,
                    glob: prevEntity,
                });
        }

        // Unknown type. We'll say something, but we shouldn't end up here.
        return () => _t("timeline|mjolnir|removed_rule", { senderName, glob: prevEntity });
    }

    // Invalid rule
    if (!recommendation || !reason) return () => _t("timeline|mjolnir|updated_invalid_rule", { senderName });

    // Rule updated
    if (entity === prevEntity) {
        if (USER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("timeline|mjolnir|updated_rule_users", {
                    senderName,
                    glob: entity,
                    reason,
                });
        } else if (ROOM_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("timeline|mjolnir|updated_rule_rooms", {
                    senderName,
                    glob: entity,
                    reason,
                });
        } else if (SERVER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("timeline|mjolnir|updated_rule_servers", {
                    senderName,
                    glob: entity,
                    reason,
                });
        }

        // Unknown type. We'll say something but we shouldn't end up here.
        return () =>
            _t("timeline|mjolnir|updated_rule", {
                senderName,
                glob: entity,
                reason,
            });
    }

    // New rule
    if (!prevEntity) {
        if (USER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("timeline|mjolnir|created_rule_users", {
                    senderName,
                    glob: entity,
                    reason,
                });
        } else if (ROOM_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("timeline|mjolnir|created_rule_rooms", {
                    senderName,
                    glob: entity,
                    reason,
                });
        } else if (SERVER_RULE_TYPES.includes(event.getType())) {
            return () =>
                _t("timeline|mjolnir|created_rule_servers", {
                    senderName,
                    glob: entity,
                    reason,
                });
        }

        // Unknown type. We'll say something but we shouldn't end up here.
        return () =>
            _t("timeline|mjolnir|created_rule", {
                senderName,
                glob: entity,
                reason,
            });
    }

    // else the entity !== prevEntity - count as a removal & add
    if (USER_RULE_TYPES.includes(event.getType())) {
        return () =>
            _t("timeline|mjolnir|changed_rule_users", { senderName, oldGlob: prevEntity, newGlob: entity, reason });
    } else if (ROOM_RULE_TYPES.includes(event.getType())) {
        return () =>
            _t("timeline|mjolnir|changed_rule_rooms", { senderName, oldGlob: prevEntity, newGlob: entity, reason });
    } else if (SERVER_RULE_TYPES.includes(event.getType())) {
        return () =>
            _t("timeline|mjolnir|changed_rule_servers", { senderName, oldGlob: prevEntity, newGlob: entity, reason });
    }

    // Unknown type. We'll say something but we shouldn't end up here.
    return () =>
        _t("timeline|mjolnir|changed_rule_glob", {
            senderName,
            oldGlob: prevEntity,
            newGlob: entity,
            reason,
        });
}

export function textForLocationEvent(event: MatrixEvent): () => string {
    return () =>
        _t("timeline|m.location|full", {
            senderName: getSenderName(event),
        });
}

function textForRedactedPollAndMessageEvent(ev: MatrixEvent, client: MatrixClient): string {
    let message = _t("timeline|self_redaction");
    const unsigned = ev.getUnsigned();
    const redactedBecauseUserId = unsigned?.redacted_because?.sender;
    if (redactedBecauseUserId && redactedBecauseUserId !== ev.getSender()) {
        const room = client.getRoom(ev.getRoomId());
        const sender = room?.getMember(redactedBecauseUserId);
        message = _t("timeline|redaction", {
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
            message = _t("timeline|m.poll.start", {
                senderName: getSenderName(event),
                pollQuestion: (event.unstableExtensibleEvent as PollStartEvent)?.question?.text,
            });
        }

        return message;
    };
}

function textForPollEndEvent(event: MatrixEvent): (() => string) | null {
    return () =>
        _t("timeline|m.poll.end|sender_ended", {
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
