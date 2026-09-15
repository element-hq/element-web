/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { act, render, screen, waitFor } from "test-utils-rtl";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import type { I18nApi } from "@element-hq/element-web-module-api";

import {
    getMockClientWithEventEmitter,
    getRoomContext,
    mkEvent,
    mkRoom,
    mockClientMethodsUser,
    mockPlatformPeg,
    unmockPlatformPeg,
} from "../../../../test/test-utils";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext";
import EditorStateTransfer from "../../../utils/EditorStateTransfer";
import SettingsStore from "../../../settings/SettingsStore";
import type { ModuleApi } from "../../../modules/Api";
import type EditorModel from "../../../editor/model";
import { type RoomMessageEventContent } from "../../../../@types/url-preview";
import { EditMessageComposerWrapper } from "./EditMessageComposerWrapper";

const BASIC_PREVIEW_OGDATA = {
    "og:title": "This is an example!",
    "og:description": "This is a description",
    "og:type": "document",
    "og:url": "https://example.org",
    "og:site_name": "Example.org",
};

const BUNDLE_ENTRY = {
    "matched_url": "https://example.org/bundled",
    "og:title": "Bundled preview",
    "og:description": "Came from the event",
    "og:url": "https://example.org/bundled",
};

/**
 * The props each composer was last rendered with. The wrapper's only job is to wire the URL
 * preview view model into whichever composer is in use, so the tests drive the callbacks it
 * hands down rather than a real composer. Each stand-in keeps the textbox role its real
 * counterpart has so the tests can find it the way a user would.
 */
interface ComposerProps {
    updateUrlPreviews?: (arg: never) => void;
    attachBundles?: (content: RoomMessageEventContent) => void;
    isUrlPreviewsModified?: boolean;
}
const plainComposerProps = vi.fn<(props: ComposerProps) => void>();
const wysiwygComposerProps = vi.fn<(props: ComposerProps) => void>();

const PLAIN_COMPOSER_LABEL = "Edit message";
const WYSIWYG_COMPOSER_LABEL = "Edit message with rich text";

vi.mock("./EditMessageComposer", () => ({
    default: (props: ComposerProps) => {
        plainComposerProps(props);
        return <div role="textbox" aria-label="Edit message" />;
    },
}));

vi.mock("./wysiwyg_composer", () => ({
    EditWysiwygComposer: (props: ComposerProps) => {
        wysiwygComposerProps(props);
        return <div role="textbox" aria-label="Edit message with rich text" />;
    },
}));

function lastProps(composer: typeof plainComposerProps): ComposerProps {
    expect(composer).toHaveBeenCalled();
    return composer.mock.lastCall![0];
}

describe("<EditMessageComposerWrapper />", () => {
    let client: MatrixClient;
    let originalMxModuleApi: ModuleApi;
    /** Settings enabled for the duration of a single test. */
    let enabledSettings: string[];

    beforeEach(() => {
        enabledSettings = [];
        plainComposerProps.mockClear();
        wysiwygComposerProps.mockClear();

        originalMxModuleApi = window.mxModuleApi;
        window.mxModuleApi = { i18n: {} as I18nApi } as ModuleApi;

        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            getUrlPreview: vi.fn().mockResolvedValue(BASIC_PREVIEW_OGDATA),
        });

        const realGetValue = SettingsStore.getValue;
        vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName, roomId, excludeDefault) => {
            if (enabledSettings.includes(settingName)) return true;
            // Keep the composer previews expanded so they are rendered.
            if (settingName === "composerUrlPreviewCollapsed") return false;
            return realGetValue(settingName, roomId, excludeDefault);
        });
    });

    afterEach(() => {
        window.mxModuleApi = originalMxModuleApi;
        unmockPlatformPeg();
        vi.restoreAllMocks();
    });

    function renderWrapper(content: object = { msgtype: "m.text", body: "original message" }): void {
        const editState = new EditorStateTransfer(
            mkEvent({ event: true, type: "m.room.message", user: "@alice:server.org", content }),
        );
        render(<EditMessageComposerWrapper mxClient={client} editState={editState} showUrlPreview={true} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={client}>
                    <ScopedRoomContextProvider
                        roomId="!foo:bar"
                        {...getRoomContext(mkRoom(client, "!foo:bar"), { showUrlPreview: true })}
                    >
                        {children}
                    </ScopedRoomContextProvider>
                </MatrixClientContext.Provider>
            ),
        });
    }

    it("should render the plain composer by default", () => {
        renderWrapper();
        expect(screen.getByRole("textbox", { name: PLAIN_COMPOSER_LABEL })).toBeInTheDocument();
        expect(screen.queryByRole("textbox", { name: WYSIWYG_COMPOSER_LABEL })).not.toBeInTheDocument();
        expect(lastProps(plainComposerProps).isUrlPreviewsModified).toBe(false);
    });

    it("should render the wysiwyg composer when that composer is enabled", () => {
        enabledSettings.push("feature_wysiwyg_composer");
        renderWrapper();
        expect(screen.getByRole("textbox", { name: WYSIWYG_COMPOSER_LABEL })).toBeInTheDocument();
        expect(screen.queryByRole("textbox", { name: PLAIN_COMPOSER_LABEL })).not.toBeInTheDocument();
        expect(lastProps(wysiwygComposerProps).isUrlPreviewsModified).toBe(false);
    });

    it("should preview links the plain composer reports", async () => {
        renderWrapper();
        act(() => {
            lastProps(plainComposerProps).updateUrlPreviews!({
                contentPlainText: "Look at https://example.org",
            } as EditorModel as never);
        });

        await waitFor(() => {
            expect(client.getUrlPreview).toHaveBeenCalledWith("https://example.org", expect.anything());
        });
        // The edit now differs from the event, so the composer is told it is modified.
        await waitFor(() => {
            expect(lastProps(plainComposerProps).isUrlPreviewsModified).toBe(true);
        });
    });

    it("should preview links the wysiwyg composer reports", async () => {
        enabledSettings.push("feature_wysiwyg_composer");
        renderWrapper();
        act(() => {
            lastProps(wysiwygComposerProps).updateUrlPreviews!("Look at https://example.org" as never);
        });

        await waitFor(() => {
            expect(client.getUrlPreview).toHaveBeenCalledWith("https://example.org", expect.anything());
        });
        await waitFor(() => {
            expect(lastProps(wysiwygComposerProps).isUrlPreviewsModified).toBe(true);
        });
    });

    it("should attach the previewed links as a bundle on the edited content", async () => {
        enabledSettings.push("feature_msc4095_url_preview_bundle");
        renderWrapper();
        act(() => {
            lastProps(plainComposerProps).updateUrlPreviews!({
                contentPlainText: "https://example.org",
            } as EditorModel as never);
        });
        await waitFor(() => {
            expect(client.getUrlPreview).toHaveBeenCalled();
        });

        const newContent = { msgtype: "m.text", body: "https://example.org" } as RoomMessageEventContent;
        await waitFor(() => {
            lastProps(plainComposerProps).attachBundles!(newContent);
            expect(newContent["com.beeper.linkpreviews"]).toEqual([
                expect.objectContaining({
                    "matched_url": "https://example.org",
                    "og:title": "This is an example!",
                    "og:description": "This is a description",
                }),
            ]);
        });
    });

    it("should attach an empty bundle when every preview has been removed", async () => {
        enabledSettings.push("feature_msc4095_url_preview_bundle");
        // The edited event opted out of previews, so its links are seeded as excluded.
        renderWrapper({
            "msgtype": "m.text",
            "body": "https://example.org",
            "com.beeper.linkpreviews": [],
        });

        const newContent = { msgtype: "m.text", body: "https://example.org" } as RoomMessageEventContent;
        await waitFor(() => {
            lastProps(plainComposerProps).attachBundles!(newContent);
            expect(newContent["com.beeper.linkpreviews"]).toEqual([]);
        });
        expect(client.getUrlPreview).not.toHaveBeenCalled();
    });

    it("should seed the previews from the edited event's own bundle", async () => {
        enabledSettings.push("feature_msc4095_url_preview_bundle");
        renderWrapper({
            "msgtype": "m.text",
            "body": `Look at ${BUNDLE_ENTRY.matched_url}`,
            "com.beeper.linkpreviews": [BUNDLE_ENTRY],
        });

        expect(await screen.findByText("Bundled preview")).toBeInTheDocument();
        // The bundle carries the metadata, so re-opening the edit composer does not refetch it.
        expect(client.getUrlPreview).not.toHaveBeenCalled();
        // Restoring an event's own previews is not a user modification.
        expect(lastProps(plainComposerProps).isUrlPreviewsModified).toBe(false);
    });

    it("should ask the platform whether links need tooltips", async () => {
        const platform = mockPlatformPeg({ needsUrlTooltips: vi.fn().mockReturnValue(true) });
        renderWrapper();
        act(() => {
            lastProps(plainComposerProps).updateUrlPreviews!({
                contentPlainText: "https://example.org",
            } as EditorModel as never);
        });

        await waitFor(() => {
            expect(client.getUrlPreview).toHaveBeenCalled();
        });
        expect(platform.needsUrlTooltips).toHaveBeenCalled();
    });
});
