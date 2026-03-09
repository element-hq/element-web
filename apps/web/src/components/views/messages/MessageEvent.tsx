/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import mime from "mime";
import React, {
    type JSX,
    type MouseEventHandler,
    type ReactNode,
    type SyntheticEvent,
    createRef,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
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
import {
    useCreateAutoDisposedViewModel,
    DecryptionFailureBodyView,
    EventContentBodyView,
    TextualBodyView,
} from "@element-hq/web-shared-components";

import { LocalDeviceVerificationStateContext } from "../../../contexts/LocalDeviceVerificationStateContext";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import RoomContext from "../../../contexts/RoomContext";
import SettingsStore from "../../../settings/SettingsStore";
import { Mjolnir } from "../../../mjolnir/Mjolnir";
import RedactedBody from "./RedactedBody";
import UnknownBody from "./UnknownBody";
import { type IMediaBody } from "./IMediaBody";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { type IBodyProps } from "./IBodyProps";
import MImageBody from "./MImageBody";
import MFileBody from "./MFileBody";
import MVoiceOrAudioBody from "./MVoiceOrAudioBody";
import MVideoBody from "./MVideoBody";
import MStickerBody from "./MStickerBody";
import MPollBody from "./MPollBody";
import MLocationBody from "./MLocationBody";
import MjolnirBody from "./MjolnirBody";
import MBeaconBody from "./MBeaconBody";
import Modal from "../../../Modal";
import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import { isPermalinkHost, tryTransformPermalinkToLocalHref } from "../../../utils/permalinks/Permalinks";
import { Action } from "../../../dispatcher/actions";
import { options as linkifyOpts } from "../../../linkify-matrix";
import { getParentEventId } from "../../../utils/Reply";
import QuestionDialog from "../dialogs/QuestionDialog";
import MessageEditHistoryDialog from "../dialogs/MessageEditHistoryDialog";
import EditMessageComposer from "../rooms/EditMessageComposer";
import LinkPreviewGroup from "../rooms/LinkPreviewGroup";
import AccessibleButton from "../elements/AccessibleButton";
import { EditWysiwygComposer } from "../rooms/wysiwyg_composer";
import { EventContentBodyViewModel } from "../../../viewmodels/message-body/EventContentBodyViewModel";
import { TextualBodyViewModel } from "../../../viewmodels/message-body/TextualBodyViewModel";
import { type GetRelationsForEvent, type IEventTileOps } from "../rooms/EventTile";
import { DecryptionFailureBodyViewModel } from "../../../viewmodels/message-body/DecryptionFailureBodyViewModel";

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
    [MsgType.Image, MImageBody],
    [MsgType.File, MFileBody],
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

const TEXTUAL_MESSAGE_TYPES = new Set<string>([MsgType.Text, MsgType.Notice, MsgType.Emote]);

export default class MessageEvent extends React.Component<IProps> implements IMediaBody, IOperableEventTile {
    private body = createRef<React.Component | IOperableEventTile>();
    private mediaHelper?: MediaEventHelper;
    private bodyTypes = new Map<string, React.ComponentType<IBodyProps>>(baseBodyTypes.entries());
    private evTypes = new Map<string, React.ComponentType<IBodyProps>>(baseEvTypes.entries());
    private textualBodyEventTileOps: IEventTileOps | null = null;

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
        return (this.body.current as IOperableEventTile)?.getEventTileOps?.() || this.textualBodyEventTileOps || null;
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

    private setTextualBodyEventTileOps = (ops: IEventTileOps | null): void => {
        this.textualBodyEventTileOps = ops;
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
        const isTextualMessage = !!msgtype && TEXTUAL_MESSAGE_TYPES.has(msgtype);
        if (!this.props.mxEvent.isRedacted()) {
            // only resolve BodyType if event is not redacted
            if (this.props.mxEvent.isDecryptionFailure()) {
                BodyType = DecryptionFailureBodyWrapper;
            } else if (isTextualMessage) {
                BodyType = RedactedBody;
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

        if (isTextualMessage) {
            const { ref, ...textualBodyProps } = bodyProps;
            return (
                <TextualBodyWrapper
                    {...textualBodyProps}
                    onEventTileOpsChange={this.setTextualBodyEventTileOps}
                />
            );
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
        <TextualBodyWrapper {...{ ...props, ref: undefined }} />
    </div>
);

interface TextualBodyWrapperProps extends Omit<IBodyProps, "ref"> {
    onEventTileOpsChange?: (ops: IEventTileOps | null) => void;
}

function findLinks(nodes: ArrayLike<Element>): string[] {
    let links: string[] = [];

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.tagName === "A" && node.getAttribute("href")) {
            if (isLinkPreviewable(node)) {
                links.push(node.getAttribute("href")!);
            }
        } else if (node.tagName === "PRE" || node.tagName === "CODE" || node.tagName === "BLOCKQUOTE") {
            continue;
        } else if (node.children && node.children.length) {
            links = links.concat(findLinks(node.children));
        }
    }

    return links;
}

function isLinkPreviewable(node: Element): boolean {
    const href = node.getAttribute("href") ?? "";
    if (!href.startsWith("http://") && !href.startsWith("https://")) {
        return false;
    }

    const url = node.getAttribute("href");
    const host = url?.match(/^https?:\/\/(.*?)(\/|$)/)?.[1];

    if (!host || isPermalinkHost(host)) return false;

    if (node.textContent?.includes("/")) {
        return true;
    }

    return !node.textContent?.toLowerCase().trim().startsWith(host.toLowerCase());
}

export function TextualBodyWrapper({
    mxEvent,
    highlights,
    highlightLink,
    showUrlPreview,
    replacingEventId,
    editState,
    id,
    isSeeingThroughMessageHiddenForModeration,
    onEventTileOpsChange,
}: Readonly<TextualBodyWrapperProps>): JSX.Element {
    const roomContext = useContext(RoomContext);
    const client = useContext(MatrixClientContext);
    const contentRef = useRef<HTMLDivElement>(null);
    const [links, setLinks] = useState<string[]>([]);
    const [widgetHidden, setWidgetHidden] = useState(false);

    const content = mxEvent.getContent();
    const isEmote = content.msgtype === MsgType.Emote;
    const willHaveWrapper = !!replacingEventId || !!isSeeingThroughMessageHiddenForModeration || isEmote;
    const stripReply = !mxEvent.replacingEvent() && !!getParentEventId(mxEvent);
    const starterLink =
        content.data && typeof content.data["org.matrix.neb.starter_link"] === "string"
            ? content.data["org.matrix.neb.starter_link"]
            : undefined;
    const emoteSender = isEmote ? (mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender()) : undefined;
    const visibility = isSeeingThroughMessageHiddenForModeration ? mxEvent.messageVisibility() : undefined;
    const replacingEventDate = replacingEventId ? (mxEvent.replacingEventDate() ?? undefined) : undefined;

    const contentVm = useCreateAutoDisposedViewModel(
        () =>
            new EventContentBodyViewModel({
                as: willHaveWrapper ? "span" : "div",
                includeDir: false,
                mxEvent,
                content,
                stripReply,
                linkify: true,
                highlights,
                renderTooltipsForAmbiguousLinks: true,
                renderKeywordPills: true,
                renderMentionPills: true,
                renderCodeBlocks: true,
                renderSpoilers: true,
                client,
            }),
    );

    const onCancelClick = useCallback((): void => {
        setWidgetHidden(true);
        if (global.localStorage) {
            global.localStorage.setItem(`hide_preview_${mxEvent.getId()}`, "1");
        }
    }, [mxEvent]);

    const onEmoteSenderClick = useCallback<MouseEventHandler<HTMLButtonElement>>((): void => {
        dis.dispatch({
            action: Action.ComposerInsert,
            userId: mxEvent.getSender(),
            timelineRenderingType: roomContext.timelineRenderingType,
        });
    }, [mxEvent, roomContext.timelineRenderingType]);

    const onBodyClick = useCallback<MouseEventHandler<HTMLDivElement>>((event): void => {
        let target: HTMLLinkElement | null = event.target as HTMLLinkElement;
        if (target.classList.contains(linkifyOpts.className as string)) return;
        if (target.nodeName !== "A") {
            target = target.closest<HTMLLinkElement>("a");
        }
        if (!target) return;

        const localHref = tryTransformPermalinkToLocalHref(target.href);
        if (localHref !== target.href) {
            event.preventDefault();
            window.location.assign(localHref);
        }
    }, []);

    const onStarterLinkClick = useCallback((link: string, event: SyntheticEvent): void => {
        event.preventDefault();

        const managers = IntegrationManagers.sharedInstance();
        if (!managers.hasManager()) {
            managers.openNoManagerDialog();
            return;
        }

        const integrationManager = managers.getPrimaryManager();
        const scalarClient = integrationManager?.getScalarClient();
        scalarClient?.connect().then(() => {
            const completeUrl = scalarClient.getStarterLink(link);
            const integrationsUrl = integrationManager!.uiUrl;
            const { finished } = Modal.createDialog(QuestionDialog, {
                title: _t("timeline|scalar_starter_link|dialog_title"),
                description: <div>{_t("timeline|scalar_starter_link|dialog_description", { integrationsUrl })}</div>,
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
    }, []);

    const onEditedMarkerClick = useCallback<MouseEventHandler<HTMLButtonElement>>((): void => {
        Modal.createDialog(MessageEditHistoryDialog, { mxEvent });
    }, [mxEvent]);

    useEffect(() => {
        contentVm.setEventContent(mxEvent, content);
        contentVm.setStripReply(stripReply);
        contentVm.setAs(willHaveWrapper ? "span" : "div");
        contentVm.setHighlights(highlights);
    }, [content, contentVm, highlights, mxEvent, stripReply, willHaveWrapper]);

    const renderedContent = useMemo((): ReactNode => {
        let body = <EventContentBodyView vm={contentVm} as={willHaveWrapper ? "span" : "div"} ref={contentRef} />;

        if (highlightLink) {
            body = <a href={highlightLink}>{body}</a>;
        } else if (starterLink) {
            body = (
                <AccessibleButton kind="link_inline" onClick={(event): void => onStarterLinkClick(starterLink, event)}>
                    {body}
                </AccessibleButton>
            );
        }

        return body;
    }, [contentVm, highlightLink, onStarterLinkClick, starterLink, willHaveWrapper]);

    const widgets = useMemo(() => {
        if (!links.length || widgetHidden || !showUrlPreview) {
            return undefined;
        }

        return <LinkPreviewGroup links={links} mxEvent={mxEvent} onCancelClick={onCancelClick} />;
    }, [links, mxEvent, onCancelClick, showUrlPreview, widgetHidden]);

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new TextualBodyViewModel({
                id,
                msgType: content.msgtype,
                body: renderedContent,
                widgets,
                emoteSender,
                replacingEventId,
                replacingEventDate,
                isSeeingThroughMessageHiddenForModeration,
                pendingModerationReason: visibility?.reason,
                onBodyClick,
                onEditedMarkerClick,
                onEmoteSenderClick,
            }),
    );

    useLayoutEffect(() => {
        vm.setId(id);
        vm.setMessageContent({
            msgType: content.msgtype,
            body: renderedContent,
            emoteSender,
        });
        vm.setEditedState(replacingEventId, replacingEventDate);
        vm.setPendingModeration(isSeeingThroughMessageHiddenForModeration, visibility?.reason);
        vm.setWidgets(widgets);
        vm.setHandlers({
            onBodyClick,
            onEditedMarkerClick,
            onEmoteSenderClick,
        });
    }, [
        content.msgtype,
        emoteSender,
        id,
        isSeeingThroughMessageHiddenForModeration,
        onBodyClick,
        onEditedMarkerClick,
        onEmoteSenderClick,
        replacingEventDate,
        replacingEventId,
        renderedContent,
        visibility?.reason,
        vm,
        widgets,
    ]);

    useEffect(() => {
        if (editState || !showUrlPreview || !contentRef.current) {
            return;
        }

        let nextLinks = findLinks([contentRef.current]);
        if (nextLinks.length > 0) {
            nextLinks = Array.from(new Set(nextLinks));
            setLinks((previousLinks) =>
                previousLinks.length === nextLinks.length &&
                previousLinks.every((link, index) => link === nextLinks[index])
                    ? previousLinks
                    : nextLinks,
            );

            if (window.localStorage) {
                const hidden = !!window.localStorage.getItem(`hide_preview_${mxEvent.getId()}`);
                setWidgetHidden((previousHidden) => (previousHidden === hidden ? previousHidden : hidden));
            }
        } else {
            setLinks((previousLinks) => (previousLinks.length === 0 ? previousLinks : []));
        }
    }, [content.msgtype, editState, mxEvent, renderedContent, showUrlPreview]);

    useLayoutEffect(() => {
        onEventTileOpsChange?.({
            isWidgetHidden: () => {
                return widgetHidden;
            },
            unhideWidget: () => {
                setWidgetHidden(false);
                if (global.localStorage) {
                    global.localStorage.removeItem(`hide_preview_${mxEvent.getId()}`);
                }
            },
        });

        return () => {
            onEventTileOpsChange?.(null);
        };
    }, [mxEvent, onEventTileOpsChange, widgetHidden]);

    if (editState) {
        const isWysiwygComposerEnabled = SettingsStore.getValue("feature_wysiwyg_composer");
        return isWysiwygComposerEnabled ? (
            <EditWysiwygComposer editorStateTransfer={editState} className="mx_EventTile_content" />
        ) : (
            <EditMessageComposer editState={editState} className="mx_EventTile_content" />
        );
    }

    return <TextualBodyView vm={vm} />;
}

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
