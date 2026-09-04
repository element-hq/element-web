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
import { EventType, TypedEventEmitter, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import {
    type CallMembership,
    type MatrixRTCSession,
    MatrixRTCSessionEvent,
    type MatrixRTCSessionEventHandlerMap,
} from "matrix-js-sdk/src/matrixrtc";

import { stubClient } from "../../../../test/test-utils";
import { Subject } from "rxjs";

import {
    type ElementCallProps,
    type HostBridge,
    type HostRequest,
    UserIntent,
    configurationForIntent,
} from "./ElementCallComponentTypes";
import { ElementCall, initializeElementCall, nullHostBridge } from "./ElementCallMock";

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

const request = <Data, Reply = void>(data: Data): HostRequest<Data, Reply> => ({
    data,
    reply: vi.fn<(reply: Reply) => void>(),
});

describe("ElementCallMock", () => {
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
        vi.spyOn(client, "sendStateEvent").mockResolvedValue({ event_id: "$event" });
        vi.spyOn(client, "getRoom").mockImplementation((id) => (id === roomId ? ({ roomId } as Room) : null));
        vi.spyOn(client.matrixRTC, "getRoomSession").mockReturnValue(session as unknown as MatrixRTCSession);

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
        await waitFor(() =>
            expect(screen.getByRole("list", { name: "HostBridge log" })).toHaveTextContent("→ contentLoaded"),
        );
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
        await initializeElementCall({ rageshake: { submit_url: "https://rageshake.example.org" } });
        renderCall();
        expect(screen.getByText(/initializeElementCall: .*rageshake\.example\.org/)).toBeInTheDocument();
    });

    it("drives every EC → host bridge method from its buttons", async () => {
        const user = userEvent.setup();
        renderCall();

        await user.click(screen.getByRole("button", { name: "notifyJoined" }));
        expect(bridge.notifyJoined).toHaveBeenCalled();
        expect(screen.getByText(/in call/)).toBeInTheDocument();
        // Joining publishes an RTC membership for this device, as the real component would
        expect(client.sendStateEvent).toHaveBeenCalledWith(
            roomId,
            EventType.GroupCallMemberPrefix,
            expect.objectContaining({ application: "m.call", device_id: "ALICEDEVICE" }),
            "_@alice:example.org_ALICEDEVICE_m.call",
        );

        await user.click(screen.getByRole("button", { name: "notifyHungUp" }));
        expect(bridge.notifyHungUp).toHaveBeenCalled();
        expect(client.sendStateEvent).toHaveBeenLastCalledWith(
            roomId,
            EventType.GroupCallMemberPrefix,
            {},
            "_@alice:example.org_ALICEDEVICE_m.call",
        );

        await user.click(screen.getByRole("button", { name: "setAlwaysOnScreen(true)" }));
        expect(bridge.setAlwaysOnScreen).toHaveBeenCalledWith(true);
        await user.click(screen.getByRole("button", { name: "setAlwaysOnScreen(false)" }));
        expect(bridge.setAlwaysOnScreen).toHaveBeenCalledWith(false);

        await user.click(screen.getByRole("button", { name: "mute audio" }));
        expect(bridge.notifyDeviceMute).toHaveBeenCalledWith({ audio_enabled: false, video_enabled: true });

        await user.click(screen.getByRole("button", { name: "close" }));
        expect(bridge.close).toHaveBeenCalled();
    });

    it("clears its membership when unmounted while in the call", async () => {
        const user = userEvent.setup();
        const { unmount } = render(<ElementCall client={client} roomId={roomId} hostBridge={bridge} />);
        await user.click(screen.getByRole("button", { name: "notifyJoined" }));
        vi.mocked(client.sendStateEvent).mockClear();

        unmount();
        expect(client.sendStateEvent).toHaveBeenCalledWith(
            roomId,
            EventType.GroupCallMemberPrefix,
            {},
            "_@alice:example.org_ALICEDEVICE_m.call",
        );
    });

    it("does not touch room state when unmounted while in the lobby", () => {
        const { unmount } = render(<ElementCall client={client} roomId={roomId} hostBridge={bridge} />);
        unmount();
        expect(client.sendStateEvent).not.toHaveBeenCalled();
    });

    it("leaves the call and gives up the screen before closing", async () => {
        const user = userEvent.setup();
        const order: string[] = [];
        vi.mocked(bridge.notifyHungUp).mockImplementation(async () => {
            order.push("notifyHungUp");
        });
        vi.mocked(bridge.setAlwaysOnScreen).mockImplementation(async (v) => {
            order.push(`setAlwaysOnScreen(${v})`);
        });
        vi.mocked(bridge.close!).mockImplementation(async () => {
            order.push("close");
        });
        renderCall();

        await user.click(screen.getByRole("button", { name: "notifyJoined" }));
        await user.click(screen.getByRole("button", { name: "setAlwaysOnScreen(true)" }));
        await user.click(screen.getByRole("button", { name: "close" }));

        expect(order).toEqual(["setAlwaysOnScreen(true)", "notifyHungUp", "setAlwaysOnScreen(false)", "close"]);
        expect(screen.getByText(/in lobby/)).toBeInTheDocument();
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
