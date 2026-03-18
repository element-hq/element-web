/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import mime from "mime";
import React, { type JSX, createRef, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import {
    EventType,
    MsgType,
    MatrixEventEvent,
    M_BEACON_INFO,
    M_LOCATION,
    M_POLL_START,
    type IContent,
} from "matrix-js-sdk/src/matrix";
import {
    DecryptionFailureBodyView,
    EventContentBodyView,
    LINKIFIED_DATA_ATTRIBUTE,
    TextualBodyView,
    UrlPreviewGroupView,
    useCreateAutoDisposedViewModel,
    type TextualBodyContentElement,
    type UrlPreview,
} from "@element-hq/web-shared-components";

import { LocalDeviceVerificationStateContext } from "../../../contexts/LocalDeviceVerificationStateContext";
import SettingsStore from "../../../settings/SettingsStore";
import { Mjolnir } from "../../../mjolnir/Mjolnir";
import Modal from "../../../Modal";
import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import { tryTransformPermalinkToLocalHref } from "../../../utils/permalinks/Permalinks";
import { Action } from "../../../dispatcher/actions";
import QuestionDialog from "../dialogs/QuestionDialog";
import MessageEditHistoryDialog from "../dialogs/MessageEditHistoryDialog";
import RedactedBody from "./RedactedBody";
import UnknownBody from "./UnknownBody";
import { type IMediaBody } from "./IMediaBody";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { type IBodyProps } from "./IBodyProps";
import MImageBody from "./MImageBody";
import MVoiceOrAudioBody from "./MVoiceOrAudioBody";
import MVideoBody from "./MVideoBody";
import MStickerBody from "./MStickerBody";
import MPollBody from "./MPollBody";
import MLocationBody from "./MLocationBody";
import MjolnirBody from "./MjolnirBody";
import MBeaconBody from "./MBeaconBody";
import { type GetRelationsForEvent, type IEventTileOps } from "../rooms/EventTile";
import { DecryptionFailureBodyViewModel } from "../../../viewmodels/message-body/DecryptionFailureBodyViewModel";
import { EventContentBodyViewModel } from "../../../viewmodels/message-body/EventContentBodyViewModel";
import { TextualBodyViewModel } from "../../../viewmodels/message-body/TextualBodyViewModel";
import { UrlPreviewGroupViewModel } from "../../../viewmodels/message-body/UrlPreviewGroupViewModel";
import { FileBodyViewFactory, renderMBody } from "./MBodyFactory";
import RoomContext from "../../../contexts/RoomContext";
import { getParentEventId } from "../../../utils/Reply";
import { useMediaVisible } from "../../../hooks/useMediaVisible";
import ImageView from "../elements/ImageView";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import EditMessageComposer from "../rooms/EditMessageComposer";
import { EditWysiwygComposer } from "../rooms/wysiwyg_composer";

const logger = rootLogger;
const textualBodyLogger = rootLogger.getChild("TextualBody");

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

interface TextualBodyWrapperProps extends IBodyProps {
    onEventTileOpsChange?: (eventTileOps: IEventTileOps | null) => void;
}

const hasWrapperAroundEventContent = ({
    mxEvent,
    replacingEventId,
    isSeeingThroughMessageHiddenForModeration,
}: Pick<IBodyProps, "mxEvent" | "replacingEventId" | "isSeeingThroughMessageHiddenForModeration">): boolean =>
    !!replacingEventId ||
    !!isSeeingThroughMessageHiddenForModeration ||
    mxEvent.getContent().msgtype === MsgType.Emote;

const getStarterLink = (mxEvent: IBodyProps["mxEvent"]): string | undefined => {
    const starterLink = mxEvent.getContent().data?.["org.matrix.neb.starter_link"];
    return typeof starterLink === "string" ? starterLink : undefined;
};

function TextualBodyContentWrapper({
    mxEvent,
    highlights,
    highlightLink,
    showUrlPreview,
    replacingEventId,
    isSeeingThroughMessageHiddenForModeration,
    id,
    onEventTileOpsChange,
}: Readonly<TextualBodyWrapperProps>): JSX.Element {
    const roomContext = useContext(RoomContext);
    const client = useMatrixClientContext();
    const [mediaVisible] = useMediaVisible(mxEvent);
    const bodyRef = useRef<TextualBodyContentElement>(null);
    const willHaveWrapper = hasWrapperAroundEventContent({
        mxEvent,
        replacingEventId,
        isSeeingThroughMessageHiddenForModeration,
    });
    const stripReply = !mxEvent.replacingEvent() && !!getParentEventId(mxEvent);

    const onBodyLinkClick = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
        let target = event.target as HTMLAnchorElement | null;
        if (target?.dataset[LINKIFIED_DATA_ATTRIBUTE]) return;
        if (target?.nodeName !== "A") {
            target = target?.closest<HTMLAnchorElement>("a") ?? null;
        }
        if (!target) return;

        const localHref = tryTransformPermalinkToLocalHref(target.href);
        if (localHref !== target.href) {
            event.preventDefault();
            window.location.assign(localHref);
        }
    }, []);

    const onEmoteSenderClick = useCallback((): void => {
        dis.dispatch({
            action: Action.ComposerInsert,
            userId: mxEvent.getSender(),
            timelineRenderingType: roomContext.timelineRenderingType,
        });
    }, [mxEvent, roomContext.timelineRenderingType]);

    const onStarterLinkClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>): void => {
            event.preventDefault();

            const starterLink = getStarterLink(mxEvent);
            if (!starterLink) {
                return;
            }

            const managers = IntegrationManagers.sharedInstance();
            if (!managers.hasManager()) {
                managers.openNoManagerDialog();
                return;
            }

            const integrationManager = managers.getPrimaryManager();
            const scalarClient = integrationManager?.getScalarClient();
            scalarClient?.connect().then(() => {
                const completeUrl = scalarClient.getStarterLink(starterLink);
                const integrationsUrl = integrationManager!.uiUrl;
                const { finished } = Modal.createDialog(QuestionDialog, {
                    title: _t("timeline|scalar_starter_link|dialog_title"),
                    description: (
                        <div>
                            {_t("timeline|scalar_starter_link|dialog_description", { integrationsUrl })}
                        </div>
                    ),
                    button: _t("action|continue"),
                });

                finished.then(([confirmed]) => {
                    if (!confirmed) {
                        return;
                    }
                    const width = window.screen.width > 1024 ? 1024 : window.screen.width;
                    const height = window.screen.height > 800 ? 800 : window.screen.height;
                    const left = (window.screen.width - width) / 2;
                    const top = (window.screen.height - height) / 2;
                    const features = `height=${height}, width=${width}, top=${top}, left=${left},`;
                    const wnd = window.open(completeUrl, "_blank", features)!;
                    wnd.opener = null;
                });
            });
        },
        [mxEvent],
    );

    const openHistoryDialog = useCallback((): void => {
        Modal.createDialog(MessageEditHistoryDialog, { mxEvent });
    }, [mxEvent]);

    const onUrlPreviewImageClicked = useCallback((preview: UrlPreview): void => {
        if (!preview.image?.imageFull) {
            return;
        }

        Modal.createDialog(
            ImageView,
            {
                src: preview.image.imageFull,
                width: preview.image.width,
                height: preview.image.height,
                name: preview.title,
                fileSize: preview.image.fileSize,
                link: preview.link,
            },
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
    }, []);

    const eventContentVm = useCreateAutoDisposedViewModel(
        () =>
            new EventContentBodyViewModel({
                as: willHaveWrapper ? "span" : "div",
                includeDir: false,
                mxEvent,
                content: mxEvent.getContent(),
                stripReply,
                linkify: true,
                highlights,
                renderTooltipsForAmbiguousLinks: true,
                renderKeywordPills: true,
                renderMentionPills: true,
                renderCodeBlocks: true,
                renderSpoilers: true,
                client: roomContext.room?.client ?? null,
            }),
    );

    const textualVm = useCreateAutoDisposedViewModel(
        () =>
            new TextualBodyViewModel({
                mxEvent,
                id,
                highlightLink,
                replacingEventId,
                isSeeingThroughMessageHiddenForModeration,
                onRootClick: onBodyLinkClick,
                onBodyActionClick: onStarterLinkClick,
                onEditedMarkerClick: openHistoryDialog,
                onEmoteSenderClick,
            }),
    );

    const urlPreviewVm = useCreateAutoDisposedViewModel(
        () =>
            new UrlPreviewGroupViewModel({
                client,
                mxEvent,
                mediaVisible,
                onImageClicked: onUrlPreviewImageClicked,
                visible: showUrlPreview ?? false,
            }),
    );

    useEffect(() => {
        eventContentVm.setEventContent(mxEvent, mxEvent.getContent());
    }, [eventContentVm, mxEvent]);

    useEffect(() => {
        eventContentVm.setStripReply(stripReply);
    }, [eventContentVm, stripReply]);

    useEffect(() => {
        eventContentVm.setAs(willHaveWrapper ? "span" : "div");
    }, [eventContentVm, willHaveWrapper]);

    useEffect(() => {
        eventContentVm.setHighlights(highlights);
    }, [eventContentVm, highlights]);

    useEffect(() => {
        textualVm.setEvent(mxEvent);
    }, [textualVm, mxEvent]);

    useEffect(() => {
        textualVm.setId(id);
    }, [textualVm, id]);

    useEffect(() => {
        textualVm.setHighlightLink(highlightLink);
    }, [textualVm, highlightLink]);

    useEffect(() => {
        textualVm.setReplacingEventId(replacingEventId);
    }, [textualVm, replacingEventId]);

    useEffect(() => {
        textualVm.setIsSeeingThroughMessageHiddenForModeration(isSeeingThroughMessageHiddenForModeration);
    }, [textualVm, isSeeingThroughMessageHiddenForModeration]);

    useEffect(() => {
        textualVm.setHandlers({
            onRootClick: onBodyLinkClick,
            onBodyActionClick: onStarterLinkClick,
            onEditedMarkerClick: openHistoryDialog,
            onEmoteSenderClick,
        });
    }, [textualVm, onBodyLinkClick, onStarterLinkClick, openHistoryDialog, onEmoteSenderClick]);

    useEffect(() => {
        void (async (): Promise<void> => {
            try {
                await urlPreviewVm.updateHidden(showUrlPreview ?? false, mediaVisible);
            } catch (ex) {
                textualBodyLogger.warn("UrlPreviewViewModel failed to updateHidden", ex);
            }
        })();
    }, [urlPreviewVm, showUrlPreview, mediaVisible]);

    useEffect(() => {
        const contentElement = bodyRef.current;
        if (!contentElement) {
            return;
        }

        void (async (): Promise<void> => {
            try {
                await urlPreviewVm.updateEventElement(contentElement);
            } catch (ex) {
                textualBodyLogger.warn("UrlPreviewViewModel failed to updateEventElement", ex);
            }
        })();
    }, [urlPreviewVm, mxEvent, highlights, willHaveWrapper, replacingEventId, isSeeingThroughMessageHiddenForModeration]);

    const eventTileOps = useMemo<IEventTileOps>(
        () => ({
            isWidgetHidden: () => urlPreviewVm.isPreviewHiddenByUser,
            unhideWidget: () => {
                void (async (): Promise<void> => {
                    try {
                        await urlPreviewVm.onShowClick();
                    } catch (ex) {
                        textualBodyLogger.warn("UrlPreviewViewModel failed to onShowClick", ex);
                    }
                })();
            },
        }),
        [urlPreviewVm],
    );

    useEffect(() => {
        onEventTileOpsChange?.(eventTileOps);
        return () => {
            onEventTileOpsChange?.(null);
        };
    }, [eventTileOps, onEventTileOpsChange]);

    return (
        <TextualBodyView
            vm={textualVm}
            body={<EventContentBodyView vm={eventContentVm} as={willHaveWrapper ? "span" : "div"} />}
            bodyRef={bodyRef}
            urlPreviews={<UrlPreviewGroupView vm={urlPreviewVm} />}
        />
    );
}

function TextualBodyWrapper(props: Readonly<TextualBodyWrapperProps>): JSX.Element {
    if (props.editState) {
        return SettingsStore.getValue("feature_wysiwyg_composer") ? (
            <EditWysiwygComposer editorStateTransfer={props.editState} className="mx_EventTile_content" />
        ) : (
            <EditMessageComposer editState={props.editState} className="mx_EventTile_content" />
        );
    }

    return <TextualBodyContentWrapper {...props} />;
}

class TextualBodyBridge extends React.Component<IBodyProps> implements IOperableEventTile {
    private eventTileOps: IEventTileOps | null = null;

    private readonly setEventTileOps = (eventTileOps: IEventTileOps | null): void => {
        this.eventTileOps = eventTileOps;
    };

    public getEventTileOps = (): IEventTileOps | null => {
        return this.eventTileOps;
    };

    public render(): React.ReactNode {
        return <TextualBodyWrapper {...this.props} onEventTileOpsChange={this.setEventTileOps} />;
    }
}

const baseBodyTypes = new Map<string, React.ComponentType<IBodyProps>>([
    [MsgType.Text, TextualBodyBridge],
    [MsgType.Notice, TextualBodyBridge],
    [MsgType.Emote, TextualBodyBridge],
    [MsgType.Image, MImageBody],
    [MsgType.File, (props: IBodyProps) => renderMBody(props, FileBodyViewFactory)!],
    [MsgType.Audio, MVoiceOrAudioBody],
    [MsgType.Video, MVideoBody],
]);
const baseEvTypes = new Map<string, React.ComponentType<IBodyProps>>([
    [EventType.Sticker, MStickerBody],
    [M_POLL_START.name, MPollBody],
    [M_POLL_START.altName, MPollBody],
    [M_BEACON_INFO.name, MBeaconBody],
    [M_BEACON_INFO.altName, MBeaconBody],
]);

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
        let BodyType: React.ComponentType<IBodyProps> = RedactedBody;
        if (!this.props.mxEvent.isRedacted()) {
            // only resolve BodyType if event is not redacted
            if (this.props.mxEvent.isDecryptionFailure()) {
                BodyType = DecryptionFailureBodyWrapper;
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
                ((BodyType === MImageBody || BodyType == MVideoBody) && !this.validateImageOrVideoMimetype(content)) ||
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
        <TextualBodyWrapper {...props} />
    </div>
);

/**
 * Bridge decryption-failure events into the view model using current local verification state.
 * This wrapper can be removed after MessageEvent has been changed to a function component.
 */
function DecryptionFailureBodyWrapper({ mxEvent, ref }: IBodyProps): JSX.Element {
    const verificationState = useContext(LocalDeviceVerificationStateContext);
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new DecryptionFailureBodyViewModel({
                decryptionFailureCode: mxEvent.decryptionFailureReason,
                verificationState,
            }),
    );
    useEffect(() => {
        vm.setVerificationState(verificationState);
    }, [verificationState, vm]);
    return <DecryptionFailureBodyView vm={vm} ref={ref} className="mx_DecryptionFailureBody mx_EventTile_content" />;
}
