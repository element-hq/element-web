/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, type MatrixClient, type MatrixEvent, RelationType, type Room } from "matrix-js-sdk/src/matrix";

import {
    ReactionsRowButtonViewModel,
    type ReactionsRowButtonViewModelProps,
} from "../../../src/viewmodels/message-body/ReactionsRowButtonViewModel";
import { type ReactionsRowButtonTooltipViewModel } from "../../../src/viewmodels/message-body/ReactionsRowButtonTooltipViewModel";
import { createTestClient, mkEvent, mkStubRoom } from "../../test-utils";
import dis from "../../../src/dispatcher/dispatcher";

jest.mock("../../../src/dispatcher/dispatcher");

describe("ReactionsRowButtonViewModel", () => {
    let client: MatrixClient;
    let room: Room;
    let mxEvent: MatrixEvent;

    const createReactionEvent = (senderId: string, key = "👍"): MatrixEvent => {
        return mkEvent({
            event: true,
            type: "m.reaction",
            room: room.roomId,
            user: senderId,
            content: {
                "m.relates_to": {
                    rel_type: "m.annotation",
                    event_id: mxEvent.getId(),
                    key,
                },
            },
        });
    };

    const createProps = (overrides?: Partial<ReactionsRowButtonViewModelProps>): ReactionsRowButtonViewModelProps => ({
        client,
        mxEvent,
        content: "👍",
        count: 2,
        reactionEvents: [createReactionEvent("@alice:example.org"), createReactionEvent("@bob:example.org")],
        disabled: false,
        customReactionImagesEnabled: false,
        ...overrides,
    });

    const getTooltipVm = (vm: ReactionsRowButtonViewModel): ReactionsRowButtonTooltipViewModel =>
        vm.getSnapshot().tooltipVm as ReactionsRowButtonTooltipViewModel;
    const getAriaLabel = (vm: ReactionsRowButtonViewModel): string | undefined =>
        (vm.getSnapshot() as { ariaLabel?: string }).ariaLabel;

    beforeEach(() => {
        jest.clearAllMocks();
        client = createTestClient();
        room = mkStubRoom("!room:example.org", "Test Room", client);
        jest.spyOn(client, "getRoom").mockReturnValue(room);
        mxEvent = mkEvent({
            event: true,
            type: "m.room.message",
            room: room.roomId,
            user: "@sender:example.org",
            content: { body: "Test message", msgtype: "m.text" },
        });
    });

    it("updates count with merge and does not touch tooltip props", () => {
        const vm = new ReactionsRowButtonViewModel(createProps());
        const tooltipSetPropsSpy = jest.spyOn(getTooltipVm(vm), "setProps");
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setCount(5);

        expect(vm.getSnapshot().count).toBe(5);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(tooltipSetPropsSpy).not.toHaveBeenCalled();

        vm.setCount(6);

        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("includes an ariaLabel in the snapshot", () => {
        const vm = new ReactionsRowButtonViewModel(createProps());

        expect(getAriaLabel(vm)).toContain("reacted with 👍");
    });

    it("updates selected state with myReactionEvent without touching tooltip props", () => {
        const vm = new ReactionsRowButtonViewModel(createProps());
        const tooltipSetPropsSpy = jest.spyOn(getTooltipVm(vm), "setProps");
        const listener = jest.fn();
        vm.subscribe(listener);
        const myReactionEvent = createReactionEvent("@me:example.org");

        vm.setMyReactionEvent(myReactionEvent);

        expect(vm.getSnapshot().isSelected).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(tooltipSetPropsSpy).not.toHaveBeenCalled();
    });

    it("updates disabled state without touching tooltip props", () => {
        const vm = new ReactionsRowButtonViewModel(createProps({ disabled: false }));
        const tooltipSetPropsSpy = jest.spyOn(getTooltipVm(vm), "setProps");

        vm.setDisabled(true);

        expect(vm.getSnapshot().isDisabled).toBe(true);
        expect(tooltipSetPropsSpy).not.toHaveBeenCalled();
    });

    it("setReactionData forwards to tooltip via setProps and updates snapshot content", () => {
        const vm = new ReactionsRowButtonViewModel(createProps());
        const tooltipSetPropsSpy = jest.spyOn(getTooltipVm(vm), "setProps");
        const reactionEvents = [createReactionEvent("@carol:example.org", "👎")];

        vm.setReactionData("👎", reactionEvents, false);

        expect(vm.getSnapshot().content).toBe("👎");
        expect(tooltipSetPropsSpy).toHaveBeenCalledWith({
            content: "👎",
            reactionEvents,
            customReactionImagesEnabled: false,
        });

        vm.setReactionData("👎", reactionEvents, false);

        expect(tooltipSetPropsSpy).toHaveBeenCalledTimes(2);
    });

    it("redacts reaction on click when myReactionEvent exists", () => {
        const myReactionEvent = createReactionEvent("@me:example.org");
        const vm = new ReactionsRowButtonViewModel(createProps({ myReactionEvent }));

        vm.onClick();

        expect(client.redactEvent).toHaveBeenCalledWith(room.roomId, myReactionEvent.getId());
        expect(client.sendEvent).not.toHaveBeenCalled();
    });

    it("sends reaction and dispatches message_sent when no myReactionEvent exists", () => {
        const vm = new ReactionsRowButtonViewModel(createProps());

        vm.onClick();

        expect(client.sendEvent).toHaveBeenCalledWith(room.roomId, EventType.Reaction, {
            "m.relates_to": {
                rel_type: RelationType.Annotation,
                event_id: mxEvent.getId(),
                key: "👍",
            },
        });
        expect(dis.dispatch).toHaveBeenCalledWith({ action: "message_sent" });
    });

    it("does nothing on click when disabled", () => {
        const vm = new ReactionsRowButtonViewModel(createProps({ disabled: true }));

        vm.onClick();

        expect(client.redactEvent).not.toHaveBeenCalled();
        expect(client.sendEvent).not.toHaveBeenCalled();
        expect(dis.dispatch).not.toHaveBeenCalled();
    });
});
