/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type Capability,
    EventDirection,
    EventKind,
    getTimelineRoomIDFromCapability,
    isTimelineCapability,
    isTimelineCapabilityFor,
    MatrixCapabilities,
    Symbols,
    WidgetEventCapability,
    WidgetKind,
} from "matrix-widget-api";
import { EventType, MsgType } from "matrix-js-sdk/src/matrix";
import React from "react";

import { _t, _td, type TranslatedString, type TranslationKey } from "../languageHandler";
import { ElementWidgetCapabilities } from "../stores/widgets/ElementWidgetCapabilities";
import { MatrixClientPeg } from "../MatrixClientPeg";
import TextWithTooltip from "../components/views/elements/TextWithTooltip";

type GENERIC_WIDGET_KIND = "generic"; // eslint-disable-line @typescript-eslint/naming-convention
const GENERIC_WIDGET_KIND: GENERIC_WIDGET_KIND = "generic";

type SendRecvStaticCapText = Partial<
    Record<
        EventType | string,
        Partial<Record<WidgetKind | GENERIC_WIDGET_KIND, Record<EventDirection, TranslationKey>>>
    >
>;

export interface TranslatedCapabilityText {
    primary: TranslatedString;
    byline?: TranslatedString;
}

export class CapabilityText {
    private static simpleCaps: Record<Capability, Partial<Record<WidgetKind | GENERIC_WIDGET_KIND, TranslationKey>>> = {
        [MatrixCapabilities.AlwaysOnScreen]: {
            [WidgetKind.Room]: _td("widget|capability|always_on_screen_viewing_another_room"),
            [GENERIC_WIDGET_KIND]: _td("widget|capability|always_on_screen_generic"),
        },
        [MatrixCapabilities.StickerSending]: {
            [WidgetKind.Room]: _td("widget|capability|send_stickers_this_room"),
            [GENERIC_WIDGET_KIND]: _td("widget|capability|send_stickers_active_room"),
        },
        [ElementWidgetCapabilities.CanChangeViewedRoom]: {
            [GENERIC_WIDGET_KIND]: _td("widget|capability|switch_room"),
        },
        [MatrixCapabilities.MSC2931Navigate]: {
            [GENERIC_WIDGET_KIND]: _td("widget|capability|switch_room_message_user"),
        },
    };

    private static stateSendRecvCaps: SendRecvStaticCapText = {
        [EventType.RoomTopic]: {
            [WidgetKind.Room]: {
                [EventDirection.Send]: _td("widget|capability|change_topic_this_room"),
                [EventDirection.Receive]: _td("widget|capability|see_topic_change_this_room"),
            },
            [GENERIC_WIDGET_KIND]: {
                [EventDirection.Send]: _td("widget|capability|change_topic_active_room"),
                [EventDirection.Receive]: _td("widget|capability|see_topic_change_active_room"),
            },
        },
        [EventType.RoomName]: {
            [WidgetKind.Room]: {
                [EventDirection.Send]: _td("widget|capability|change_name_this_room"),
                [EventDirection.Receive]: _td("widget|capability|see_name_change_this_room"),
            },
            [GENERIC_WIDGET_KIND]: {
                [EventDirection.Send]: _td("widget|capability|change_name_active_room"),
                [EventDirection.Receive]: _td("widget|capability|see_name_change_active_room"),
            },
        },
        [EventType.RoomAvatar]: {
            [WidgetKind.Room]: {
                [EventDirection.Send]: _td("widget|capability|change_avatar_this_room"),
                [EventDirection.Receive]: _td("widget|capability|see_avatar_change_this_room"),
            },
            [GENERIC_WIDGET_KIND]: {
                [EventDirection.Send]: _td("widget|capability|change_avatar_active_room"),
                [EventDirection.Receive]: _td("widget|capability|see_avatar_change_active_room"),
            },
        },
        [EventType.RoomMember]: {
            [WidgetKind.Room]: {
                [EventDirection.Send]: _td("widget|capability|remove_ban_invite_leave_this_room"),
                [EventDirection.Receive]: _td("widget|capability|receive_membership_this_room"),
            },
            [GENERIC_WIDGET_KIND]: {
                [EventDirection.Send]: _td("widget|capability|remove_ban_invite_leave_active_room"),
                [EventDirection.Receive]: _td("widget|capability|receive_membership_active_room"),
            },
        },
    };

    private static nonStateSendRecvCaps: SendRecvStaticCapText = {
        [EventType.Sticker]: {
            [WidgetKind.Room]: {
                [EventDirection.Send]: _td("widget|capability|send_stickers_this_room_as_you"),
                [EventDirection.Receive]: _td("widget|capability|see_sticker_posted_this_room"),
            },
            [GENERIC_WIDGET_KIND]: {
                [EventDirection.Send]: _td("widget|capability|send_stickers_active_room_as_you"),
                [EventDirection.Receive]: _td("widget|capability|see_sticker_posted_active_room"),
            },
        },
    };

    private static bylineFor(eventCap: WidgetEventCapability): TranslatedString {
        if (eventCap.kind === EventKind.State) {
            return !eventCap.keyStr
                ? _t("widget|capability|byline_empty_state_key")
                : _t("widget|capability|byline_state_key", { stateKey: eventCap.keyStr });
        }
        return null; // room messages are handled specially
    }

    public static for(capability: Capability, kind: WidgetKind): TranslatedCapabilityText {
        // TODO: Support MSC3819 (to-device capabilities)

        // First see if we have a super simple line of text to provide back
        if (CapabilityText.simpleCaps[capability]) {
            const textForKind = CapabilityText.simpleCaps[capability];
            if (textForKind[kind]) return { primary: _t(textForKind[kind]!) };
            if (textForKind[GENERIC_WIDGET_KIND]) return { primary: _t(textForKind[GENERIC_WIDGET_KIND]) };

            // ... we'll fall through to the generic capability processing at the end of this
            // function if we fail to generate a string for the capability.
        }

        // Try to handle timeline capabilities. The text here implies that the caller has sorted
        // the timeline caps to the end for UI purposes.
        if (isTimelineCapability(capability)) {
            if (isTimelineCapabilityFor(capability, Symbols.AnyRoom)) {
                return { primary: _t("widget|capability|any_room") };
            } else {
                const roomId = getTimelineRoomIDFromCapability(capability);
                const room = MatrixClientPeg.safeGet().getRoom(roomId);
                return {
                    primary: _t(
                        "widget|capability|specific_room",
                        {},
                        {
                            Room: () => {
                                if (room) {
                                    return (
                                        <TextWithTooltip tooltip={room.getCanonicalAlias() ?? roomId}>
                                            <strong>{room.name}</strong>
                                        </TextWithTooltip>
                                    );
                                } else {
                                    return (
                                        <strong>
                                            <code>{roomId}</code>
                                        </strong>
                                    );
                                }
                            },
                        },
                    ),
                };
            }
        }

        // We didn't have a super simple line of text, so try processing the capability as the
        // more complex event send/receive permission type.
        const [eventCap] = WidgetEventCapability.findEventCapabilities([capability]);
        if (eventCap) {
            // Special case room messages so they show up a bit cleaner to the user. Result is
            // effectively "Send images" instead of "Send messages... of type images" if we were
            // to handle the msgtype nuances in this function.
            if (eventCap.kind === EventKind.Event && eventCap.eventType === EventType.RoomMessage) {
                return CapabilityText.forRoomMessageCap(eventCap, kind);
            }

            // See if we have a static line of text to provide for the given event type and
            // direction. The hope is that we do for common event types for friendlier copy.
            const evSendRecv =
                eventCap.kind === EventKind.State
                    ? CapabilityText.stateSendRecvCaps
                    : CapabilityText.nonStateSendRecvCaps;
            if (evSendRecv[eventCap.eventType]) {
                const textForKind = evSendRecv[eventCap.eventType];
                const textForDirection = textForKind?.[kind] || textForKind?.[GENERIC_WIDGET_KIND];
                if (textForDirection?.[eventCap.direction]) {
                    return {
                        primary: _t(textForDirection[eventCap.direction]),
                        // no byline because we would have already represented the event properly
                    };
                }
            }

            // We don't have anything simple, so just return a generic string for the event cap
            if (kind === WidgetKind.Room) {
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary: _t(
                            "widget|capability|send_event_type_this_room",
                            {
                                eventType: eventCap.eventType,
                            },
                            {
                                b: (sub) => <strong>{sub}</strong>,
                            },
                        ),
                        byline: CapabilityText.bylineFor(eventCap),
                    };
                } else {
                    return {
                        primary: _t(
                            "widget|capability|see_event_type_sent_this_room",
                            {
                                eventType: eventCap.eventType,
                            },
                            {
                                b: (sub) => <strong>{sub}</strong>,
                            },
                        ),
                        byline: CapabilityText.bylineFor(eventCap),
                    };
                }
            } else {
                // assume generic
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary: _t(
                            "widget|capability|send_event_type_active_room",
                            {
                                eventType: eventCap.eventType,
                            },
                            {
                                b: (sub) => <strong>{sub}</strong>,
                            },
                        ),
                        byline: CapabilityText.bylineFor(eventCap),
                    };
                } else {
                    return {
                        primary: _t(
                            "widget|capability|see_event_type_sent_active_room",
                            {
                                eventType: eventCap.eventType,
                            },
                            {
                                b: (sub) => <strong>{sub}</strong>,
                            },
                        ),
                        byline: CapabilityText.bylineFor(eventCap),
                    };
                }
            }
        }

        // We don't have enough context to render this capability specially, so we'll present it as-is
        return {
            primary: _t(
                "widget|capability|capability",
                { capability },
                {
                    b: (sub) => <strong>{sub}</strong>,
                },
            ),
        };
    }

    private static forRoomMessageCap(eventCap: WidgetEventCapability, kind: WidgetKind): TranslatedCapabilityText {
        // First handle the case of "all messages" to make the switch later on a bit clearer
        if (!eventCap.keyStr) {
            if (eventCap.direction === EventDirection.Send) {
                return {
                    primary:
                        kind === WidgetKind.Room
                            ? _t("widget|capability|send_messages_this_room")
                            : _t("widget|capability|send_messages_active_room"),
                };
            } else {
                return {
                    primary:
                        kind === WidgetKind.Room
                            ? _t("widget|capability|see_messages_sent_this_room")
                            : _t("widget|capability|see_messages_sent_active_room"),
                };
            }
        }

        // Now handle all the message types we care about. There are more message types available, however
        // they are not as common so we don't bother rendering them. They'll fall into the generic case.
        switch (eventCap.keyStr) {
            case MsgType.Text: {
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("widget|capability|send_text_messages_this_room")
                                : _t("widget|capability|send_text_messages_active_room"),
                    };
                } else {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("widget|capability|see_text_messages_sent_this_room")
                                : _t("widget|capability|see_text_messages_sent_active_room"),
                    };
                }
            }
            case MsgType.Emote: {
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("widget|capability|send_emotes_this_room")
                                : _t("widget|capability|send_emotes_active_room"),
                    };
                } else {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("widget|capability|see_sent_emotes_this_room")
                                : _t("widget|capability|see_sent_emotes_active_room"),
                    };
                }
            }
            case MsgType.Image: {
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("widget|capability|send_images_this_room")
                                : _t("widget|capability|send_images_active_room"),
                    };
                } else {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("widget|capability|see_images_sent_this_room")
                                : _t("widget|capability|see_images_sent_active_room"),
                    };
                }
            }
            case MsgType.Video: {
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("widget|capability|send_videos_this_room")
                                : _t("widget|capability|send_videos_active_room"),
                    };
                } else {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("widget|capability|see_videos_sent_this_room")
                                : _t("widget|capability|see_videos_sent_active_room"),
                    };
                }
            }
            case MsgType.File: {
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("widget|capability|send_files_this_room")
                                : _t("widget|capability|send_files_active_room"),
                    };
                } else {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("widget|capability|see_sent_files_this_room")
                                : _t("widget|capability|see_sent_files_active_room"),
                    };
                }
            }
            default: {
                let primary: TranslatedString;
                if (eventCap.direction === EventDirection.Send) {
                    if (kind === WidgetKind.Room) {
                        primary = _t(
                            "widget|capability|send_msgtype_this_room",
                            {
                                msgtype: eventCap.keyStr,
                            },
                            {
                                b: (sub) => <strong>{sub}</strong>,
                            },
                        );
                    } else {
                        primary = _t(
                            "widget|capability|send_msgtype_active_room",
                            {
                                msgtype: eventCap.keyStr,
                            },
                            {
                                b: (sub) => <strong>{sub}</strong>,
                            },
                        );
                    }
                } else {
                    if (kind === WidgetKind.Room) {
                        primary = _t(
                            "widget|capability|see_msgtype_sent_this_room",
                            {
                                msgtype: eventCap.keyStr,
                            },
                            {
                                b: (sub) => <strong>{sub}</strong>,
                            },
                        );
                    } else {
                        primary = _t(
                            "widget|capability|see_msgtype_sent_active_room",
                            {
                                msgtype: eventCap.keyStr,
                            },
                            {
                                b: (sub) => <strong>{sub}</strong>,
                            },
                        );
                    }
                }
                return { primary };
            }
        }
    }
}
