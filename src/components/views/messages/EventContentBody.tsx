/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, forwardRef, useContext, useMemo } from "react";
import { type IContent, type MatrixEvent, MsgType, PushRuleKind, type Room } from "matrix-js-sdk/src/matrix";
import parse from "html-react-parser";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";

import { Linkify, bodyToNode } from "../../../HtmlUtils.tsx";
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
} from "../../../renderer";
import MatrixClientContext from "../../../contexts/MatrixClientContext.tsx";
import { useSettingValue } from "../../../hooks/useSettings.ts";
import { filterBoolean } from "../../../utils/arrays.ts";

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
    renderMentionPills?: boolean;
    renderKeywordPills?: boolean;
    renderSpoilers?: boolean;
    renderCodeBlocks?: boolean;
    renderTooltipsForAmbiguousLinks?: boolean;
}

const useReplacer = (
    content: IContent,
    mxEvent: MatrixEvent | undefined,
    room: Room | undefined,
    onHeightChanged: (() => void) | undefined,
    options: ReplacerOptions,
): Replacer => {
    const shouldShowPillAvatar = useSettingValue("Pill.shouldShowPillAvatar");
    const isHtml = content.format === "org.matrix.custom.html";

    const replacer = useMemo(() => {
        const keywordRegexpPattern = mxEvent ? getPushDetailsKeywordPatternRegexp(mxEvent) : undefined;
        const replacers = filterBoolean<RendererMap>([
            options.renderMentionPills ? mentionPillRenderer : undefined,
            options.renderKeywordPills ? keywordPillRenderer : undefined,
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
            onHeightChanged,
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
        onHeightChanged,
    ]);

    return replacer;
};

interface Props extends ReplacerOptions {
    as: "span" | "div";
    linkify: boolean;
    mxEvent?: MatrixEvent;
    content: IContent;
    stripReply?: boolean;
    highlights?: string[];
    onHeightChanged?: () => void;
}

const EventContentBody = memo(
    forwardRef<HTMLElement, Props>(
        ({ as, mxEvent, stripReply, content, onHeightChanged, linkify, highlights, ...options }, ref) => {
            const cli = useContext(MatrixClientContext);
            const room = cli.getRoom(mxEvent?.getRoomId()) ?? undefined;
            const enableBigEmoji = useSettingValue("TextualBody.enableBigEmoji");

            const replacer = useReplacer(content, mxEvent, room, onHeightChanged, options);

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

            const As = as;
            const includeDir = As === "div" || 0;
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

            return <Linkify replacer={replacer}>{body}</Linkify>;
        },
    ),
);

export default EventContentBody;
