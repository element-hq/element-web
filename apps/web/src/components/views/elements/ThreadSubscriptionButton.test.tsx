/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { ClientEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { stubClient, withClientContextRenderOptions } from "test-utils";

import { ThreadSubscriptionButton } from "./ThreadSubscriptionButton";
import SettingsStore from "../../../settings/SettingsStore";

const ROOM_ID = "!room:example.org";
const THREAD_ID = "$root";

describe("<ThreadSubscriptionButton />", () => {
    let client: MatrixClient;

    /** Mimic the SDK: update the cache and emit when a request succeeds. */
    function emitUpdate(subscribed: boolean, roomId = ROOM_ID, threadId = THREAD_ID): void {
        vi.mocked(client.getCachedThreadSubscription).mockReturnValue(subscribed);
        client.emit(ClientEvent.ThreadSubscriptionUpdate, roomId, threadId, subscribed);
    }

    function renderButton(): void {
        render(
            <ThreadSubscriptionButton roomId={ROOM_ID} threadId={THREAD_ID} />,
            withClientContextRenderOptions(client),
        );
    }

    beforeEach(() => {
        client = stubClient();
        vi.spyOn(SettingsStore, "getValue").mockImplementation(
            (name) => name === "feature_msc4306_thread_subscriptions",
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders nothing and makes no requests when the labs flag is disabled", () => {
        vi.mocked(SettingsStore.getValue).mockReturnValue(false);
        renderButton();

        expect(screen.queryByTestId("thread-subscription-button")).toBeNull();
        expect(client.getThreadSubscription).not.toHaveBeenCalled();
        expect(client.getCachedThreadSubscription).not.toHaveBeenCalled();
    });

    it("renders nothing until the subscription state is known", () => {
        renderButton();

        expect(client.getThreadSubscription).toHaveBeenCalledWith(ROOM_ID, THREAD_ID);
        expect(screen.queryByTestId("thread-subscription-button")).toBeNull();
    });

    it("renders immediately from the client cache", () => {
        vi.mocked(client.getCachedThreadSubscription).mockReturnValue(true);
        renderButton();

        expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
    });

    it("shows Follow once the server reports no subscription", async () => {
        vi.mocked(client.getThreadSubscription).mockImplementation(async () => {
            emitUpdate(false);
            return null;
        });
        renderButton();

        expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
    });

    it("subscribes manually when clicking Follow", async () => {
        vi.mocked(client.getCachedThreadSubscription).mockReturnValue(false);
        vi.mocked(client.subscribeToThread).mockImplementation(async () => {
            emitUpdate(true);
            return {};
        });
        renderButton();

        await userEvent.click(screen.getByRole("button", { name: "Follow" }));

        expect(client.subscribeToThread).toHaveBeenCalledWith(ROOM_ID, THREAD_ID);
        expect(await screen.findByRole("button", { name: "Following" })).toBeEnabled();
    });

    it("unsubscribes when clicking Following", async () => {
        vi.mocked(client.getCachedThreadSubscription).mockReturnValue(true);
        vi.mocked(client.unsubscribeFromThread).mockImplementation(async () => {
            emitUpdate(false);
            return {};
        });
        renderButton();

        await userEvent.click(screen.getByRole("button", { name: "Following" }));

        expect(client.unsubscribeFromThread).toHaveBeenCalledWith(ROOM_ID, THREAD_ID);
        expect(await screen.findByRole("button", { name: "Follow" })).toBeEnabled();
    });

    it("keeps the previous state when the request fails", async () => {
        vi.mocked(client.getCachedThreadSubscription).mockReturnValue(false);
        vi.mocked(client.subscribeToThread).mockRejectedValue(new Error("network"));
        renderButton();

        await userEvent.click(screen.getByRole("button", { name: "Follow" }));

        await waitFor(() => expect(screen.getByRole("button", { name: "Follow" })).toBeEnabled());
    });

    it("updates when the subscription changes elsewhere, e.g. subscribe-on-send", () => {
        vi.mocked(client.getCachedThreadSubscription).mockReturnValue(false);
        renderButton();
        expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();

        act(() => emitUpdate(true));
        expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument();
    });

    it("ignores updates for other threads", () => {
        vi.mocked(client.getCachedThreadSubscription).mockReturnValue(false);
        renderButton();

        act(() => {
            client.emit(ClientEvent.ThreadSubscriptionUpdate, ROOM_ID, "$other", true);
            client.emit(ClientEvent.ThreadSubscriptionUpdate, "!other:example.org", THREAD_ID, true);
        });
        expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
    });
});
