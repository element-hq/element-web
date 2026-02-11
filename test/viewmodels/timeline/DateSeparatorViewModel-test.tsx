/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { DateSeparatorView } from "@element-hq/web-shared-components";
import { mocked } from "jest-mock";
import { fireEvent, render, screen } from "jest-matrix-react";
import { ConnectionError, Direction } from "matrix-js-sdk/src/matrix";

import dispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { formatFullDateNoTime } from "../../../src/DateUtils";
import Modal from "../../../src/Modal";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import SettingsStore from "../../../src/settings/SettingsStore";
import { UIFeature } from "../../../src/settings/UIFeature";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import { DateSeparatorViewModel } from "../../../src/viewmodels/timeline/DateSeparatorViewModel";
import { flushPromisesWithFakeTimers } from "../../test-utils";

jest.mock("../../../src/settings/SettingsStore");
jest.mock("../../../src/contexts/SDKContext", () => ({
    SdkContextClass: {
        instance: {
            roomViewStore: {
                getRoomId: jest.fn(),
            },
        },
    },
}));

describe("DateSeparatorViewModel", () => {
    const HOUR_MS = 3600000;
    const DAY_MS = HOUR_MS * 24;
    // Friday Dec 17 2021, 9:09am
    const nowDate = new Date("2021-12-17T08:09:00.000Z");
    const roomId = "!room:example.org";
    const defaultProps = {
        roomId,
        ts: nowDate.getTime(),
    };
    type TestCase = [string, number, string];
    const testCases: TestCase[] = [
        ["the exact same moment", nowDate.getTime(), "today"],
        ["same day as current day", nowDate.getTime() - HOUR_MS, "today"],
        ["day before the current day", nowDate.getTime() - HOUR_MS * 12, "yesterday"],
        ["2 days ago", nowDate.getTime() - DAY_MS * 2, "Wednesday"],
        ["144 hours ago", nowDate.getTime() - HOUR_MS * 144, "Sat, Dec 11, 2021"],
        [
            "6 days ago, but less than 144h",
            new Date("Saturday Dec 11 2021 23:59:00 GMT+0100 (Central European Standard Time)").getTime(),
            "Saturday",
        ],
    ];

    const watchCallbacks = new Map<string, (...args: any[]) => void>();
    const mockTimestampToEvent = jest.fn();

    const hasTestId = (node: React.ReactNode, testId: string): boolean => {
        if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return false;
        const props = node.props as { children?: React.ReactNode; "data-testid"?: string };
        if (props["data-testid"] === testId) return true;

        const children = React.Children.toArray(props.children);
        return children.some((child) => hasTestId(child, testId));
    };

    const createViewModel = (props: Partial<typeof defaultProps> & { forExport?: boolean } = {}): DateSeparatorViewModel => {
        return new DateSeparatorViewModel({ ...defaultProps, ...props });
    };

    const renderViewModel = (props: Partial<typeof defaultProps> & { forExport?: boolean } = {}) => {
        const vm = createViewModel(props);
        return { vm, ...render(<DateSeparatorView vm={vm} />) };
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(nowDate.getTime());
        watchCallbacks.clear();

        mocked(SettingsStore).getValue.mockImplementation((key): any => {
            if (String(key) === UIFeature.TimelineEnableRelativeDates) return true;
            if (key === "feature_jump_to_date") return false;
            return undefined;
        });
        mocked(SettingsStore).watchSetting.mockImplementation((settingName, _roomId, cb): any => {
            watchCallbacks.set(String(settingName), cb);
            return `${String(settingName)}-watch-ref`;
        });
        mocked(SettingsStore).unwatchSetting.mockImplementation(() => {});

        mockTimestampToEvent.mockReset();
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue({
            timestampToEvent: mockTimestampToEvent,
        } as any);

        jest.spyOn(dispatcher, "dispatch").mockImplementation(() => {});
        jest.spyOn(Modal, "createDialog").mockImplementation(() => ({ close: jest.fn() }) as any);

        mocked(SdkContextClass.instance.roomViewStore.getRoomId).mockReturnValue(roomId);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it("computes relative label for today", () => {
        const vm = createViewModel();

        expect(vm.getSnapshot().label).toBe("today");
        expect(vm.getSnapshot().className).toBe("mx_TimelineSeparator");
    });

    it("uses full date when exporting", () => {
        const vm = createViewModel({ forExport: true });

        expect(vm.getSnapshot().label).toBe(formatFullDateNoTime(nowDate));
    });

    it("updates label when relative dates setting changes at runtime", () => {
        const vm = createViewModel();
        expect(vm.getSnapshot().label).toBe("today");

        const callback = watchCallbacks.get(UIFeature.TimelineEnableRelativeDates);
        expect(callback).toBeDefined();
        callback?.(UIFeature.TimelineEnableRelativeDates, null, null, null, false);

        expect(vm.getSnapshot().label).toBe(formatFullDateNoTime(nowDate));
    });

    it("exposes jumpToDateMenu when feature is enabled", () => {
        mocked(SettingsStore).getValue.mockImplementation((key): any => {
            if (String(key) === UIFeature.TimelineEnableRelativeDates) return true;
            if (key === "feature_jump_to_date") return true;
            return undefined;
        });
        const vm = createViewModel();

        expect(vm.getSnapshot().jumpToDateMenu).toBeDefined();
    });

    it("dispatches ViewRoom when pickDate resolves in active room", async () => {
        const eventId = "$event";
        const unixTimestamp = nowDate.getTime() - DAY_MS;
        mockTimestampToEvent.mockResolvedValue({
            event_id: eventId,
            origin_server_ts: unixTimestamp,
        });
        const vm = createViewModel();

        await vm.pickDate(unixTimestamp);

        expect(mockTimestampToEvent).toHaveBeenCalledWith(roomId, unixTimestamp, Direction.Forward);
        expect(dispatcher.dispatch).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            event_id: eventId,
            highlighted: true,
            room_id: roomId,
            metricsTrigger: undefined,
        });
    });

    it("does not dispatch ViewRoom when room changed before pickDate resolves", async () => {
        mockTimestampToEvent.mockResolvedValue({
            event_id: "$event",
            origin_server_ts: nowDate.getTime(),
        });
        mocked(SdkContextClass.instance.roomViewStore.getRoomId).mockReturnValue("!other:example.org");
        const vm = createViewModel();

        await vm.pickDate(nowDate.getTime() - HOUR_MS);

        expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it("shows submit debug logs option for generic errors", async () => {
        mockTimestampToEvent.mockRejectedValue(new Error("Boom"));
        const vm = createViewModel();

        await vm.pickDate(nowDate.getTime() - HOUR_MS);

        expect(Modal.createDialog).toHaveBeenCalled();
        const [, params] = mocked(Modal.createDialog).mock.calls.at(-1)!;
        expect(hasTestId((params as any).description, "jump-to-date-error-submit-debug-logs-button")).toBe(true);
    });

    it("does not show submit debug logs option for connection errors", async () => {
        mockTimestampToEvent.mockRejectedValue(new ConnectionError("offline"));
        const vm = createViewModel();

        await vm.pickDate(nowDate.getTime() - HOUR_MS);

        expect(Modal.createDialog).toHaveBeenCalled();
        const [, params] = mocked(Modal.createDialog).mock.calls.at(-1)!;
        expect(hasTestId((params as any).description, "jump-to-date-error-submit-debug-logs-button")).toBe(false);
    });

    describe("rendering with DateSeparatorView", () => {
        it.each(testCases)("formats date correctly when current time is %s", (_d, ts, result) => {
            expect(renderViewModel({ ts }).container.textContent).toContain(result);
        });

        describe("when forExport is true", () => {
            it.each(testCases)("formats date in full when current time is %s", (_d, ts) => {
                expect(renderViewModel({ ts, forExport: true }).container.textContent).toContain(
                    formatFullDateNoTime(new Date(ts)),
                );
            });
        });

        describe("when TimelineEnableRelativeDates is false", () => {
            beforeEach(() => {
                mocked(SettingsStore).getValue.mockImplementation((key): any => {
                    if (String(key) === UIFeature.TimelineEnableRelativeDates) return false;
                    if (key === "feature_jump_to_date") return false;
                    return undefined;
                });
            });

            it.each(testCases)("formats date in full when current time is %s", (_d, ts) => {
                expect(renderViewModel({ ts }).container.textContent).toContain(formatFullDateNoTime(new Date(ts)));
            });
        });

        describe("when feature_jump_to_date is enabled", () => {
            beforeEach(() => {
                mocked(SettingsStore).getValue.mockImplementation((key): any => {
                    if (String(key) === UIFeature.TimelineEnableRelativeDates) return true;
                    if (key === "feature_jump_to_date") return true;
                    return undefined;
                });
            });

            [
                {
                    timeDescriptor: "last week",
                    jumpButtonTestId: "jump-to-date-last-week",
                },
                {
                    timeDescriptor: "last month",
                    jumpButtonTestId: "jump-to-date-last-month",
                },
                {
                    timeDescriptor: "the beginning",
                    jumpButtonTestId: "jump-to-date-beginning",
                },
            ].forEach((testCase) => {
                it(`can jump to ${testCase.timeDescriptor}`, async () => {
                    renderViewModel();
                    fireEvent.click(screen.getByTestId("jump-to-date-separator-button"));

                    const returnedDate = new Date();
                    returnedDate.setDate(nowDate.getDate() - 100);
                    const returnedEventId = "$abc";
                    mockTimestampToEvent.mockResolvedValue({
                        event_id: returnedEventId,
                        origin_server_ts: returnedDate.getTime(),
                    });
                    fireEvent.click(await screen.findByTestId(testCase.jumpButtonTestId));
                    await flushPromisesWithFakeTimers();

                    expect(dispatcher.dispatch).toHaveBeenCalledWith({
                        action: Action.ViewRoom,
                        event_id: returnedEventId,
                        highlighted: true,
                        room_id: roomId,
                        metricsTrigger: undefined,
                    });
                });
            });

            it("does not jump when room changed before request resolves", async () => {
                renderViewModel();
                fireEvent.click(screen.getByTestId("jump-to-date-separator-button"));

                mocked(SdkContextClass.instance.roomViewStore.getRoomId).mockReturnValue("!some-other-room");
                mockTimestampToEvent.mockResolvedValue({
                    event_id: "$abc",
                    origin_server_ts: 0,
                });
                fireEvent.click(await screen.findByTestId("jump-to-date-last-week"));
                await flushPromisesWithFakeTimers();

                expect(dispatcher.dispatch).not.toHaveBeenCalled();
            });

            it("does not show jump to date error if user switched room", async () => {
                renderViewModel();
                fireEvent.click(screen.getByTestId("jump-to-date-separator-button"));

                mocked(SdkContextClass.instance.roomViewStore.getRoomId).mockReturnValue("!some-other-room");
                mockTimestampToEvent.mockRejectedValue(new Error("Fake error in test"));
                fireEvent.click(await screen.findByTestId("jump-to-date-last-week"));
                await flushPromisesWithFakeTimers();

                expect(Modal.createDialog).not.toHaveBeenCalled();
            });

            it("shows error dialog with submit debug logs option when non-networking error occurs", async () => {
                renderViewModel();
                fireEvent.click(screen.getByTestId("jump-to-date-separator-button"));

                mockTimestampToEvent.mockRejectedValue(new Error("Fake error in test"));
                fireEvent.click(await screen.findByTestId("jump-to-date-last-week"));
                await flushPromisesWithFakeTimers();

                expect(Modal.createDialog).toHaveBeenCalled();
                const [, params] = mocked(Modal.createDialog).mock.calls.at(-1)!;
                expect(hasTestId((params as any).description, "jump-to-date-error-submit-debug-logs-button")).toBe(true);
            });

            it("shows error dialog without submit debug logs option when networking error occurs", async () => {
                renderViewModel();
                fireEvent.click(screen.getByTestId("jump-to-date-separator-button"));

                mockTimestampToEvent.mockRejectedValue(new ConnectionError("Fake connection error in test"));
                fireEvent.click(await screen.findByTestId("jump-to-date-last-week"));
                await flushPromisesWithFakeTimers();

                expect(Modal.createDialog).toHaveBeenCalled();
                const [, params] = mocked(Modal.createDialog).mock.calls.at(-1)!;
                expect(hasTestId((params as any).description, "jump-to-date-error-submit-debug-logs-button")).toBe(false);
            });
        });
    });
});
