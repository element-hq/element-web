/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { mocked } from "jest-mock";
import { fireEvent, render, screen } from "@testing-library/react";
import { TimestampToEventResponse } from "matrix-js-sdk/src/client";
import { ConnectionError, HTTPError, MatrixError } from "matrix-js-sdk/src/http-api";

import dispatcher from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import { ViewRoomPayload } from "../../../../src/dispatcher/payloads/ViewRoomPayload";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import { formatFullDateNoTime } from "../../../../src/DateUtils";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { UIFeature } from "../../../../src/settings/UIFeature";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import {
    clearAllModals,
    flushPromisesWithFakeTimers,
    getMockClientWithEventEmitter,
    waitEnoughCyclesForModal,
} from "../../../test-utils";
import DateSeparator from "../../../../src/components/views/messages/DateSeparator";

jest.mock("../../../../src/settings/SettingsStore");

describe("DateSeparator", () => {
    const HOUR_MS = 3600000;
    const DAY_MS = HOUR_MS * 24;
    // Friday Dec 17 2021, 9:09am
    const nowDate = new Date("2021-12-17T08:09:00.000Z");
    const roomId = "!unused:example.org";
    const defaultProps = {
        ts: nowDate.getTime(),
        roomId,
    };

    const mockClient = getMockClientWithEventEmitter({
        timestampToEvent: jest.fn(),
    });
    const getComponent = (props = {}) =>
        render(
            <MatrixClientContext.Provider value={mockClient}>
                <DateSeparator {...defaultProps} {...props} />
            </MatrixClientContext.Provider>,
        );

    type TestCase = [string, number, string];
    const testCases: TestCase[] = [
        ["the exact same moment", nowDate.getTime(), "Today"],
        ["same day as current day", nowDate.getTime() - HOUR_MS, "Today"],
        ["day before the current day", nowDate.getTime() - HOUR_MS * 12, "Yesterday"],
        ["2 days ago", nowDate.getTime() - DAY_MS * 2, "Wednesday"],
        ["144 hours ago", nowDate.getTime() - HOUR_MS * 144, "Sat, Dec 11 2021"],
        [
            "6 days ago, but less than 144h",
            new Date("Saturday Dec 11 2021 23:59:00 GMT+0100 (Central European Standard Time)").getTime(),
            "Saturday",
        ],
    ];

    beforeEach(() => {
        // Set a consistent fake time here so the test is always consistent
        jest.useFakeTimers();
        jest.setSystemTime(nowDate.getTime());

        (SettingsStore.getValue as jest.Mock) = jest.fn((arg) => {
            if (arg === UIFeature.TimelineEnableRelativeDates) {
                return true;
            }
        });
        jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(roomId);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it("renders the date separator correctly", () => {
        const { asFragment } = getComponent();
        expect(asFragment()).toMatchSnapshot();
        expect(SettingsStore.getValue).toHaveBeenCalledWith(UIFeature.TimelineEnableRelativeDates);
    });

    it.each(testCases)("formats date correctly when current time is %s", (_d, ts, result) => {
        expect(getComponent({ ts, forExport: false }).container.textContent).toEqual(result);
    });

    describe("when forExport is true", () => {
        it.each(testCases)("formats date in full when current time is %s", (_d, ts) => {
            expect(getComponent({ ts, forExport: true }).container.textContent).toEqual(
                formatFullDateNoTime(new Date(ts)),
            );
        });
    });

    describe("when Settings.TimelineEnableRelativeDates is falsy", () => {
        beforeEach(() => {
            (SettingsStore.getValue as jest.Mock) = jest.fn((arg) => {
                if (arg === UIFeature.TimelineEnableRelativeDates) {
                    return false;
                }
            });
        });
        it.each(testCases)("formats date in full when current time is %s", (_d, ts) => {
            expect(getComponent({ ts, forExport: false }).container.textContent).toEqual(
                formatFullDateNoTime(new Date(ts)),
            );
        });
    });

    describe("when feature_jump_to_date is enabled", () => {
        beforeEach(() => {
            jest.clearAllMocks();
            mocked(SettingsStore).getValue.mockImplementation((arg): any => {
                if (arg === "feature_jump_to_date") {
                    return true;
                }
            });
            jest.spyOn(dispatcher, "dispatch").mockImplementation(() => {});
        });

        afterEach(async () => {
            await clearAllModals();
        });

        it("renders the date separator correctly", () => {
            const { asFragment } = getComponent();
            expect(asFragment()).toMatchSnapshot();
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
                // Render the component
                getComponent();

                // Open the jump to date context menu
                fireEvent.click(screen.getByTestId("jump-to-date-separator-button"));

                // Jump to "x"
                const returnedDate = new Date();
                // Just an arbitrary date before "now"
                returnedDate.setDate(nowDate.getDate() - 100);
                const returnedEventId = "$abc";
                mockClient.timestampToEvent.mockResolvedValue({
                    event_id: returnedEventId,
                    origin_server_ts: String(returnedDate.getTime()),
                } satisfies TimestampToEventResponse);
                const jumpToXButton = await screen.findByTestId(testCase.jumpButtonTestId);
                fireEvent.click(jumpToXButton);

                // Flush out the dispatcher which uses `window.setTimeout(...)` since we're
                // using `jest.useFakeTimers()` in these tests.
                await flushPromisesWithFakeTimers();

                // Ensure that we're jumping to the event at the given date
                expect(dispatcher.dispatch).toHaveBeenCalledWith({
                    action: Action.ViewRoom,
                    event_id: returnedEventId,
                    highlighted: true,
                    room_id: roomId,
                    metricsTrigger: undefined,
                } satisfies ViewRoomPayload);
            });
        });

        it("should not jump to date if we already switched to another room", async () => {
            // Render the component
            getComponent();

            // Open the jump to date context menu
            fireEvent.click(screen.getByTestId("jump-to-date-separator-button"));

            // Mimic the outcome of switching rooms while waiting for the jump to date
            // request to finish. Imagine that we started jumping to "last week", the
            // network request is taking a while, so we got bored, switched rooms; we
            // shouldn't jump back to the previous room after the network request
            // happens to finish later.
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!some-other-room");

            // Jump to "last week"
            mockClient.timestampToEvent.mockResolvedValue({
                event_id: "$abc",
                origin_server_ts: "0",
            });
            const jumpToLastWeekButton = await screen.findByTestId("jump-to-date-last-week");
            fireEvent.click(jumpToLastWeekButton);

            // Flush out the dispatcher which uses `window.setTimeout(...)` since we're
            // using `jest.useFakeTimers()` in these tests.
            await flushPromisesWithFakeTimers();

            // We should not see any room switching going on (`Action.ViewRoom`)
            expect(dispatcher.dispatch).not.toHaveBeenCalled();
        });

        it("should not show jump to date error if we already switched to another room", async () => {
            // Render the component
            getComponent();

            // Open the jump to date context menu
            fireEvent.click(screen.getByTestId("jump-to-date-separator-button"));

            // Mimic the outcome of switching rooms while waiting for the jump to date
            // request to finish. Imagine that we started jumping to "last week", the
            // network request is taking a while, so we got bored, switched rooms; we
            // shouldn't jump back to the previous room after the network request
            // happens to finish later.
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!some-other-room");

            // Try to jump to "last week" but we want an error to occur and ensure that
            // we don't show an error dialog for it since we already switched away to
            // another room and don't care about the outcome here anymore.
            mockClient.timestampToEvent.mockRejectedValue(new Error("Fake error in test"));
            const jumpToLastWeekButton = await screen.findByTestId("jump-to-date-last-week");
            fireEvent.click(jumpToLastWeekButton);

            // Wait the necessary time in order to see if any modal will appear
            await waitEnoughCyclesForModal({
                useFakeTimers: true,
            });

            // We should not see any error modal dialog
            //
            // We have to use `queryBy` so that it can return `null` for something that does not exist.
            expect(screen.queryByTestId("jump-to-date-error-content")).not.toBeInTheDocument();
        });

        it("should show error dialog with submit debug logs option when non-networking error occurs", async () => {
            // Render the component
            getComponent();

            // Open the jump to date context menu
            fireEvent.click(screen.getByTestId("jump-to-date-separator-button"));

            // Try to jump to "last week" but we want a non-network error to occur so it
            // shows the "Submit debug logs" UI
            mockClient.timestampToEvent.mockRejectedValue(new Error("Fake error in test"));
            const jumpToLastWeekButton = await screen.findByTestId("jump-to-date-last-week");
            fireEvent.click(jumpToLastWeekButton);

            // Expect error to be shown. We have to wait for the UI to transition.
            expect(await screen.findByTestId("jump-to-date-error-content")).toBeInTheDocument();

            // Expect an option to submit debug logs to be shown when a non-network error occurs
            expect(await screen.findByTestId("jump-to-date-error-submit-debug-logs-button")).toBeInTheDocument();
        });

        [
            new ConnectionError("Fake connection error in test"),
            new HTTPError("Fake http error in test", 418),
            new MatrixError(
                { errcode: "M_FAKE_ERROR_CODE", error: "Some fake error occured" },
                518,
                "https://fake-url/",
            ),
        ].forEach((fakeError) => {
            it(`should show error dialog without submit debug logs option when networking error (${fakeError.name}) occurs`, async () => {
                // Render the component
                getComponent();

                // Open the jump to date context menu
                fireEvent.click(screen.getByTestId("jump-to-date-separator-button"));

                // Try to jump to "last week" but we want a network error to occur
                mockClient.timestampToEvent.mockRejectedValue(fakeError);
                const jumpToLastWeekButton = await screen.findByTestId("jump-to-date-last-week");
                fireEvent.click(jumpToLastWeekButton);

                // Expect error to be shown. We have to wait for the UI to transition.
                expect(await screen.findByTestId("jump-to-date-error-content")).toBeInTheDocument();

                // The submit debug logs option should *NOT* be shown for network errors.
                //
                // We have to use `queryBy` so that it can return `null` for something that does not exist.
                expect(screen.queryByTestId("jump-to-date-error-submit-debug-logs-button")).not.toBeInTheDocument();
            });
        });
    });
});
