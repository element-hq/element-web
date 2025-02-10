/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type SyntheticEvent, type MouseEvent, StrictMode } from "react";
import { MsgType, PushRuleKind } from "matrix-js-sdk/src/matrix";
import { TooltipProvider } from "@vector-im/compound-web";
import { globToRegexp } from "matrix-js-sdk/src/utils";

import * as HtmlUtils from "../../../HtmlUtils";
import { formatDate } from "../../../DateUtils";
import Modal from "../../../Modal";
import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { pillifyLinks } from "../../../utils/pillify";
import { tooltipifyLinks } from "../../../utils/tooltipify";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import { isPermalinkHost, tryTransformPermalinkToLocalHref } from "../../../utils/permalinks/Permalinks";
import { Action } from "../../../dispatcher/actions";
import Spoiler from "../elements/Spoiler";
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
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import CodeBlock from "./CodeBlock";
import { Pill, PillType } from "../elements/Pill";
import { ReactRootManager } from "../../../utils/react";

interface IState {
    // the URLs (if any) to be previewed with a LinkPreviewWidget inside this TextualBody.
    links: string[];

    // track whether the preview widget is hidden
    widgetHidden: boolean;
}

export default class TextualBody extends React.Component<IBodyProps, IState> {
    private readonly contentRef = createRef<HTMLDivElement>();

    private pills = new ReactRootManager();
    private tooltips = new ReactRootManager();
    private reactRoots = new ReactRootManager();

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
        // Function is only called from render / componentDidMount → contentRef is set
        const content = this.contentRef.current!;

        this.activateSpoilers([content]);

        HtmlUtils.linkifyElement(content);
        pillifyLinks(MatrixClientPeg.safeGet(), [content], this.props.mxEvent, this.pills);

        this.calculateUrlPreview();

        // tooltipifyLinks AFTER calculateUrlPreview because the DOM inside the tooltip
        // container is empty before the internal component has mounted so calculateUrlPreview
        // won't find any anchors
        tooltipifyLinks([content], [...this.pills.elements, ...this.reactRoots.elements], this.tooltips);

        if (this.props.mxEvent.getContent().format === "org.matrix.custom.html") {
            // Handle expansion and add buttons
            const pres = [...content.getElementsByTagName("pre")];
            if (pres && pres.length > 0) {
                for (let i = 0; i < pres.length; i++) {
                    // If there already is a div wrapping the codeblock we want to skip this.
                    // This happens after the codeblock was edited.
                    if (pres[i].parentElement?.className == "mx_EventTile_pre_container") continue;
                    // Add code element if it's missing since we depend on it
                    if (pres[i].getElementsByTagName("code").length == 0) {
                        this.addCodeElement(pres[i]);
                    }
                    // Wrap a div around <pre> so that the copy button can be correctly positioned
                    // when the <pre> overflows and is scrolled horizontally.
                    this.wrapPreInReact(pres[i]);
                }
            }
        }

        // Highlight notification keywords using pills
        const pushDetails = this.props.mxEvent.getPushDetails();
        if (
            pushDetails.rule?.enabled &&
            pushDetails.rule.kind === PushRuleKind.ContentSpecific &&
            pushDetails.rule.pattern
        ) {
            this.pillifyNotificationKeywords([content], this.regExpForKeywordPattern(pushDetails.rule.pattern));
        }
    }

    private addCodeElement(pre: HTMLPreElement): void {
        const code = document.createElement("code");
        code.append(...pre.childNodes);
        pre.appendChild(code);
    }

    private wrapPreInReact(pre: HTMLPreElement): void {
        const root = document.createElement("div");
        root.className = "mx_EventTile_pre_container";

        // Insert containing div in place of <pre> block
        pre.replaceWith(root);

        this.reactRoots.render(
            <StrictMode>
                <CodeBlock onHeightChanged={this.props.onHeightChanged}>{pre}</CodeBlock>
            </StrictMode>,
            root,
            pre,
        );
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

    public componentWillUnmount(): void {
        this.pills.unmount();
        this.tooltips.unmount();
        this.reactRoots.unmount();
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

    private activateSpoilers(nodes: ArrayLike<Element>): void {
        let node = nodes[0];
        while (node) {
            if (node.tagName === "SPAN" && typeof node.getAttribute("data-mx-spoiler") === "string") {
                const spoilerContainer = document.createElement("span");

                const reason = node.getAttribute("data-mx-spoiler") ?? undefined;
                node.removeAttribute("data-mx-spoiler"); // we don't want to recurse
                const spoiler = (
                    <StrictMode>
                        <TooltipProvider>
                            <Spoiler reason={reason} contentHtml={node.outerHTML} />
                        </TooltipProvider>
                    </StrictMode>
                );

                this.reactRoots.render(spoiler, spoilerContainer, node);

                node.replaceWith(spoilerContainer);
                node = spoilerContainer;
            }

            if (node.childNodes && node.childNodes.length) {
                this.activateSpoilers(node.childNodes as NodeListOf<Element>);
            }

            node = node.nextSibling as Element;
        }
    }

    /**
     * Marks the text that activated a push-notification keyword pattern.
     */
    private pillifyNotificationKeywords(nodes: ArrayLike<Element>, exp: RegExp): void {
        let node: Node | null = nodes[0];
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.nodeValue;
                if (!text) {
                    node = node.nextSibling;
                    continue;
                }
                const match = text.match(exp);
                if (!match || match.length < 3) {
                    node = node.nextSibling;
                    continue;
                }
                const keywordText = match[2];
                const idx = match.index! + match[1].length;
                const before = text.substring(0, idx);
                const after = text.substring(idx + keywordText.length);

                const container = document.createElement("span");
                const newContent = (
                    <>
                        {before}
                        <TooltipProvider>
                            <Pill text={keywordText} type={PillType.Keyword} />
                        </TooltipProvider>
                        {after}
                    </>
                );
                this.reactRoots.render(newContent, container, node);

                node.parentNode?.replaceChild(container, node);
            } else if (node.childNodes && node.childNodes.length) {
                this.pillifyNotificationKeywords(node.childNodes as NodeListOf<Element>, exp);
            }

            node = node.nextSibling;
        }
    }

    private regExpForKeywordPattern(pattern: string): RegExp {
        // Reflects the push notification pattern-matching implementation at
        // https://github.com/matrix-org/matrix-js-sdk/blob/dbd7d26968b94700827bac525c39afff2c198e61/src/pushprocessor.ts#L570
        return new RegExp("(^|\\W)(" + globToRegexp(pattern) + ")(\\W|$)", "i");
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

        const htmlOpts = {
            disableBigEmoji: isEmote || !SettingsStore.getValue("TextualBody.enableBigEmoji"),
            // Part of Replies fallback support
            stripReplyFallback: stripReply,
        };
        let body = willHaveWrapper
            ? HtmlUtils.bodyToSpan(content, this.props.highlights, htmlOpts, this.contentRef, false)
            : HtmlUtils.bodyToDiv(content, this.props.highlights, htmlOpts, this.contentRef);

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
                    onHeightChanged={this.props.onHeightChanged}
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
