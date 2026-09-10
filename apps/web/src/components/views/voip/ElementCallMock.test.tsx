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

import {
    type ElementCallHandle,
    type ElementCallHostBridge,
    type ElementCallProps,
    UserIntent,
    configurationForIntent,
} from "./ElementCallComponentTypes";
import { ElementCall, initializeElementCall } from "./ElementCallMock";

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

describe("ElementCallMock", () => {
    let client: MatrixClient;
    let session: MockSession;
    let bridge: ElementCallHostBridge;

    beforeEach(() => {
        client = stubClient();
        session = new MockSession();
        vi.spyOn(client, "getUserId").mockReturnValue("@alice:example.org");
        vi.spyOn(client, "getDeviceId").mockReturnValue("ALICEDEVICE");
        vi.spyOn(client, "sendStateEvent").mockResolvedValue({ event_id: "$event" });
        vi.spyOn(client, "getRoom").mockImplementation((id) => (id === roomId ? ({ roomId } as Room) : null));
        vi.spyOn(client.matrixRTC, "getRoomSession").mockReturnValue(session as unknown as MatrixRTCSession);

        bridge = {
            setAlwaysOnScreen: vi.fn(async () => {}),
            contentLoaded: vi.fn(async () => {}),
            notifyJoined: vi.fn(async () => {}),
            notifyHungUp: vi.fn(async () => {}),
            notifyDeviceMute: vi.fn(async () => {}),
            close: vi.fn(async () => {}),
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
        renderCall({ intent: UserIntent.JoinExistingCall, config: { skipLobby: true, hideScreensharing: true } });
        const shown = JSON.parse(screen.getByLabelText("Effective configuration").textContent!);
        expect(shown.intent).toBe("join_existing");
        expect(shown.config).toEqual({ skipLobby: true, hideScreensharing: true });
        expect(shown.effective).toEqual({
            ...configurationForIntent(UserIntent.JoinExistingCall),
            skipLobby: true,
            hideScreensharing: true,
        });
        expect(shown.effective.callIntent).toBe("video");
    });

    it("shows the theme and language it is given, and follows changes to them", () => {
        const { rerender } = render(<ElementCall client={client} roomId={roomId} theme="light" language="en" />);
        expect(screen.getByText(/theme light · language en/)).toBeInTheDocument();
        rerender(<ElementCall client={client} roomId={roomId} theme="dark" language="de" />);
        expect(screen.getByText(/theme dark · language de/)).toBeInTheDocument();
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
        vi.mocked(bridge.notifyHungUp!).mockImplementation(async () => {
            order.push("notifyHungUp");
        });
        vi.mocked(bridge.setAlwaysOnScreen!).mockImplementation(async (v: boolean) => {
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

    it("shows what the host bridge says about itself", () => {
        renderCall({ hostBridge: { ...bridge, allowJoinUnmutedViaIntent: true } });
        expect(
            screen.getByText(/supportsReactions: true · allowJoinUnmutedViaIntent: true · close: yes/),
        ).toBeInTheDocument();
        // Defaults, as Element Call reads them
        renderCall({ hostBridge: {} });
        expect(
            screen.getByText(/supportsReactions: true · allowJoinUnmutedViaIntent: false · close: no/),
        ).toBeInTheDocument();
    });

    it("hides the close button when the host does not offer to be closed", () => {
        renderCall({ hostBridge: { ...bridge, close: undefined } });
        expect(screen.queryByRole("button", { name: "close" })).not.toBeInTheDocument();
    });

    it("carries out the host's requests through its handle, and says so", async () => {
        const user = userEvent.setup();
        const handle = React.createRef<ElementCallHandle>();
        render(<ElementCall client={client} roomId={roomId} hostBridge={bridge} ref={handle} />);
        const log = screen.getByRole("list", { name: "HostBridge log" });
        expect(handle.current).not.toBeNull();

        let muteState: unknown;
        await act(async () => {
            muteState = await handle.current!.setDeviceMute({ audio_enabled: false });
        });
        expect(muteState).toEqual({ audio_enabled: false, video_enabled: true });
        expect(screen.getByRole("button", { name: "unmute audio" })).toBeInTheDocument();

        // Nothing to hang up while in the lobby, as with the real component
        await expect(handle.current!.hangUp()).rejects.toThrow("Nothing in Element Call can hang up right now");

        await user.click(screen.getByRole("button", { name: "notifyJoined" }));
        await act(() => handle.current!.hangUp());
        expect(bridge.notifyHungUp).toHaveBeenCalled();
        expect(log).toHaveTextContent("← hangUp");
        expect(screen.getByText(/in lobby/)).toBeInTheDocument();
    });

    it("talks to whichever host bridge it was most recently given", async () => {
        const user = userEvent.setup();
        const { rerender } = render(<ElementCall client={client} roomId={roomId} hostBridge={bridge} />);
        const later: ElementCallHostBridge = { notifyJoined: vi.fn(async () => {}) };
        rerender(<ElementCall client={client} roomId={roomId} hostBridge={later} />);

        await user.click(screen.getByRole("button", { name: "notifyJoined" }));
        expect(later.notifyJoined).toHaveBeenCalled();
        expect(bridge.notifyJoined).not.toHaveBeenCalled();
    });
});
