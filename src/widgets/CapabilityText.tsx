/*
Copyright 2020 - 2021 The Matrix.org Foundation C.I.C.

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

import {
    Capability,
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
import { EventType, MsgType } from "matrix-js-sdk/src/@types/event";
import React from "react";

import { _t, _td, TranslatedString } from "../languageHandler";
import { ElementWidgetCapabilities } from "../stores/widgets/ElementWidgetCapabilities";
import { MatrixClientPeg } from "../MatrixClientPeg";
import TextWithTooltip from "../components/views/elements/TextWithTooltip";

type GENERIC_WIDGET_KIND = "generic"; // eslint-disable-line @typescript-eslint/naming-convention
const GENERIC_WIDGET_KIND: GENERIC_WIDGET_KIND = "generic";

type SendRecvStaticCapText = Partial<
    Record<EventType | string, Partial<Record<WidgetKind | GENERIC_WIDGET_KIND, Record<EventDirection, string>>>>
>;

export interface TranslatedCapabilityText {
    primary: TranslatedString;
    byline?: TranslatedString;
}

export class CapabilityText {
    private static simpleCaps: Record<Capability, Partial<Record<WidgetKind | GENERIC_WIDGET_KIND, string>>> = {
        [MatrixCapabilities.AlwaysOnScreen]: {
            [WidgetKind.Room]: _td("Remain on your screen when viewing another room, when running"),
            [GENERIC_WIDGET_KIND]: _td("Remain on your screen while running"),
        },
        [MatrixCapabilities.StickerSending]: {
            [WidgetKind.Room]: _td("Send stickers into this room"),
            [GENERIC_WIDGET_KIND]: _td("Send stickers into your active room"),
        },
        [ElementWidgetCapabilities.CanChangeViewedRoom]: {
            [GENERIC_WIDGET_KIND]: _td("Change which room you're viewing"),
        },
        [MatrixCapabilities.MSC2931Navigate]: {
            [GENERIC_WIDGET_KIND]: _td("Change which room, message, or user you're viewing"),
        },
    };

    private static stateSendRecvCaps: SendRecvStaticCapText = {
        [EventType.RoomTopic]: {
            [WidgetKind.Room]: {
                [EventDirection.Send]: _td("Change the topic of this room"),
                [EventDirection.Receive]: _td("See when the topic changes in this room"),
            },
            [GENERIC_WIDGET_KIND]: {
                [EventDirection.Send]: _td("Change the topic of your active room"),
                [EventDirection.Receive]: _td("See when the topic changes in your active room"),
            },
        },
        [EventType.RoomName]: {
            [WidgetKind.Room]: {
                [EventDirection.Send]: _td("Change the name of this room"),
                [EventDirection.Receive]: _td("See when the name changes in this room"),
            },
            [GENERIC_WIDGET_KIND]: {
                [EventDirection.Send]: _td("Change the name of your active room"),
                [EventDirection.Receive]: _td("See when the name changes in your active room"),
            },
        },
        [EventType.RoomAvatar]: {
            [WidgetKind.Room]: {
                [EventDirection.Send]: _td("Change the avatar of this room"),
                [EventDirection.Receive]: _td("See when the avatar changes in this room"),
            },
            [GENERIC_WIDGET_KIND]: {
                [EventDirection.Send]: _td("Change the avatar of your active room"),
                [EventDirection.Receive]: _td("See when the avatar changes in your active room"),
            },
        },
        [EventType.RoomMember]: {
            [WidgetKind.Room]: {
                [EventDirection.Send]: _td("Remove, ban, or invite people to this room, and make you leave"),
                [EventDirection.Receive]: _td("See when people join, leave, or are invited to this room"),
            },
            [GENERIC_WIDGET_KIND]: {
                [EventDirection.Send]: _td("Remove, ban, or invite people to your active room, and make you leave"),
                [EventDirection.Receive]: _td("See when people join, leave, or are invited to your active room"),
            },
        },
    };

    private static nonStateSendRecvCaps: SendRecvStaticCapText = {
        [EventType.Sticker]: {
            [WidgetKind.Room]: {
                [EventDirection.Send]: _td("Send stickers to this room as you"),
                [EventDirection.Receive]: _td("See when a sticker is posted in this room"),
            },
            [GENERIC_WIDGET_KIND]: {
                [EventDirection.Send]: _td("Send stickers to your active room as you"),
                [EventDirection.Receive]: _td("See when anyone posts a sticker to your active room"),
            },
        },
    };

    private static bylineFor(eventCap: WidgetEventCapability): TranslatedString {
        if (eventCap.kind === EventKind.State) {
            return !eventCap.keyStr
                ? _t("with an empty state key")
                : _t("with state key %(stateKey)s", { stateKey: eventCap.keyStr });
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
                return { primary: _t("The above, but in any room you are joined or invited to as well") };
            } else {
                const roomId = getTimelineRoomIDFromCapability(capability);
                const room = MatrixClientPeg.get().getRoom(roomId);
                return {
                    primary: _t(
                        "The above, but in <Room /> as well",
                        {},
                        {
                            Room: () => {
                                if (room) {
                                    return (
                                        <TextWithTooltip tooltip={room.getCanonicalAlias() ?? roomId}>
                                            <b>{room.name}</b>
                                        </TextWithTooltip>
                                    );
                                } else {
                                    return (
                                        <b>
                                            <code>{roomId}</code>
                                        </b>
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
                            "Send <b>%(eventType)s</b> events as you in this room",
                            {
                                eventType: eventCap.eventType,
                            },
                            {
                                b: (sub) => <b>{sub}</b>,
                            },
                        ),
                        byline: CapabilityText.bylineFor(eventCap),
                    };
                } else {
                    return {
                        primary: _t(
                            "See <b>%(eventType)s</b> events posted to this room",
                            {
                                eventType: eventCap.eventType,
                            },
                            {
                                b: (sub) => <b>{sub}</b>,
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
                            "Send <b>%(eventType)s</b> events as you in your active room",
                            {
                                eventType: eventCap.eventType,
                            },
                            {
                                b: (sub) => <b>{sub}</b>,
                            },
                        ),
                        byline: CapabilityText.bylineFor(eventCap),
                    };
                } else {
                    return {
                        primary: _t(
                            "See <b>%(eventType)s</b> events posted to your active room",
                            {
                                eventType: eventCap.eventType,
                            },
                            {
                                b: (sub) => <b>{sub}</b>,
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
                "The <b>%(capability)s</b> capability",
                { capability },
                {
                    b: (sub) => <b>{sub}</b>,
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
                            ? _t("Send messages as you in this room")
                            : _t("Send messages as you in your active room"),
                };
            } else {
                return {
                    primary:
                        kind === WidgetKind.Room
                            ? _t("See messages posted to this room")
                            : _t("See messages posted to your active room"),
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
                                ? _t("Send text messages as you in this room")
                                : _t("Send text messages as you in your active room"),
                    };
                } else {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("See text messages posted to this room")
                                : _t("See text messages posted to your active room"),
                    };
                }
            }
            case MsgType.Emote: {
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("Send emotes as you in this room")
                                : _t("Send emotes as you in your active room"),
                    };
                } else {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("See emotes posted to this room")
                                : _t("See emotes posted to your active room"),
                    };
                }
            }
            case MsgType.Image: {
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("Send images as you in this room")
                                : _t("Send images as you in your active room"),
                    };
                } else {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("See images posted to this room")
                                : _t("See images posted to your active room"),
                    };
                }
            }
            case MsgType.Video: {
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("Send videos as you in this room")
                                : _t("Send videos as you in your active room"),
                    };
                } else {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("See videos posted to this room")
                                : _t("See videos posted to your active room"),
                    };
                }
            }
            case MsgType.File: {
                if (eventCap.direction === EventDirection.Send) {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("Send general files as you in this room")
                                : _t("Send general files as you in your active room"),
                    };
                } else {
                    return {
                        primary:
                            kind === WidgetKind.Room
                                ? _t("See general files posted to this room")
                                : _t("See general files posted to your active room"),
                    };
                }
            }
            default: {
                let primary: TranslatedString;
                if (eventCap.direction === EventDirection.Send) {
                    if (kind === WidgetKind.Room) {
                        primary = _t(
                            "Send <b>%(msgtype)s</b> messages as you in this room",
                            {
                                msgtype: eventCap.keyStr,
                            },
                            {
                                b: (sub) => <b>{sub}</b>,
                            },
                        );
                    } else {
                        primary = _t(
                            "Send <b>%(msgtype)s</b> messages as you in your active room",
                            {
                                msgtype: eventCap.keyStr,
                            },
                            {
                                b: (sub) => <b>{sub}</b>,
                            },
                        );
                    }
                } else {
                    if (kind === WidgetKind.Room) {
                        primary = _t(
                            "See <b>%(msgtype)s</b> messages posted to this room",
                            {
                                msgtype: eventCap.keyStr,
                            },
                            {
                                b: (sub) => <b>{sub}</b>,
                            },
                        );
                    } else {
                        primary = _t(
                            "See <b>%(msgtype)s</b> messages posted to your active room",
                            {
                                msgtype: eventCap.keyStr,
                            },
                            {
                                b: (sub) => <b>{sub}</b>,
                            },
                        );
                    }
                }
                return { primary };
            }
        }
    }
}
