/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, createRef, type SyntheticEvent, type MouseEvent, useCallback } from "react";
import { MsgType } from "matrix-js-sdk/src/matrix";
import {
    UrlPreviewGroupView,
    type UrlPreviewViewSnapshotPreview,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";

import EventContentBody from "./EventContentBody.tsx";
import { formatDate } from "../../../DateUtils";
import Modal from "../../../Modal";
import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import { tryTransformPermalinkToLocalHref } from "../../../utils/permalinks/Permalinks";
import { Action } from "../../../dispatcher/actions";
import QuestionDialog from "../dialogs/QuestionDialog";
import MessageEditHistoryDialog from "../dialogs/MessageEditHistoryDialog";
import EditMessageComposer from "../rooms/EditMessageComposer";
import { type IBodyProps } from "./IBodyProps";
import RoomContext from "../../../contexts/RoomContext";
import AccessibleButton from "../elements/AccessibleButton";
import { getParentEventId } from "../../../utils/Reply";
import { EditWysiwygComposer } from "../rooms/wysiwyg_composer";
import { type IEventTileOps } from "../rooms/EventTile";
import { UrlPreviewViewModel } from "../../../viewmodels/message-body/UrlPreviewViewModel.ts";
import { MatrixClientPeg } from "../../../MatrixClientPeg.ts";
import { useMediaVisible } from "../../../hooks/useMediaVisible.ts";
import ImageView from "../elements/ImageView.tsx";

class InnerTextualBody extends React.Component<IBodyProps & { urlPreviewViewModel: UrlPreviewViewModel }> {
    private readonly contentRef = createRef<HTMLDivElement>();

    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    public shouldComponentUpdate(nextProps: Readonly<IBodyProps>): boolean {
        // exploit that events are immutable :)
        return (
            nextProps.mxEvent.getId() !== this.props.mxEvent.getId() ||
            nextProps.highlights !== this.props.highlights ||
            nextProps.replacingEventId !== this.props.replacingEventId ||
            nextProps.highlightLink !== this.props.highlightLink ||
            nextProps.editState !== this.props.editState ||
            nextProps.isSeeingThroughMessageHiddenForModeration !== this.props.isSeeingThroughMessageHiddenForModeration
        );
    }

    private onEmoteSenderClick = (): void => {
        const mxEvent = this.props.mxEvent;
        dis.dispatch({
            action: Action.ComposerInsert,
            userId: mxEvent.getSender(),
            timelineRenderingType: this.context.timelineRenderingType,
        });
    };

    /**
     * This acts as a fallback in-app navigation handler for any body links that
     * were ignored as part of linkification because they were already links
     * to start with (e.g. pills, links in the content).
     */
    private onBodyLinkClick = (e: MouseEvent): void => {
        let target: HTMLLinkElement | null = e.target as HTMLLinkElement;
        // links processed by linkifyjs have their own handler so don't handle those here
        if (target.hasAttribute("data-linkified")) return;
        if (target.nodeName !== "A") {
            // Jump to parent as the `<a>` may contain children, e.g. an anchor wrapping an inline code section
            target = target.closest<HTMLLinkElement>("a");
        }
        if (!target) return;

        const localHref = tryTransformPermalinkToLocalHref(target.href);
        if (localHref !== target.href) {
            // it could be converted to a localHref -> therefore handle locally
            e.preventDefault();
            window.location.hash = localHref;
        }
    };

    public getEventTileOps = (): IEventTileOps => ({
        isWidgetHidden: () => {
            return this.props.urlPreviewViewModel.getSnapshot().hidden ?? false;
        },

        unhideWidget: () => {
            this.props.urlPreviewViewModel.onShowClick();
        },
    });

    private onStarterLinkClick = (starterLink: string, ev: SyntheticEvent): void => {
        ev.preventDefault();
        // We need to add on our scalar token to the starter link, but we may not have one!
        // In addition, we can't fetch one on click and then go to it immediately as that
        // is then treated as a popup!
        // We can get around this by fetching one now and showing a "confirmation dialog" (hurr hurr)
        // which requires the user to click through and THEN we can open the link in a new tab because
        // the window.open command occurs in the same stack frame as the onClick callback.

        const managers = IntegrationManagers.sharedInstance();
        if (!managers.hasManager()) {
            managers.openNoManagerDialog();
            return;
        }

        // Go fetch a scalar token
        const integrationManager = managers.getPrimaryManager();
        const scalarClient = integrationManager?.getScalarClient();
        scalarClient?.connect().then(() => {
            const completeUrl = scalarClient.getStarterLink(starterLink);
            const integrationsUrl = integrationManager!.uiUrl;
            const { finished } = Modal.createDialog(QuestionDialog, {
                title: _t("timeline|scalar_starter_link|dialog_title"),
                description: (
                    <div>
                        {_t("timeline|scalar_starter_link|dialog_description", { integrationsUrl: integrationsUrl })}
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
    };

    private openHistoryDialog = async (): Promise<void> => {
        Modal.createDialog(MessageEditHistoryDialog, { mxEvent: this.props.mxEvent });
    };

    private renderEditedMarker(): JSX.Element {
        const date = this.props.mxEvent.replacingEventDate();
        const dateString = date && formatDate(date);

        return (
            <AccessibleButton
                className="mx_EventTile_edited"
                onClick={this.openHistoryDialog}
                aria-label={_t("timeline|edits|tooltip_label", { date: dateString })}
                title={_t("timeline|edits|tooltip_title", { date: dateString })}
                caption={_t("timeline|edits|tooltip_sub")}
            >
                <span>{`(${_t("common|edited")})`}</span>
            </AccessibleButton>
        );
    }

    /**
     * Render a marker informing the user that, while they can see the message,
     * it is hidden for other users.
     */
    private renderPendingModerationMarker(): JSX.Element {
        let text;
        const visibility = this.props.mxEvent.messageVisibility();
        switch (visibility.visible) {
            case true:
                throw new Error("renderPendingModerationMarker should only be applied to hidden messages");
            case false:
                if (visibility.reason) {
                    text = _t("timeline|pending_moderation_reason", { reason: visibility.reason });
                } else {
                    text = _t("timeline|pending_moderation");
                }
                break;
        }
        return <span className="mx_EventTile_pendingModeration">{`(${text})`}</span>;
    }

    public componentDidMount(): void {
        console.log("url componentDidMount", this.props.mxEvent.getId());
        if (this.contentRef.current) {
            this.props.urlPreviewViewModel.updateEventElement(this.contentRef.current);
        }
    }

    public componentDidUpdate(): void {
        console.log("url componentDidUpdate", this.props.mxEvent.getId());
        if (this.contentRef.current && !this.props.editState) {
            console.log("Updating url preview");
            this.props.urlPreviewViewModel.updateEventElement(this.contentRef.current);
        }
    }

    public render(): React.ReactNode {
        if (this.props.editState) {
            const isWysiwygComposerEnabled = SettingsStore.getValue("feature_wysiwyg_composer");
            return isWysiwygComposerEnabled ? (
                <EditWysiwygComposer editorStateTransfer={this.props.editState} className="mx_EventTile_content" />
            ) : (
                <EditMessageComposer editState={this.props.editState} className="mx_EventTile_content" />
            );
        }
        const mxEvent = this.props.mxEvent;
        const content = mxEvent.getContent();
        const isNotice = content.msgtype === MsgType.Notice;
        const isEmote = content.msgtype === MsgType.Emote;
        const isCaption = [MsgType.Image, MsgType.File, MsgType.Audio, MsgType.Video].includes(
            content.msgtype as MsgType,
        );

        const willHaveWrapper =
            this.props.replacingEventId || this.props.isSeeingThroughMessageHiddenForModeration || isEmote;
        // only strip reply if this is the original replying event, edits thereafter do not have the fallback
        const stripReply = !mxEvent.replacingEvent() && !!getParentEventId(mxEvent);
        let body = (
            <EventContentBody
                as={willHaveWrapper ? "span" : "div"}
                includeDir={false}
                mxEvent={mxEvent}
                content={content}
                stripReply={stripReply}
                linkify
                highlights={this.props.highlights}
                ref={this.contentRef}
                renderTooltipsForAmbiguousLinks
                renderKeywordPills
                renderMentionPills
                renderCodeBlocks
                renderSpoilers
            />
        );

        if (this.props.replacingEventId) {
            body = (
                <div dir="auto" className="mx_EventTile_annotated">
                    {body}
                    {this.renderEditedMarker()}
                </div>
            );
        }
        if (this.props.isSeeingThroughMessageHiddenForModeration) {
            body = (
                <div dir="auto" className="mx_EventTile_annotated">
                    {body}
                    {this.renderPendingModerationMarker()}
                </div>
            );
        }

        if (this.props.highlightLink) {
            body = <a href={this.props.highlightLink}>{body}</a>;
        } else if (content.data && typeof content.data["org.matrix.neb.starter_link"] === "string") {
            body = (
                <AccessibleButton
                    kind="link_inline"
                    onClick={this.onStarterLinkClick.bind(this, content.data["org.matrix.neb.starter_link"])}
                >
                    {body}
                </AccessibleButton>
            );
        }

        const urlPreviewWidget = <UrlPreviewGroupView vm={this.props.urlPreviewViewModel} />;

        if (isEmote) {
            return (
                <div
                    id={this.props.id}
                    className="mx_MEmoteBody mx_EventTile_content"
                    onClick={this.onBodyLinkClick}
                    dir="auto"
                >
                    *&nbsp;
                    <span className="mx_MEmoteBody_sender" onClick={this.onEmoteSenderClick}>
                        {mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender()}
                    </span>
                    &nbsp;
                    {body}
                    {urlPreviewWidget}
                </div>
            );
        }
        if (isNotice) {
            return (
                <div id={this.props.id} className="mx_MNoticeBody mx_EventTile_content" onClick={this.onBodyLinkClick}>
                    {body}
                    {urlPreviewWidget}
                </div>
            );
        }
        if (isCaption) {
            return (
                <div id={this.props.id} className="mx_MTextBody mx_EventTile_caption" onClick={this.onBodyLinkClick}>
                    {body}
                    {urlPreviewWidget}
                </div>
            );
        }
        return (
            <div id={this.props.id} className="mx_MTextBody mx_EventTile_content" onClick={this.onBodyLinkClick}>
                {body}
                {urlPreviewWidget}
            </div>
        );
    }
}

export default function TextualBody(props: IBodyProps): React.ReactElement {
    const [mediaVisible] = useMediaVisible(props.mxEvent);

    /**
     * TODO: Ignore while editing.
     const stoppedEditing = prevProps.editState && !this.props.editState;
     const messageWasEdited = prevProps.replacingEventId !== this.props.replacingEventId;
     if (messageWasEdited || stoppedEditing) {
         this.urlPreviewVMRef.current?.recomputeSnapshot();
     }
     */

    const onUrlPreviewImageClicked = useCallback((preview: UrlPreviewViewSnapshotPreview): void => {
        if (!preview.image?.imageFull) {
            // Should never get this far, but doesn't hurt to check.
            return;
        }
        const params = {
            src: preview.image.imageFull,
            width: preview.image.width,
            height: preview.image.height,
            name: preview.title,
            fileSize: preview.image.fileSize,
            link: preview.link,
        };
        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
    }, []);

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new UrlPreviewViewModel({
                client: MatrixClientPeg.safeGet(),
                mxEvent: props.mxEvent,
                mediaVisible: mediaVisible,
                onImageClicked: onUrlPreviewImageClicked,
            }),
    );
    return <InnerTextualBody urlPreviewViewModel={vm} {...props} />;
}
