/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

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
    enableBigEmoji?: boolean;
    /**
     * Whether media is visible in the event.
     */
    mediaIsVisible?: boolean;
    /**
     * Whether to show pill avatars.
     */
    shouldShowPillAvatar?: boolean;
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
    private static readonly computeBodySnapshot = (
        props: EventContentBodyViewModelProps,
    ): Pick<EventContentBodyViewSnapshot, "body" | "formattedBody" | "className"> => {
        const { content, stripReply, highlights, linkify, enableBigEmoji, mediaIsVisible } = props;
        const isEmote = content.msgtype === MsgType.Emote;
        const { strippedBody, formattedBody, emojiBodyElements, className } = bodyToNode(content, highlights, {
            disableBigEmoji: isEmote || !enableBigEmoji,
            stripReplyFallback: stripReply,
            mediaIsVisible,
            linkify,
        });

        return {
            body: emojiBodyElements || strippedBody,
            formattedBody,
            className,
        };
    };

    private static readonly computeDir = (props: EventContentBodyViewModelProps): "auto" | undefined => {
        const { as, includeDir = true } = props;
        return as === "div" || includeDir ? "auto" : undefined;
    };

    private static readonly parseFormattedBody = (
        formattedBody: string,
        replacer?: Replacer,
    ): ReturnType<typeof parse> => parse(formattedBody, replacer ? { replace: replacer } : undefined);

    private static readonly computeSnapshot = (props: EventContentBodyViewModelProps): EventContentBodyViewSnapshot => {
        const { body, formattedBody, className } = EventContentBodyViewModel.computeBodySnapshot(props);
        const replacer = createReplacer(props);
        const dir = EventContentBodyViewModel.computeDir(props);

        return {
            body,
            formattedBody,
            replacer,
            parseFormattedBody: EventContentBodyViewModel.parseFormattedBody,
            className,
            dir,
        };
    };

    public constructor(props: EventContentBodyViewModelProps) {
        super(props, EventContentBodyViewModel.computeSnapshot(props));
    }

    public setEventContent = (mxEvent: MatrixEvent | undefined, content: IContent): void => {
        this.props.mxEvent = mxEvent;
        this.props.content = content;
        const { body, formattedBody, className } = EventContentBodyViewModel.computeBodySnapshot(this.props);
        const replacer = createReplacer(this.props);

        this.snapshot.merge({ body, formattedBody, replacer, className });
    };

    public setStripReply = (stripReply?: boolean): void => {
        this.props.stripReply = stripReply;
        const { body, formattedBody, className } = EventContentBodyViewModel.computeBodySnapshot(this.props);

        this.snapshot.merge({ body, formattedBody, className });
    };

    public setHighlights = (highlights?: string[]): void => {
        this.props.highlights = highlights;
        const { body, formattedBody, className } = EventContentBodyViewModel.computeBodySnapshot(this.props);

        this.snapshot.merge({ body, formattedBody, className });
    };

    public setAs = (as: "span" | "div"): void => {
        this.props.as = as;
        const dir = EventContentBodyViewModel.computeDir(this.props);

        this.snapshot.merge({ dir });
    };

    public setEnableBigEmoji = (enableBigEmoji?: boolean): void => {
        this.props.enableBigEmoji = enableBigEmoji;
        const { body, formattedBody, className } = EventContentBodyViewModel.computeBodySnapshot(this.props);

        this.snapshot.merge({ body, formattedBody, className });
    };

    public setShouldShowPillAvatar = (shouldShowPillAvatar?: boolean): void => {
        this.props.shouldShowPillAvatar = shouldShowPillAvatar;
        const replacer = createReplacer(this.props);

        this.snapshot.merge({ replacer });
    };
}
