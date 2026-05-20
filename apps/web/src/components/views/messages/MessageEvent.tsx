/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import mime from "mime";
import React, { createRef, type JSX, useEffect } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import {
    EventType,
    MsgType,
    MatrixEventEvent,
    M_BEACON_INFO,
    M_LOCATION,
    M_POLL_START,
    type IContent,
} from "matrix-js-sdk/src/matrix";
import { MjolnirBodyView, UnknownBodyView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import SettingsStore from "../../../settings/SettingsStore";
import { Mjolnir } from "../../../mjolnir/Mjolnir";
import { type IMediaBody } from "./IMediaBody";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { type IBodyProps } from "./IBodyProps";
import MVoiceOrAudioBody from "./MVoiceOrAudioBody";
import MStickerBody from "./MStickerBody";
import MPollBody from "./MPollBody";
import MLocationBody from "./MLocationBody";
import MBeaconBody from "./MBeaconBody";
import { type GetRelationsForEvent, type IEventTileOps } from "../rooms/EventTile";
import { MjolnirBodyViewModel } from "../../../viewmodels/room/timeline/event-tile/body/MjolnirBodyViewModel";
import {
    DecryptionFailureBodyFactory,
    FileBodyFactory,
    ImageBodyFactory,
    RedactedBodyFactory,
    VideoBodyFactory,
    renderMBody,
} from "./MBodyFactory";
import { TextualBodyFactory } from "./TextualBodyFactory";

// onMessageAllowed is handled internally
interface IProps extends Omit<IBodyProps, "onMessageAllowed" | "mediaEventHelper"> {
    /* overrides for the msgtype-specific components, used by ReplyTile to override file rendering */
    overrideBodyTypes?: Record<string, React.ComponentType<IBodyProps>>;
    overrideEventTypes?: Record<string, React.ComponentType<IBodyProps>>;

    // helper function to access relations for this event
    getRelationsForEvent?: GetRelationsForEvent;

    isSeeingThroughMessageHiddenForModeration?: boolean;

    /**
     * Optional ID for the root element.
     */
    id?: string;
}

export interface IOperableEventTile {
    getEventTileOps(): IEventTileOps | null;
}

const baseBodyTypes = new Map<string, React.ComponentType<IBodyProps>>([
    [MsgType.Text, TextualBodyFactory],
    [MsgType.Notice, TextualBodyFactory],
    [MsgType.Emote, TextualBodyFactory],
    [MsgType.Image, ImageBodyFactory],
    [MsgType.File, (props: IBodyProps) => renderMBody(props, FileBodyFactory)!],
    [MsgType.Audio, MVoiceOrAudioBody],
    [MsgType.Video, VideoBodyFactory],
]);
const baseEvTypes = new Map<string, React.ComponentType<IBodyProps>>([
    [EventType.Sticker, MStickerBody],
    [M_POLL_START.name, MPollBody],
    [M_POLL_START.altName, MPollBody],
    [M_BEACON_INFO.name, MBeaconBody],
    [M_BEACON_INFO.altName, MBeaconBody],
]);

function MjolnirBodyWrappedView({ mxEvent, onMessageAllowed, ref }: IBodyProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new MjolnirBodyViewModel({ mxEvent, onMessageAllowed }));

    useEffect(() => {
        vm.setEvent(mxEvent);
    }, [mxEvent, vm]);

    useEffect(() => {
        vm.setOnMessageAllowed(onMessageAllowed);
    }, [onMessageAllowed, vm]);

    return <MjolnirBodyView vm={vm} ref={ref} />;
}

function UnknownBody({ mxEvent, ref }: IBodyProps): JSX.Element {
    return <UnknownBodyView text={mxEvent.getContent().body} ref={ref} className="mx_UnknownBody" />;
}

/**
 * NOTE: we deliberately do NOT cache {@link MediaEventHelper}s across
 * `MessageEvent` mount cycles. The `LazyValue`s inside the helper cache the
 * FIRST resolved/rejected promise (see {@link LazyValue.value}) — so if the
 * very first download attempt fails (404 from the homeserver before the
 * authenticated-media service worker has intercepted, transient network
 * blip, etc.), every subsequent reuse of the same helper would replay the
 * same cached error, even though a fresh fetch attempt would succeed.
 *
 * The legacy timeline works around this implicitly by creating a fresh
 * helper per mount — each remount gets a fresh `LazyValue` and a fresh
 * download attempt. We do the same here.
 *
 * Instead, to keep the blob URLs alive long enough for the browser to
 * actually load the image after an unmount/remount race,
 * `componentWillUnmount` does NOT destroy the helper. The helper is allowed
 * to leak; its blob URLs eventually get GC'd along with the helper itself
 * when the `MatrixEvent` they reference goes away. This trades a small
 * per-event memory cost for image/video reliability.
 */

export default class MessageEvent extends React.Component<IProps> implements IMediaBody, IOperableEventTile {
    private body = createRef<React.Component | IOperableEventTile>();
    private mediaHelper?: MediaEventHelper;
    private bodyTypes = new Map<string, React.ComponentType<IBodyProps>>(baseBodyTypes.entries());
    private evTypes = new Map<string, React.ComponentType<IBodyProps>>(baseEvTypes.entries());

    public constructor(props: IProps) {
        super(props);

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
        // Deliberately NOT destroying the mediaHelper. `MediaEventHelper.destroy()`
        // revokes every blob URL the helper has issued — and the browser may
        // still be loading those URLs into the <img>/<video> at unmount time.
        // Revoking mid-load surfaces as "Error downloading image" / "Error
        // decrypting video" even though the data is fine. We accept a small
        // per-event memory leak (helpers persist for the session) in exchange
        // for media reliability across virtuoso virtualization-driven
        // mount/unmount cycles.
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (this.props.mxEvent !== prevProps.mxEvent && MediaEventHelper.isEligible(this.props.mxEvent)) {
            // New event entirely (the same component instance is being
            // reused for a different event). Switch to a fresh helper; the
            // old event's helper is left to GC.
            this.mediaHelper = new MediaEventHelper(this.props.mxEvent);
        }

        this.updateComponentMaps();
    }

    private updateComponentMaps(): void {
        this.bodyTypes = new Map<string, React.ComponentType<IBodyProps>>(baseBodyTypes.entries());
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
        // Fill in `mediaHelper` once decryption completes for the legacy
        // timeline path: there the constructor saw a wire-encrypted-pending
        // event so `isEligible` returned false. We DO NOT destroy and recreate
        // an existing helper here — re-emits of `Decrypted` (re-decryption
        // with a fresh key, internal SDK timeline re-emits) must not yank
        // blob URLs out from under any in-flight media download.
        if (this.mediaHelper) return;
        if (!MediaEventHelper.isEligible(this.props.mxEvent)) return;
        this.mediaHelper = new MediaEventHelper(this.props.mxEvent);
    };

    private onTileUpdate = (): void => {
        this.forceUpdate();
    };

    /**
     *  Validates that the filename extension and advertised mimetype
     *  of the supplied image/file message content match and are actuallly video/image content.
     *  For image/video messages with a thumbnail it also validates the mimetype is an image.
     * @param content The mxEvent content of the message
     * @returns A boolean indicating whether the validation passed
     */
    private validateImageOrVideoMimetype = (content: IContent): boolean => {
        // As per the spec if filename is not present the body represents the filename
        const filename = content.filename ?? content.body;
        if (!filename) {
            logger.log("Failed to validate image/video content, filename null");
            return false;
        }
        // Check mimetype of the thumbnail
        if (!this.validateThumbnailMimetype(content)) {
            logger.log("Failed to validate file/image thumbnail");
            return false;
        }

        // if there is no mimetype from the extesion or the mimetype is not image/video validation fails
        const typeFromExtension = mime.getType(filename) ?? undefined;
        const extensionMajorMimetype = this.parseMajorMimetype(typeFromExtension);
        if (!typeFromExtension || !this.validateAllowedMimetype(typeFromExtension, ["image", "video"])) {
            logger.log("Failed to validate image/video content, invalid or missing extension");
            return false;
        }

        // if the content mimetype is set check it is an image/video and that it matches the extesion mimetype otherwise validation fails
        const contentMimetype = content.info?.mimetype;
        if (contentMimetype) {
            const contentMajorMimetype = this.parseMajorMimetype(contentMimetype);
            if (
                !this.validateAllowedMimetype(contentMimetype, ["image", "video"]) ||
                extensionMajorMimetype !== contentMajorMimetype
            ) {
                logger.log("Failed to validate image/video content, invalid or missing mimetype");
                return false;
            }
        }
        return true;
    };

    /**
     *  Validates that the advertised mimetype of the sticker content
     *  is an image.
     *  For stickers with a thumbnail it also validates the mimetype is an image.
     * @param content The mxEvent content of the message
     * @returns A boolean indicating whether the validation passed
     */
    private validateStickerMimetype = (content: IContent): boolean => {
        // Validate mimetype of the thumbnail
        const thumbnailResult = this.validateThumbnailMimetype(content);
        if (!thumbnailResult) {
            logger.log("Failed to validate sticker thumbnail");
            return false;
        }
        // Validate mimetype of the content info is valid if it is set
        const contentMimetype = content.info?.mimetype;
        if (contentMimetype && !this.validateAllowedMimetype(contentMimetype, ["image"])) {
            logger.log("Failed to validate image/video content, invalid or missing mimetype/extensions");
            return false;
        }
        return true;
    };

    /**
     *  For image/video messages or stickers that have a thumnail mimetype specified,
     *  validates that the major mimetime is image.
     * @param content The mxEvent content of the message
     * @returns A boolean indicating whether the validation passed
     */
    private validateThumbnailMimetype = (content: IContent): boolean => {
        const thumbnailMimetype = content.info?.thumbnail_info?.mimetype;
        return !thumbnailMimetype || this.validateAllowedMimetype(thumbnailMimetype, ["image"]);
    };

    /**
     * Validates that the major part of a mimetime from an allowed list.
     * @param mimetype The mimetype to validate
     * @param allowedMajorMimeTypes The list of allowed major mimetimes
     * @returns A boolean indicating whether the validation passed
     */
    private validateAllowedMimetype = (mimetype: string, allowedMajorMimeTypes: string[]): boolean => {
        const majorMimetype = this.parseMajorMimetype(mimetype);
        return !!majorMimetype && allowedMajorMimeTypes.includes(majorMimetype);
    };

    /**
     * Parses and returns the the major part of a mimetype(before the "/").
     * @param mimetype As optional mimetype string to parse
     * @returns The major part of the mimetype string or undefined
     */
    private parseMajorMimetype(mimetype?: string): string | undefined {
        return mimetype?.split("/")[0];
    }

    public render(): React.ReactNode {
        const content = this.props.mxEvent.getContent();
        const type = this.props.mxEvent.getType();
        const msgtype = content.msgtype;
        let BodyType: React.ComponentType<IBodyProps> = RedactedBodyFactory;
        if (!this.props.mxEvent.isRedacted()) {
            // only resolve BodyType if event is not redacted
            if (this.props.mxEvent.isDecryptionFailure()) {
                BodyType = DecryptionFailureBodyFactory;
            } else if (type && this.evTypes.has(type)) {
                BodyType = this.evTypes.get(type)!;
            } else if (msgtype && this.bodyTypes.has(msgtype)) {
                BodyType = this.bodyTypes.get(msgtype)!;
            } else if (content.url) {
                // Fallback to file body if there's a content URL
                BodyType = this.bodyTypes.get(MsgType.File)!;
            } else {
                // Fallback to UnknownBody otherwise if not redacted
                BodyType = UnknownBody;
            }

            if (
                ((BodyType === ImageBodyFactory || BodyType === VideoBodyFactory) &&
                    !this.validateImageOrVideoMimetype(content)) ||
                (BodyType === MStickerBody && !this.validateStickerMimetype(content))
            ) {
                BodyType = this.bodyTypes.get(MsgType.File)!;
            }

            // TODO: move to eventTypes when location sharing spec stabilises
            if (M_LOCATION.matches(type) || (type === EventType.RoomMessage && msgtype === MsgType.Location)) {
                BodyType = MLocationBody;
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
                    BodyType = MjolnirBodyWrappedView;
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
            onMessageAllowed: this.onTileUpdate,
            permalinkCreator: this.props.permalinkCreator,
            mediaEventHelper: this.mediaHelper,
            getRelationsForEvent: this.props.getRelationsForEvent,
            isSeeingThroughMessageHiddenForModeration: this.props.isSeeingThroughMessageHiddenForModeration,
            inhibitInteraction: this.props.inhibitInteraction,
            id: this.props.id,
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
        <TextualBodyFactory {...{ ...props, ref: undefined }} />
    </div>
);
