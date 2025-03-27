/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, forwardRef, useContext, useMemo } from "react";
import { type IContent, type MatrixEvent, MsgType, PushRuleKind } from "matrix-js-sdk/src/matrix";
import parse from "html-react-parser";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";

import { bodyToNode } from "../../../HtmlUtils.tsx";
import { Linkify } from "../../../Linkify.tsx";
import PlatformPeg from "../../../PlatformPeg.ts";
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
    replacerToRenderFunction,
} from "../../../renderer";
import MatrixClientContext from "../../../contexts/MatrixClientContext.tsx";
import { useSettingValue } from "../../../hooks/useSettings.ts";
import { filterBoolean } from "../../../utils/arrays.ts";

/**
 * Returns a RegExp pattern for the keyword in the push rule of the given Matrix event, if any
 * @param mxEvent - the Matrix event to get the push rule keyword pattern from
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

interface ReplacerOptions {
    /**
     * Whether to render room/user mentions as pills
     */
    renderMentionPills?: boolean;
    /**
     * Whether to render push rule keywords as pills
     */
    renderKeywordPills?: boolean;
    /**
     * Whether to render spoilers as hidden content revealed on click
     */
    renderSpoilers?: boolean;
    /**
     * Whether to render code blocks as syntax highlighted code with a copy to clipboard button
     */
    renderCodeBlocks?: boolean;
    /**
     * Whether to render tooltips for ambiguous links, only effective on platforms which specify `needsUrlTooltips` true
     */
    renderTooltipsForAmbiguousLinks?: boolean;
}

// Returns a memoized Replacer based on the input parameters
const useReplacer = (content: IContent, mxEvent: MatrixEvent | undefined, options: ReplacerOptions): Replacer => {
    const cli = useContext(MatrixClientContext);
    const room = cli.getRoom(mxEvent?.getRoomId()) ?? undefined;

    const shouldShowPillAvatar = useSettingValue("Pill.shouldShowPillAvatar");
    const isHtml = content.format === "org.matrix.custom.html";

    const replacer = useMemo(() => {
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
    }, [
        mxEvent,
        options.renderMentionPills,
        options.renderKeywordPills,
        options.renderTooltipsForAmbiguousLinks,
        options.renderSpoilers,
        options.renderCodeBlocks,
        isHtml,
        room,
        shouldShowPillAvatar,
    ]);

    return replacer;
};

interface Props extends ReplacerOptions {
    /**
     * Whether to render the content in a div or span
     */
    as: "span" | "div";
    /**
     * Whether to render links as clickable anchors
     */
    linkify: boolean;
    /**
     * The Matrix event to render, required for renderMentionPills & renderKeywordPills
     */
    mxEvent?: MatrixEvent;
    /**
     * The content to render
     */
    content: IContent;
    /**
     * Whether to strip reply fallbacks from the content before rendering
     */
    stripReply?: boolean;
    /**
     * Highlights to emphasise in the content
     */
    highlights?: string[];
    /**
     * Whether to include the `dir="auto"` attribute on the rendered element
     */
    includeDir?: boolean;
}

/**
 * Component to render a Matrix event's content body.
 * If the content is formatted HTML then it will be sanitised before rendering.
 * A number of rendering features are supported as configured by {@link ReplacerOptions}
 * Returns a div or span depending on `as`, the `dir` on a `div` is always set to `"auto"` but set by `includeDir` otherwise.
 */
const EventContentBody = memo(
    forwardRef<HTMLElement, Props>(
        ({ as, mxEvent, stripReply, content, linkify, highlights, includeDir = true, ...options }, ref) => {
            const enableBigEmoji = useSettingValue("TextualBody.enableBigEmoji");

            const replacer = useReplacer(content, mxEvent, options);
            const linkifyOptions = useMemo(
                () => ({
                    render: replacerToRenderFunction(replacer),
                }),
                [replacer],
            );

            const isEmote = content.msgtype === MsgType.Emote;

            const { strippedBody, formattedBody, emojiBodyElements, className } = useMemo(
                () =>
                    bodyToNode(content, highlights, {
                        disableBigEmoji: isEmote || !enableBigEmoji,
                        // Part of Replies fallback support
                        stripReplyFallback: stripReply,
                    }),
                [content, enableBigEmoji, highlights, isEmote, stripReply],
            );

            if (as === "div") includeDir = true; // force dir="auto" on divs

            const As = as;
            const body = formattedBody ? (
                <As ref={ref as any} className={className} dir={includeDir ? "auto" : undefined}>
                    {parse(formattedBody, {
                        replace: replacer,
                    })}
                </As>
            ) : (
                <As ref={ref as any} className={className} dir={includeDir ? "auto" : undefined}>
                    {applyReplacerOnString(emojiBodyElements || strippedBody, replacer)}
                </As>
            );

            if (!linkify) return body;

            return <Linkify options={linkifyOptions}>{body}</Linkify>;
        },
    ),
);

export default EventContentBody;
