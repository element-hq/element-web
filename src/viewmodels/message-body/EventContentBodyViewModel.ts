/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactNode } from "react";
import { type IContent, type MatrixEvent, MsgType, PushRuleKind } from "matrix-js-sdk/src/matrix";
import parse from "html-react-parser";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";

import {
    BaseViewModel,
    type EventContentBodyViewSnapshot,
    type EventContentBodyViewModel as EventContentBodyViewModelInterface,
} from "@element-hq/web-shared-components";
import { bodyToNode } from "../../HtmlUtils";
import PlatformPeg from "../../PlatformPeg";
import {
    applyReplacerOnString,
    combineRenderers,
    type Replacer,
    type RendererMap,
    keywordPillRenderer,
    mentionPillRenderer,
    ambiguousLinkTooltipRenderer,
    codeBlockRenderer,
    spoilerRenderer,
} from "../../renderer";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { filterBoolean } from "../../utils/arrays";

/**
 * Options for configuring which renderers to apply.
 */
export interface ReplacerOptions {
    /**
     * Whether to render room/user mentions as pills.
     */
    renderMentionPills?: boolean;
    /**
     * Whether to render push rule keywords as pills.
     */
    renderKeywordPills?: boolean;
    /**
     * Whether to render spoilers as hidden content revealed on click.
     */
    renderSpoilers?: boolean;
    /**
     * Whether to render code blocks as syntax highlighted code with a copy to clipboard button.
     */
    renderCodeBlocks?: boolean;
    /**
     * Whether to render tooltips for ambiguous links, only effective on platforms which specify `needsUrlTooltips` true.
     */
    renderTooltipsForAmbiguousLinks?: boolean;
}

/**
 * Props for the EventContentBody ViewModel.
 */
export interface EventContentBodyViewModelProps extends ReplacerOptions {
    /**
     * The content to render.
     */
    content: IContent;
    /**
     * The Matrix event to render, required for renderMentionPills & renderKeywordPills.
     */
    mxEvent?: MatrixEvent;
    /**
     * Whether to strip reply fallbacks from the content before rendering.
     */
    stripReply?: boolean;
    /**
     * Highlights to emphasise in the content.
     */
    highlights?: string[];
    /**
     * Whether to render links as clickable anchors.
     */
    linkify: boolean;
    /**
     * Whether to include the `dir="auto"` attribute on the rendered element.
     * Always true for "div" elements.
     */
    includeDir?: boolean;
    /**
     * Whether to render the content in a div or span.
     */
    as: "span" | "div";
    /**
     * Whether big emoji should be enabled.
     */
    enableBigEmoji: boolean;
    /**
     * Whether media is visible in the event.
     */
    mediaIsVisible: boolean;
    /**
     * Whether to show pill avatars.
     */
    shouldShowPillAvatar: boolean;
}

/**
 * Returns a RegExp pattern for the keyword in the push rule of the given Matrix event, if any.
 */
const getPushDetailsKeywordPatternRegexp = (mxEvent: MatrixEvent): RegExp | undefined => {
    const pushDetails = mxEvent.getPushDetails();
    if (
        pushDetails.rule?.enabled &&
        pushDetails.rule.kind === PushRuleKind.ContentSpecific &&
        pushDetails.rule.pattern
    ) {
        return PushProcessor.getPushRuleGlobRegex(pushDetails.rule.pattern, true, "gi");
    }
    return undefined;
};

/**
 * Creates a replacer function based on the provided options and context.
 */
const createReplacer = (props: EventContentBodyViewModelProps): Replacer => {
    const { content, mxEvent, shouldShowPillAvatar, ...options } = props;
    const cli = MatrixClientPeg.get();
    const room = cli?.getRoom(mxEvent?.getRoomId()) ?? undefined;
    const isHtml = content.format === "org.matrix.custom.html";
    const keywordRegexpPattern = mxEvent ? getPushDetailsKeywordPatternRegexp(mxEvent) : undefined;

    const replacers = filterBoolean<RendererMap>([
        options.renderMentionPills ? mentionPillRenderer : undefined,
        options.renderKeywordPills && keywordRegexpPattern ? keywordPillRenderer : undefined,
        options.renderTooltipsForAmbiguousLinks && PlatformPeg.get()?.needsUrlTooltips()
            ? ambiguousLinkTooltipRenderer
            : undefined,
        options.renderSpoilers ? spoilerRenderer : undefined,
        options.renderCodeBlocks ? codeBlockRenderer : undefined,
    ]);

    return combineRenderers(...replacers)({
        isHtml,
        mxEvent,
        room,
        shouldShowPillAvatar,
        keywordRegexpPattern,
    });
};

/**
 * ViewModel for EventContentBody component.
 * Handles all Matrix SDK interactions and content processing.
 */
export class EventContentBodyViewModel
    extends BaseViewModel<EventContentBodyViewSnapshot, EventContentBodyViewModelProps>
    implements EventContentBodyViewModelInterface
{
    private static readonly computeSnapshot = (props: EventContentBodyViewModelProps): EventContentBodyViewSnapshot => {
        const {
            content,
            stripReply,
            highlights,
            linkify,
            includeDir = true,
            as,
            enableBigEmoji,
            mediaIsVisible,
        } = props;

        const isEmote = content.msgtype === MsgType.Emote;
        const replacer = createReplacer(props);

        const { strippedBody, formattedBody, emojiBodyElements, className } = bodyToNode(content, highlights, {
            disableBigEmoji: isEmote || !enableBigEmoji,
            stripReplyFallback: stripReply,
            mediaIsVisible,
            linkify,
        });

        // Force dir="auto" on divs
        const dir: "auto" | undefined = as === "div" || includeDir ? "auto" : undefined;

        // Render the content
        let children: ReactNode;
        if (formattedBody) {
            children = parse(formattedBody, {
                replace: replacer,
            });
        } else {
            children = applyReplacerOnString(emojiBodyElements || strippedBody, replacer);
        }

        return {
            children,
            className,
            dir,
        };
    };

    public constructor(props: EventContentBodyViewModelProps) {
        super(props, EventContentBodyViewModel.computeSnapshot(props));
    }

    private readonly setSnapshot = (): void => {
        this.snapshot.set(EventContentBodyViewModel.computeSnapshot(this.props));
    };

    /**
     * Updates the ViewModel's props and recomputes the snapshot.
     */
    public setProps(newProps: Partial<EventContentBodyViewModelProps>): void {
        this.props = { ...this.props, ...newProps };
        this.setSnapshot();
    }
}
