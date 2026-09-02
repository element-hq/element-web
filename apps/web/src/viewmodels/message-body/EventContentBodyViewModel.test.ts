/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { MsgType, PushRuleKind, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { type JSX } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { stubClient, mkStubRoom, mkEvent } from "test-utils";

import { EventContentBodyViewModel, type EventContentBodyViewModelProps } from "./EventContentBodyViewModel";
import { bodyToNode } from "../../HtmlUtils";
import {
    combineRenderers,
    mentionPillRenderer,
    keywordPillRenderer,
    ambiguousLinkTooltipRenderer,
    spoilerRenderer,
    codeBlockRenderer,
    customEmoteRenderer,
} from "../../renderer";
import PlatformPeg from "../../PlatformPeg";
import type BasePlatform from "../../BasePlatform";
import SettingsStore from "../../settings/SettingsStore";

vi.mock("../../HtmlUtils", async () => ({
    ...(await vi.importActual("../../HtmlUtils")),
    bodyToNode: vi.fn(),
}));

vi.mock("../../renderer", () => ({
    combineRenderers: vi.fn(),
    mentionPillRenderer: vi.fn(),
    keywordPillRenderer: vi.fn(),
    ambiguousLinkTooltipRenderer: vi.fn(),
    codeBlockRenderer: vi.fn(),
    spoilerRenderer: vi.fn(),
    customEmoteRenderer: { img: vi.fn() },
}));

vi.mock("../../PlatformPeg", () => ({
    __esModule: true,
    default: {
        get: vi.fn(),
        // Never resolves, matching the real PlatformPeg's behaviour when no platform has been `set()`.
        platformPromise: new Promise(() => {}),
    },
}));

const mockedBodyToNode = vi.mocked(bodyToNode);
const mockedCombineRenderers = vi.mocked(combineRenderers);
const mockedPlatformPeg = vi.mocked(PlatformPeg);
const mockedCustomEmoteRenderer = vi.mocked(customEmoteRenderer);

describe("EventContentBodyViewModel", () => {
    const defaultContent = {
        body: "Hello world",
        msgtype: MsgType.Text,
    };

    const defaultProps = (overrides: Partial<EventContentBodyViewModelProps> = {}): EventContentBodyViewModelProps => ({
        client: null,
        content: defaultContent,
        linkify: false,
        as: "span",
        renderCustomEmotes: false,
        ...overrides,
    });

    beforeEach(() => {
        mockedBodyToNode.mockReset();
        mockedCombineRenderers.mockReset();
        mockedPlatformPeg.get.mockReset();
        mockedPlatformPeg.get.mockReturnValue(null);
    });

    it("passes render options to bodyToNode", () => {
        const replacer = vi.fn();
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

    it("only adds the custom-emote renderer when interaction and media are enabled", () => {
        const replacer = vi.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Hello world",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });

        new EventContentBodyViewModel(defaultProps({ renderCustomEmotes: true, mediaIsVisible: true }));
        expect(mockedCombineRenderers).toHaveBeenCalledWith(mockedCustomEmoteRenderer);

        mockedCombineRenderers.mockClear();
        new EventContentBodyViewModel(defaultProps({ renderCustomEmotes: true, mediaIsVisible: false }));
        expect(mockedCombineRenderers).toHaveBeenCalledWith();
    });

    it("initializes setting-backed options from SettingsStore when omitted", () => {
        const replacer = vi.fn();
        const createReplacerFromOptions = vi.fn().mockReturnValue(replacer);
        mockedCombineRenderers.mockReturnValue(createReplacerFromOptions);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Hello world",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });
        const getValueSpy = vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
            if (settingName === "TextualBody.enableBigEmoji") return false;
            if (settingName === "Pill.shouldShowPillAvatar") return false;
            return true;
        });

        new EventContentBodyViewModel(defaultProps());

        expect(getValueSpy).toHaveBeenCalledWith("TextualBody.enableBigEmoji");
        expect(getValueSpy).toHaveBeenCalledWith("Pill.shouldShowPillAvatar");
        expect(mockedBodyToNode).toHaveBeenCalledWith(
            defaultContent,
            undefined,
            expect.objectContaining({ disableBigEmoji: true }),
        );
        expect(mockedCombineRenderers).toHaveBeenCalledWith();
        expect(createReplacerFromOptions).toHaveBeenCalledWith(
            expect.objectContaining({ shouldShowPillAvatar: false }),
        );
        getValueSpy.mockRestore();
    });

    it("uses the injected client to resolve the room for renderer context", () => {
        const replacer = vi.fn();
        const createReplacerFromOptions = vi.fn().mockReturnValue(replacer);
        mockedCombineRenderers.mockReturnValue(createReplacerFromOptions);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Hello world",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });
        const client = stubClient();
        const mxEvent = mkEvent({
            type: "m.room.message",
            room: "!room:example.org",
            user: "@user:example.org",
            content: defaultContent,
            event: true,
        });
        const room = mkStubRoom("!room:example.org", "Room", client) as Room;
        const getRoomSpy = vi.spyOn(client, "getRoom").mockReturnValue(room);

        new EventContentBodyViewModel(defaultProps({ mxEvent, client }));

        expect(getRoomSpy).toHaveBeenCalledWith("!room:example.org");
        expect(createReplacerFromOptions).toHaveBeenCalledWith(expect.objectContaining({ room }));
    });

    it("forces disableBigEmoji for emote events", () => {
        const replacer = vi.fn();
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
        const replacer = vi.fn();
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
        const replacer = vi.fn();
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
        const replacer = vi.fn();
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
        const replacer = vi.fn();
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
        const replacer = vi.fn();
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

    it("doesn't emit updates when setters are called with unchanged values", () => {
        const replacer = vi.fn();
        mockedCombineRenderers.mockReturnValue(() => replacer);
        mockedBodyToNode.mockReturnValue({
            strippedBody: "Initial",
            formattedBody: undefined,
            emojiBodyElements: undefined,
            className: "mx_EventTile_body",
        });

        const vm = new EventContentBodyViewModel(defaultProps());
        const previousSnapshot = vm.getSnapshot();
        const subscriber = vi.fn();

        vm.subscribe(subscriber);
        vm.setEventContent(undefined, defaultContent);
        vm.setAs("span");

        expect(subscriber).toHaveBeenCalledTimes(0);
        expect(vm.getSnapshot()).toEqual(previousSnapshot);
    });

    it("includes renderers based on options and platform capabilities", () => {
        const replacer = vi.fn();
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
        vi.spyOn(mxEvent, "getPushDetails").mockReturnValue({
            rule: {
                enabled: true,
                kind: PushRuleKind.ContentSpecific,
                pattern: "Hello",
            },
        } as unknown as ReturnType<MatrixEvent["getPushDetails"]>);
        vi.spyOn(client, "getRoom").mockReturnValue(mkStubRoom("!room:example.org", "Room", client) as Room);

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
        const replacer = vi.fn();
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
