/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { MsgType, PushRuleKind, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { type JSX } from "react";

import {
    EventContentBodyViewModel,
    type EventContentBodyViewModelProps,
} from "../../../src/viewmodels/message-body/EventContentBodyViewModel";
import { stubClient, mkStubRoom, mkEvent } from "../../test-utils";
import { bodyToNode } from "../../../src/HtmlUtils";
import {
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

jest.mock("../../../src/renderer", () => ({
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
        expect(snapshot.body).toBe("Hello world");
        expect(snapshot.replacer).toBe(replacer);
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

        const vm = new EventContentBodyViewModel(defaultProps());

        const snapshot = vm.getSnapshot();

        expect(snapshot.formattedBody).toBe("<b>Hello</b>");
        expect(snapshot.body).toBe("Hello world");
        expect(snapshot.replacer).toBe(replacer);
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

        const vm = new EventContentBodyViewModel(defaultProps());

        expect(vm.getSnapshot().body).toBe(emojiElements);
        expect(vm.getSnapshot().replacer).toBe(replacer);
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

        const vm = new EventContentBodyViewModel(defaultProps({ as: "span", includeDir: false }));

        expect(vm.getSnapshot().dir).toBeUndefined();
    });

    it("updates snapshot when setEventContent changes content", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Initial",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });

        const vm = new EventContentBodyViewModel(defaultProps());
        expect(vm.getSnapshot().body).toBe("Initial");

        mockedBodyToNode.mockReturnValue({
            strippedBody: "Updated",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });

        vm.setEventContent(undefined, { body: "Updated", msgtype: MsgType.Text });

        expect(vm.getSnapshot().body).toBe("Updated");
    });

    it("does not emit updates when setter values are unchanged", () => {
        const replacer = jest.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Initial",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });

        const vm = new EventContentBodyViewModel(defaultProps());
        const previousSnapshot = vm.getSnapshot();
        const subscriber = jest.fn();

        vm.subscribe(subscriber);
        vm.setEventContent(undefined, defaultContent);
        vm.setAs("span");

        expect(subscriber).not.toHaveBeenCalled();
        expect(vm.getSnapshot()).toBe(previousSnapshot);
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
