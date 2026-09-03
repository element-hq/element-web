/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { TypedEventEmitter, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import {
    type CallMembership,
    type MatrixRTCSession,
    MatrixRTCSessionEvent,
    type MatrixRTCSessionEventHandlerMap,
} from "matrix-js-sdk/src/matrixrtc";

import { stubClient } from "../../../../test/test-utils";
import {
    ElementCall,
    type ElementCallProps,
    type HostBridge,
    type HostRequest,
    type Subscribable,
    UserIntent,
    configurationForIntent,
    initializeElementCall,
    nullHostBridge,
} from "./ElementCall";

const roomId = "!1:example.org";

const mkMembership = (sender: string, deviceId: string): CallMembership =>
    ({ sender, deviceId, membershipID: `${sender}:${deviceId}` }) as CallMembership;

class MockSession extends TypedEventEmitter<MatrixRTCSessionEvent, MatrixRTCSessionEventHandlerMap> {
    public memberships: CallMembership[] = [];
    public room = { roomId };

    public setMemberships(memberships: CallMembership[]): void {
        const prev = this.memberships;
        this.memberships = memberships;
        this.emit(MatrixRTCSessionEvent.MembershipsChanged, prev, memberships);
    }
}

/** A minimal hot observable so the test can act as the host. */
class Subject<T> implements Subscribable<T> {
    private listeners = new Set<(value: T) => void>();
    public subscribe(next: (value: T) => void): { unsubscribe(): void } {
        this.listeners.add(next);
        return { unsubscribe: () => this.listeners.delete(next) };
    }
    public next(value: T): void {
        this.listeners.forEach((l) => l(value));
    }
}

const request = <Data, Reply = void>(data: Data): HostRequest<Data, Reply> => ({
    data,
    reply: vi.fn<(reply: Reply) => void>(),
});

describe("ElementCall (mock)", () => {
    let client: MatrixClient;
    let session: MockSession;
    let hangUp$: Subject<HostRequest<Record<string, never>>>;
    let deviceMute$: Subject<HostRequest<{ audio_enabled?: boolean; video_enabled?: boolean }, any>>;
    let themeChange$: Subject<HostRequest<{ name?: string }>>;
    let bridge: HostBridge;

    beforeEach(() => {
        client = stubClient();
        session = new MockSession();
        vi.spyOn(client, "getUserId").mockReturnValue("@alice:example.org");
        vi.spyOn(client, "getDeviceId").mockReturnValue("ALICEDEVICE");
        vi.spyOn(client, "getRoom").mockImplementation((id) => (id === roomId ? ({ roomId } as Room) : null));
        (client as any).matrixRTC = { getRoomSession: () => session as unknown as MatrixRTCSession };

        hangUp$ = new Subject();
        deviceMute$ = new Subject();
        themeChange$ = new Subject();
        bridge = {
            ...nullHostBridge,
            setAlwaysOnScreen: vi.fn(async () => {}),
            contentLoaded: vi.fn(async () => {}),
            notifyJoined: vi.fn(async () => {}),
            notifyHungUp: vi.fn(async () => {}),
            notifyDeviceMute: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
            hangUp$,
            deviceMute$,
            themeChange$,
        };
    });

    const renderCall = (props: Partial<ElementCallProps> = {}): void => {
        render(<ElementCall client={client} roomId={roomId} hostBridge={bridge} {...props} />);
    };

    it("renders an error for a room the client does not know", () => {
        renderCall({ roomId: "!unknown:example.org" });
        expect(screen.getByText("Unknown room !unknown:example.org")).toBeInTheDocument();
    });

    it("shows the room and intent, and reports contentLoaded to the host", async () => {
        renderCall({ intent: UserIntent.StartNewCallDM });
        expect(screen.getByText(/!1:example.org · intent start_call_dm/)).toBeInTheDocument();
        await waitFor(() => expect(bridge.contentLoaded).toHaveBeenCalled());
        expect(screen.getByRole("list", { name: "HostBridge log" })).toHaveTextContent("→ contentLoaded");
    });

    it("lists the session members and marks our own device", () => {
        session.memberships = [
            mkMembership("@alice:example.org", "ALICEDEVICE"),
            mkMembership("@bob:example.org", "BOBDEVICE"),
        ];
        renderCall();
        expect(screen.getByText("@alice:example.org (ALICEDEVICE) – you")).toBeInTheDocument();
        expect(screen.getByText("@bob:example.org (BOBDEVICE)")).toBeInTheDocument();
    });

    it("updates when the memberships change", () => {
        renderCall();
        expect(screen.getByText("No one is in this call")).toBeInTheDocument();
        act(() => session.setMemberships([mkMembership("@carol:example.org", "CAROLDEVICE")]));
        expect(screen.getByText("@carol:example.org (CAROLDEVICE)")).toBeInTheDocument();
    });

    it("renders the effective configuration derived from the intent plus overrides", () => {
        renderCall({ intent: UserIntent.JoinExistingCall, config: { skipLobby: true, lang: "de" } });
        const shown = JSON.parse(screen.getByLabelText("Effective configuration").textContent!);
        expect(shown.intent).toBe("join_existing");
        expect(shown.config).toEqual({ skipLobby: true, lang: "de" });
        expect(shown.effective).toEqual({
            ...configurationForIntent(UserIntent.JoinExistingCall),
            skipLobby: true,
            lang: "de",
        });
        expect(shown.effective.callIntent).toBe("video");
    });

    it("records what initializeElementCall was given", async () => {
        await initializeElementCall({ rageshakeSubmitUrl: "https://rageshake.example.org" });
        renderCall();
        expect(screen.getByText(/initializeElementCall: .*rageshake\.example\.org/)).toBeInTheDocument();
    });

    it("drives every EC → host bridge method from its buttons", async () => {
        const user = userEvent.setup();
        renderCall();

        await user.click(screen.getByRole("button", { name: "notifyJoined" }));
        expect(bridge.notifyJoined).toHaveBeenCalled();
        expect(screen.getByText(/in call/)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "notifyHungUp" }));
        expect(bridge.notifyHungUp).toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: "setAlwaysOnScreen(true)" }));
        expect(bridge.setAlwaysOnScreen).toHaveBeenCalledWith(true);
        await user.click(screen.getByRole("button", { name: "setAlwaysOnScreen(false)" }));
        expect(bridge.setAlwaysOnScreen).toHaveBeenCalledWith(false);

        await user.click(screen.getByRole("button", { name: "mute audio" }));
        expect(bridge.notifyDeviceMute).toHaveBeenCalledWith({ audio_enabled: false, video_enabled: true });

        await user.click(screen.getByRole("button", { name: "close" }));
        expect(bridge.close).toHaveBeenCalled();
    });

    it("hides close and downloadMedia buttons when the host does not offer them", () => {
        renderCall({ hostBridge: { ...bridge, close: undefined, downloadMedia: undefined } });
        expect(screen.queryByRole("button", { name: "close" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "downloadMedia" })).not.toBeInTheDocument();
    });

    it("acknowledges host → EC requests and reacts to them", async () => {
        renderCall();
        const log = screen.getByRole("list", { name: "HostBridge log" });

        const theme = request({ name: "dark" });
        act(() => themeChange$.next(theme));
        expect(theme.reply).toHaveBeenCalledTimes(1);
        expect(log).toHaveTextContent('← themeChange {"name":"dark"}');

        const mute = request<{ audio_enabled?: boolean }, any>({ audio_enabled: false });
        act(() => deviceMute$.next(mute));
        expect(mute.reply).toHaveBeenCalledWith({ audio_enabled: false, video_enabled: true });
        expect(screen.getByRole("button", { name: "unmute audio" })).toBeInTheDocument();

        const hangUp = request<Record<string, never>>({});
        act(() => hangUp$.next(hangUp));
        await waitFor(() => expect(hangUp.reply).toHaveBeenCalledTimes(1));
        expect(bridge.notifyHungUp).toHaveBeenCalled();
        expect(log).toHaveTextContent("← hangUp");
    });
});
