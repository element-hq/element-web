/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { MsgType, PushRuleKind, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import parse from "html-react-parser";
import { type JSX } from "react";

import {
    EventContentBodyViewModel,
    type EventContentBodyViewModelProps,
} from "../../../src/viewmodels/message-body/EventContentBodyViewModel";
import { stubClient, mkStubRoom, mkEvent } from "../../test-utils";
import { bodyToNode } from "../../../src/HtmlUtils";
import {
    applyReplacerOnString,
    combineRenderers,
    mentionPillRenderer,
    keywordPillRenderer,
    ambiguousLinkTooltipRenderer,
    spoilerRenderer,
    codeBlockRenderer,
} from "../../../src/renderer";
import PlatformPeg from "../../../src/PlatformPeg";
import type BasePlatform from "../../../src/BasePlatform";

jest.mock("../../../src/HtmlUtils", () => ({
    ...jest.requireActual("../../../src/HtmlUtils"),
    bodyToNode: jest.fn(),
}));

jest.mock("html-react-parser", () => jest.fn());

jest.mock("../../../src/renderer", () => ({
    applyReplacerOnString: jest.fn(),
    combineRenderers: jest.fn(),
    mentionPillRenderer: jest.fn(),
    keywordPillRenderer: jest.fn(),
    ambiguousLinkTooltipRenderer: jest.fn(),
    codeBlockRenderer: jest.fn(),
    spoilerRenderer: jest.fn(),
}));

jest.mock("../../../src/PlatformPeg", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
    },
}));

const mockedBodyToNode = jest.mocked(bodyToNode);
const mockedParse = jest.mocked(parse);
const mockedApplyReplacerOnString = jest.mocked(applyReplacerOnString);
const mockedCombineRenderers = jest.mocked(combineRenderers);
const mockedPlatformPeg = jest.mocked(PlatformPeg);

describe("EventContentBodyViewModel", () => {
    const defaultContent = {
        body: "Hello world",
        msgtype: MsgType.Text,
    };

    const defaultProps = (overrides: Partial<EventContentBodyViewModelProps> = {}): EventContentBodyViewModelProps => ({
        content: defaultContent,
        linkify: false,
        as: "span",
        ...overrides,
    });

    beforeEach(() => {
        mockedBodyToNode.mockReset();
        mockedParse.mockReset();
        mockedApplyReplacerOnString.mockReset();
        mockedCombineRenderers.mockReset();
        mockedPlatformPeg.get.mockReset();
        mockedPlatformPeg.get.mockReturnValue(null);
    });

    it("passes render options to bodyToNode", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Hello world",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });
        mockedApplyReplacerOnString.mockReturnValue("replaced-text");

        const vm = new EventContentBodyViewModel(
            defaultProps({
                linkify: true,
                stripReply: true,
                enableBigEmoji: true,
                mediaIsVisible: false,
            }),
        );
        const snapshot = vm.getSnapshot();

        expect(mockedBodyToNode).toHaveBeenCalledWith(defaultContent, undefined, {
            disableBigEmoji: false,
            stripReplyFallback: true,
            mediaIsVisible: false,
            linkify: true,
        });
        expect(mockedApplyReplacerOnString).toHaveBeenCalledWith("Hello world", replacer);
        expect(snapshot.children).toBe("replaced-text");
        expect(snapshot.className).toContain("mx_EventTile_body");
    });

    it("forces disableBigEmoji for emote events", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Emote",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });
        mockedApplyReplacerOnString.mockReturnValue("emote-text");

        new EventContentBodyViewModel(
            defaultProps({
                content: {
                    body: "Emote",
                    msgtype: MsgType.Emote,
                },
                enableBigEmoji: true,
            }),
        );

        expect(mockedBodyToNode).toHaveBeenCalledWith(
            { body: "Emote", msgtype: MsgType.Emote },
            undefined,
            expect.objectContaining({ disableBigEmoji: true }),
        );
    });

    it("uses parse when formattedBody is provided", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Hello world",
            formattedBody: "<b>Hello</b>",
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });
        mockedParse.mockReturnValue("parsed-html");

        const vm = new EventContentBodyViewModel(defaultProps());

        const snapshot = vm.getSnapshot();

        expect(mockedParse).toHaveBeenCalledWith("<b>Hello</b>", { replace: replacer });
        expect(mockedApplyReplacerOnString).not.toHaveBeenCalled();
        expect(snapshot.children).toBe("parsed-html");
    });

    it("uses emojiBodyElements when provided", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        const emojiElements = ["emoji"] as unknown as JSX.Element[];
        mockedBodyToNode.mockReturnValue({
            strippedBody: "ignored",
            formattedBody: undefined,
            emojiBodyElements: emojiElements,
            className: "mx_EventTile_body",
        });
        mockedApplyReplacerOnString.mockReturnValue("emoji-text");

        const vm = new EventContentBodyViewModel(defaultProps());

        expect(mockedApplyReplacerOnString).toHaveBeenCalledWith(emojiElements, replacer);
        expect(vm.getSnapshot().children).toBe("emoji-text");
    });

    it("sets dir to auto for div elements even when includeDir is false", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Hello world",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });
        mockedApplyReplacerOnString.mockReturnValue("replaced-text");

        const vm = new EventContentBodyViewModel(defaultProps({ as: "div", includeDir: false }));

        expect(vm.getSnapshot().dir).toBe("auto");
    });

    it("omits dir when includeDir is false on span elements", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Hello world",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });
        mockedApplyReplacerOnString.mockReturnValue("replaced-text");

        const vm = new EventContentBodyViewModel(defaultProps({ as: "span", includeDir: false }));

        expect(vm.getSnapshot().dir).toBeUndefined();
    });

    it("updates snapshot when setProps changes content", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Initial",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });
        mockedApplyReplacerOnString.mockReturnValueOnce("initial-text").mockReturnValueOnce("updated-text");

        const vm = new EventContentBodyViewModel(defaultProps());
        expect(vm.getSnapshot().children).toBe("initial-text");

        mockedBodyToNode.mockReturnValue({
            strippedBody: "Updated",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });

        vm.setProps({ content: { body: "Updated", msgtype: MsgType.Text } });

        expect(vm.getSnapshot().children).toBe("updated-text");
    });

    it("includes renderers based on options and platform capabilities", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Hello world",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });
        mockedPlatformPeg.get.mockReturnValue({ needsUrlTooltips: () => true } as unknown as BasePlatform);

        const client = stubClient();
        const mxEvent = mkEvent({
            type: "m.room.message",
            room: "!room:example.org",
            user: "@user:example.org",
            content: defaultContent,
            event: true,
        });
        jest.spyOn(mxEvent, "getPushDetails").mockReturnValue({
            rule: {
                enabled: true,
                kind: PushRuleKind.ContentSpecific,
                pattern: "Hello",
            },
        } as unknown as ReturnType<MatrixEvent["getPushDetails"]>);
        jest.spyOn(client, "getRoom").mockReturnValue(mkStubRoom("!room:example.org", "Room", client) as Room);

        new EventContentBodyViewModel(
            defaultProps({
                renderMentionPills: true,
                renderKeywordPills: true,
                renderTooltipsForAmbiguousLinks: true,
                renderSpoilers: true,
                renderCodeBlocks: true,
                mxEvent,
            }),
        );

        expect(mockedCombineRenderers).toHaveBeenCalledWith(
            mentionPillRenderer,
            keywordPillRenderer,
            ambiguousLinkTooltipRenderer,
            spoilerRenderer,
            codeBlockRenderer,
        );
    });

    it("skips tooltip renderer when platform does not need URL tooltips", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Hello world",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });
        mockedPlatformPeg.get.mockReturnValue({ needsUrlTooltips: () => false } as unknown as BasePlatform);

        new EventContentBodyViewModel(
            defaultProps({
                renderMentionPills: true,
                renderTooltipsForAmbiguousLinks: true,
            }),
        );

        expect(mockedCombineRenderers).toHaveBeenCalledWith(mentionPillRenderer);
    });
});
