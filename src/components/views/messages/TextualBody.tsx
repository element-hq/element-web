/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, createRef, type SyntheticEvent, type MouseEvent } from "react";
import { MsgType } from "matrix-js-sdk/src/matrix";

import EventContentBody from "./EventContentBody.tsx";
import { formatDate } from "../../../DateUtils";
import Modal from "../../../Modal";
import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import { isPermalinkHost, tryTransformPermalinkToLocalHref } from "../../../utils/permalinks/Permalinks";
import { Action } from "../../../dispatcher/actions";
import QuestionDialog from "../dialogs/QuestionDialog";
import MessageEditHistoryDialog from "../dialogs/MessageEditHistoryDialog";
import EditMessageComposer from "../rooms/EditMessageComposer";
import LinkPreviewGroup from "../rooms/LinkPreviewGroup";
import { type IBodyProps } from "./IBodyProps";
import RoomContext from "../../../contexts/RoomContext";
import AccessibleButton from "../elements/AccessibleButton";
import { options as linkifyOpts } from "../../../linkify-matrix";
import { getParentEventId } from "../../../utils/Reply";
import { EditWysiwygComposer } from "../rooms/wysiwyg_composer";
import { type IEventTileOps } from "../rooms/EventTile";

interface IState {
    // the URLs (if any) to be previewed with a LinkPreviewWidget inside this TextualBody.
    links: string[];

    // track whether the preview widget is hidden
    widgetHidden: boolean;
}

export default class TextualBody extends React.Component<IBodyProps, IState> {
    private readonly contentRef = createRef<HTMLDivElement>();

    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    public state = {
        links: [],
        widgetHidden: false,
    };

    public componentDidMount(): void {
        if (!this.props.editState) {
            this.applyFormatting();
        }
    }

    private applyFormatting(): void {
        this.calculateUrlPreview();
    }

    public componentDidUpdate(prevProps: Readonly<IBodyProps>): void {
        if (!this.props.editState) {
            const stoppedEditing = prevProps.editState && !this.props.editState;
            const messageWasEdited = prevProps.replacingEventId !== this.props.replacingEventId;
            const urlPreviewChanged = prevProps.showUrlPreview !== this.props.showUrlPreview;
            if (messageWasEdited || stoppedEditing || urlPreviewChanged) {
                this.applyFormatting();
            }
        }
    }

    public shouldComponentUpdate(nextProps: Readonly<IBodyProps>, nextState: Readonly<IState>): boolean {
        //console.info("shouldComponentUpdate: ShowUrlPreview for %s is %s", this.props.mxEvent.getId(), this.props.showUrlPreview);

        // exploit that events are immutable :)
        return (
            nextProps.mxEvent.getId() !== this.props.mxEvent.getId() ||
            nextProps.highlights !== this.props.highlights ||
            nextProps.replacingEventId !== this.props.replacingEventId ||
            nextProps.highlightLink !== this.props.highlightLink ||
            nextProps.showUrlPreview !== this.props.showUrlPreview ||
            nextProps.editState !== this.props.editState ||
            nextState.links !== this.state.links ||
            nextState.widgetHidden !== this.state.widgetHidden ||
            nextProps.isSeeingThroughMessageHiddenForModeration !== this.props.isSeeingThroughMessageHiddenForModeration
        );
    }

    private calculateUrlPreview(): void {
        //console.info("calculateUrlPreview: ShowUrlPreview for %s is %s", this.props.mxEvent.getId(), this.props.showUrlPreview);

        if (this.props.showUrlPreview && this.contentRef.current) {
            // pass only the first child which is the event tile otherwise this recurses on edited events
            let links = this.findLinks([this.contentRef.current]);
            if (links.length) {
                // de-duplicate the links using a set here maintains the order
                links = Array.from(new Set(links));
                this.setState({ links });

                // lazy-load the hidden state of the preview widget from localstorage
                if (window.localStorage) {
                    const hidden = !!window.localStorage.getItem("hide_preview_" + this.props.mxEvent.getId());
                    this.setState({ widgetHidden: hidden });
                }
            } else if (this.state.links.length) {
                this.setState({ links: [] });
            }
        }
    }

    private findLinks(nodes: ArrayLike<Element>): string[] {
        let links: string[] = [];

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.tagName === "A" && node.getAttribute("href")) {
                if (this.isLinkPreviewable(node)) {
                    links.push(node.getAttribute("href")!);
                }
            } else if (node.tagName === "PRE" || node.tagName === "CODE" || node.tagName === "BLOCKQUOTE") {
                continue;
            } else if (node.children && node.children.length) {
                links = links.concat(this.findLinks(node.children));
            }
        }
        return links;
    }

    private isLinkPreviewable(node: Element): boolean {
        // don't try to preview relative links
        const href = node.getAttribute("href") ?? "";
        if (!href.startsWith("http://") && !href.startsWith("https://")) {
            return false;
        }

        const url = node.getAttribute("href");
        const host = url?.match(/^https?:\/\/(.*?)(\/|$)/)?.[1];

        // never preview permalinks (if anything we should give a smart
        // preview of the room/user they point to: nobody needs to be reminded
        // what the matrix.to site looks like).
        if (!host || isPermalinkHost(host)) return false;

        // as a random heuristic to avoid highlighting things like "foo.pl"
        // we require the linked text to either include a / (either from http://
        // or from a full foo.bar/baz style schemeless URL) - or be a markdown-style
        // link, in which case we check the target text differs from the link value.
        // TODO: make this configurable?
        if (node.textContent?.includes("/")) {
            return true;
        }

        if (node.textContent?.toLowerCase().trim().startsWith(host.toLowerCase())) {
            // it's a "foo.pl" style link
            return false;
        } else {
            // it's a [foo bar](http://foo.com) style link
            return true;
        }
    }

    private onCancelClick = (): void => {
        this.setState({ widgetHidden: true });
        // FIXME: persist this somewhere smarter than local storage
        if (global.localStorage) {
            global.localStorage.setItem("hide_preview_" + this.props.mxEvent.getId(), "1");
        }
        this.forceUpdate();
    };

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
        if (target.classList.contains(linkifyOpts.className as string)) return;
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
            return this.state.widgetHidden;
        },

        unhideWidget: () => {
            this.setState({ widgetHidden: false });
            if (global.localStorage) {
                global.localStorage.removeItem("hide_preview_" + this.props.mxEvent.getId());
            }
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
            Modal.createDialog(QuestionDialog, {
                title: _t("timeline|scalar_starter_link|dialog_title"),
                description: (
                    <div>
                        {_t("timeline|scalar_starter_link|dialog_description", { integrationsUrl: integrationsUrl })}
                    </div>
                ),
                button: _t("action|continue"),
                onFinished(confirmed) {
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
                },
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

        let widgets;
        if (this.state.links.length && !this.state.widgetHidden && this.props.showUrlPreview) {
            widgets = (
                <LinkPreviewGroup
                    links={this.state.links}
                    mxEvent={this.props.mxEvent}
                    onCancelClick={this.onCancelClick}
                />
            );
        }

        if (isEmote) {
            return (
                <div className="mx_MEmoteBody mx_EventTile_content" onClick={this.onBodyLinkClick} dir="auto">
                    *&nbsp;
                    <span className="mx_MEmoteBody_sender" onClick={this.onEmoteSenderClick}>
                        {mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender()}
                    </span>
                    &nbsp;
                    {body}
                    {widgets}
                </div>
            );
        }
        if (isNotice) {
            return (
                <div className="mx_MNoticeBody mx_EventTile_content" onClick={this.onBodyLinkClick}>
                    {body}
                    {widgets}
                </div>
            );
        }
        if (isCaption) {
            return (
                <div className="mx_MTextBody mx_EventTile_caption" onClick={this.onBodyLinkClick}>
                    {body}
                    {widgets}
                </div>
            );
        }
        return (
            <div className="mx_MTextBody mx_EventTile_content" onClick={this.onBodyLinkClick}>
                {body}
                {widgets}
            </div>
        );
    }
}
