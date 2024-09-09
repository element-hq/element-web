/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import {
    EventType,
    MsgType,
    MatrixEventEvent,
    M_BEACON_INFO,
    M_LOCATION,
    M_POLL_END,
    M_POLL_START,
} from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../../settings/SettingsStore";
import { Mjolnir } from "../../../mjolnir/Mjolnir";
import RedactedBody from "./RedactedBody";
import UnknownBody from "./UnknownBody";
import { IMediaBody } from "./IMediaBody";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { IBodyProps } from "./IBodyProps";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import TextualBody from "./TextualBody";
import MImageBody from "./MImageBody";
import MFileBody from "./MFileBody";
import MVoiceOrAudioBody from "./MVoiceOrAudioBody";
import MVideoBody from "./MVideoBody";
import MStickerBody from "./MStickerBody";
import MPollBody from "./MPollBody";
import { MPollEndBody } from "./MPollEndBody";
import MLocationBody from "./MLocationBody";
import MjolnirBody from "./MjolnirBody";
import MBeaconBody from "./MBeaconBody";
import { DecryptionFailureBody } from "./DecryptionFailureBody";
import { GetRelationsForEvent, IEventTileOps } from "../rooms/EventTile";
import { VoiceBroadcastBody, VoiceBroadcastInfoEventType, VoiceBroadcastInfoState } from "../../../voice-broadcast";

// onMessageAllowed is handled internally
interface IProps extends Omit<IBodyProps, "onMessageAllowed" | "mediaEventHelper"> {
    /* overrides for the msgtype-specific components, used by ReplyTile to override file rendering */
    overrideBodyTypes?: Record<string, typeof React.Component>;
    overrideEventTypes?: Record<string, typeof React.Component>;

    // helper function to access relations for this event
    getRelationsForEvent?: GetRelationsForEvent;

    isSeeingThroughMessageHiddenForModeration?: boolean;
}

export interface IOperableEventTile {
    getEventTileOps(): IEventTileOps | null;
}

const baseBodyTypes = new Map<string, typeof React.Component>([
    [MsgType.Text, TextualBody],
    [MsgType.Notice, TextualBody],
    [MsgType.Emote, TextualBody],
    [MsgType.Image, MImageBody],
    [MsgType.File, MFileBody],
    [MsgType.Audio, MVoiceOrAudioBody],
    [MsgType.Video, MVideoBody],
]);
const baseEvTypes = new Map<string, React.ComponentType<IBodyProps>>([
    [EventType.Sticker, MStickerBody],
    [M_POLL_START.name, MPollBody],
    [M_POLL_START.altName, MPollBody],
    [M_POLL_END.name, MPollEndBody],
    [M_POLL_END.altName, MPollEndBody],
    [M_BEACON_INFO.name, MBeaconBody],
    [M_BEACON_INFO.altName, MBeaconBody],
]);

export default class MessageEvent extends React.Component<IProps> implements IMediaBody, IOperableEventTile {
    private body: React.RefObject<React.Component | IOperableEventTile> = createRef();
    private mediaHelper?: MediaEventHelper;
    private bodyTypes = new Map<string, typeof React.Component>(baseBodyTypes.entries());
    private evTypes = new Map<string, React.ComponentType<IBodyProps>>(baseEvTypes.entries());

    public static contextType = MatrixClientContext;
    public declare context: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        if (MediaEventHelper.isEligible(this.props.mxEvent)) {
            this.mediaHelper = new MediaEventHelper(this.props.mxEvent);
        }

        this.updateComponentMaps();
    }

    public componentDidMount(): void {
        this.props.mxEvent.addListener(MatrixEventEvent.Decrypted, this.onDecrypted);
    }

    public componentWillUnmount(): void {
        this.props.mxEvent.removeListener(MatrixEventEvent.Decrypted, this.onDecrypted);
        this.mediaHelper?.destroy();
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (this.props.mxEvent !== prevProps.mxEvent && MediaEventHelper.isEligible(this.props.mxEvent)) {
            this.mediaHelper?.destroy();
            this.mediaHelper = new MediaEventHelper(this.props.mxEvent);
        }

        this.updateComponentMaps();
    }

    private updateComponentMaps(): void {
        this.bodyTypes = new Map<string, typeof React.Component>(baseBodyTypes.entries());
        for (const [bodyType, bodyComponent] of Object.entries(this.props.overrideBodyTypes ?? {})) {
            this.bodyTypes.set(bodyType, bodyComponent);
        }

        this.evTypes = new Map<string, React.ComponentType<IBodyProps>>(baseEvTypes.entries());
        for (const [evType, evComponent] of Object.entries(this.props.overrideEventTypes ?? {})) {
            this.evTypes.set(evType, evComponent);
        }
    }

    public getEventTileOps = (): IEventTileOps | null => {
        return (this.body.current as IOperableEventTile)?.getEventTileOps?.() || null;
    };

    public getMediaHelper(): MediaEventHelper | undefined {
        return this.mediaHelper;
    }

    private onDecrypted = (): void => {
        // Recheck MediaEventHelper eligibility as it can change when the event gets decrypted
        if (MediaEventHelper.isEligible(this.props.mxEvent)) {
            this.mediaHelper?.destroy();
            this.mediaHelper = new MediaEventHelper(this.props.mxEvent);
        }
    };

    private onTileUpdate = (): void => {
        this.forceUpdate();
    };

    public render(): React.ReactNode {
        const content = this.props.mxEvent.getContent();
        const type = this.props.mxEvent.getType();
        const msgtype = content.msgtype;
        let BodyType: React.ComponentType<IBodyProps> = RedactedBody;
        if (!this.props.mxEvent.isRedacted()) {
            // only resolve BodyType if event is not redacted
            if (this.props.mxEvent.isDecryptionFailure()) {
                BodyType = DecryptionFailureBody;
            } else if (type && this.evTypes.has(type)) {
                BodyType = this.evTypes.get(type)!;
            } else if (msgtype && this.bodyTypes.has(msgtype)) {
                BodyType = this.bodyTypes.get(msgtype)!;
            } else if (content.url) {
                // Fallback to MFileBody if there's a content URL
                BodyType = this.bodyTypes.get(MsgType.File)!;
            } else {
                // Fallback to UnknownBody otherwise if not redacted
                BodyType = UnknownBody;
            }

            // TODO: move to eventTypes when location sharing spec stabilises
            if (M_LOCATION.matches(type) || (type === EventType.RoomMessage && msgtype === MsgType.Location)) {
                BodyType = MLocationBody;
            }

            if (type === VoiceBroadcastInfoEventType && content?.state === VoiceBroadcastInfoState.Started) {
                BodyType = VoiceBroadcastBody;
            }
        }

        if (SettingsStore.getValue("feature_mjolnir")) {
            const key = `mx_mjolnir_render_${this.props.mxEvent.getRoomId()}__${this.props.mxEvent.getId()}`;
            const allowRender = localStorage.getItem(key) === "true";

            if (!allowRender) {
                const userDomain = this.props.mxEvent.getSender()?.split(":").slice(1).join(":");
                const userBanned = Mjolnir.sharedInstance().isUserBanned(this.props.mxEvent.getSender()!);
                const serverBanned = userDomain && Mjolnir.sharedInstance().isServerBanned(userDomain);

                if (userBanned || serverBanned) {
                    BodyType = MjolnirBody;
                }
            }
        }

        return BodyType ? (
            <BodyType
                ref={this.body}
                mxEvent={this.props.mxEvent}
                highlights={this.props.highlights}
                highlightLink={this.props.highlightLink}
                showUrlPreview={this.props.showUrlPreview}
                forExport={this.props.forExport}
                maxImageHeight={this.props.maxImageHeight}
                replacingEventId={this.props.replacingEventId}
                editState={this.props.editState}
                onHeightChanged={this.props.onHeightChanged}
                onMessageAllowed={this.onTileUpdate}
                permalinkCreator={this.props.permalinkCreator}
                mediaEventHelper={this.mediaHelper}
                getRelationsForEvent={this.props.getRelationsForEvent}
                isSeeingThroughMessageHiddenForModeration={this.props.isSeeingThroughMessageHiddenForModeration}
                inhibitInteraction={this.props.inhibitInteraction}
            />
        ) : null;
    }
}
