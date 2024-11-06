/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import mime from "mime";
import React, { createRef } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import {
    EventType,
    MsgType,
    MatrixEventEvent,
    M_BEACON_INFO,
    M_LOCATION,
    M_POLL_END,
    M_POLL_START,
    IContent,
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

    /**
     *  Validates that the filename extension and advertised mimetype
     *  of the supplied image/file message content are not null, match and are actuallly video/image content.
     *  For image/video messages with a thumbnail it also validates the mimetype is an image.
     * @param content The mxEvent content of the message
     * @returns
     */
    private validateImageOrVideoMimetype = (content: IContent): boolean => {
        // As per the spec if filename is not present the body represents the filename
        const filename = content.filename ?? content.body;
        if (!filename) {
            logger.log("Failed to validate image/video content, filename null");
            return false;
        }
        // Validate mimetype of the thumbnail is valid
        const thumbnailResult = this.validateThumbnailMimeType(content);
        if (!thumbnailResult) {
            logger.log("Failed to validate file/image thumbnail");
            return false;
        }
        const typeFromExtension = mime.getType(filename);
        const majorContentTypeFromExtension = typeFromExtension?.split("/")[0];
        const allowedMajorContentTypes = ["image", "video"];

        // Validate mimetype of the extension is valid
        const result =
            !!majorContentTypeFromExtension && allowedMajorContentTypes.includes(majorContentTypeFromExtension);
        if (!result) {
            logger.log("Failed to validate image/video content, invalid or missing extension");
        }

        // Validate content mimetype is valid if it is set
        const contentMimetype = content.info?.mimetype;
        if (contentMimetype) {
            const majorContentTypeFromContent = contentMimetype?.split("/")[0];
            const result =
                !!majorContentTypeFromContent &&
                allowedMajorContentTypes.includes(majorContentTypeFromContent) &&
                majorContentTypeFromExtension == majorContentTypeFromContent;
            if (!result) {
                logger.log("Failed to validate image/video content, invalid or missing mimetype");
                return false;
            }
        }
        return true;
    };

    /**
     *  Validates that the advertised mimetype of the supplied sticker content
     *  is not null and is an image.
     *  For stickers with a thumbnail it also validates the mimetype is an image.
     * @param content The mxEvent content of the message
     * @returns
     */
    private validateStickerMimetype = (content: IContent): boolean => {
        // Validate mimetype of the thumbnail is valid
        const thumbnailResult = this.validateThumbnailMimeType(content);
        if (!thumbnailResult) {
            logger.log("Failed to validate sticker thumbnail");
            return false;
        }
        const contentMimetype = content.info?.mimetype;
        if (contentMimetype) {
            // Validate mimetype of the content is valid
            const majorContentTypeFromContent = contentMimetype?.split("/")[0];
            const result = majorContentTypeFromContent === "image";
            if (!result) {
                logger.log("Failed to validate image/video content, invalid or missing mimetype/extensions");
                return false;
            }
        }
        return true;
    };

    /**
     *  Validates the thumbnail assocaited with an image/video message or sticker
     *  is has an image mimetype.
     * @param content The mxEvent content of the message
     * @returns
     */
    private validateThumbnailMimeType = (content: IContent): boolean => {
        const thumbnailInfo = content.info?.thumbnail_info;
        if (thumbnailInfo) {
            const majorContentTypeFromThumbnail = thumbnailInfo.mimetype?.split("/")[0];
            if (!majorContentTypeFromThumbnail || majorContentTypeFromThumbnail !== "image") {
                logger.log("Failed to validate image/video content, thumbnail mimetype is not an image");
                return false;
            }
        }
        return true;
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
                if (type == EventType.Sticker && !this.validateStickerMimetype(content)) {
                    BodyType = this.bodyTypes.get(MsgType.File)!;
                } else {
                    BodyType = this.evTypes.get(type)!;
                }
            } else if (msgtype && this.bodyTypes.has(msgtype)) {
                if (
                    (msgtype == MsgType.Image || msgtype == MsgType.Video) &&
                    !this.validateImageOrVideoMimetype(content)
                ) {
                    BodyType = this.bodyTypes.get(MsgType.File)!;
                } else {
                    BodyType = this.bodyTypes.get(msgtype)!;
                }
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

        const hasCaption =
            [MsgType.Image, MsgType.File, MsgType.Audio, MsgType.Video].includes(msgtype as MsgType) &&
            content.filename &&
            content.filename !== content.body;
        const bodyProps: IBodyProps = {
            ref: this.body,
            mxEvent: this.props.mxEvent,
            highlights: this.props.highlights,
            highlightLink: this.props.highlightLink,
            showUrlPreview: this.props.showUrlPreview,
            forExport: this.props.forExport,
            maxImageHeight: this.props.maxImageHeight,
            replacingEventId: this.props.replacingEventId,
            editState: this.props.editState,
            onHeightChanged: this.props.onHeightChanged,
            onMessageAllowed: this.onTileUpdate,
            permalinkCreator: this.props.permalinkCreator,
            mediaEventHelper: this.mediaHelper,
            getRelationsForEvent: this.props.getRelationsForEvent,
            isSeeingThroughMessageHiddenForModeration: this.props.isSeeingThroughMessageHiddenForModeration,
            inhibitInteraction: this.props.inhibitInteraction,
        };
        if (hasCaption) {
            return <CaptionBody {...bodyProps} WrappedBodyType={BodyType} />;
        }

        return BodyType ? <BodyType {...bodyProps} /> : null;
    }
}

const CaptionBody: React.FunctionComponent<IBodyProps & { WrappedBodyType: React.ComponentType<IBodyProps> }> = ({
    WrappedBodyType,
    ...props
}) => (
    <div className="mx_EventTile_content">
        <WrappedBodyType {...props} />
        <TextualBody {...{ ...props, ref: undefined }} />
    </div>
);
