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
// eslint-disable-next-line deprecate/import
import { mount } from "enzyme";
import { mocked } from "jest-mock";

import { formatFullDateNoTime } from "../../../../src/DateUtils";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { UIFeature } from "../../../../src/settings/UIFeature";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { getMockClientWithEventEmitter } from "../../../test-utils";
import DateSeparator from "../../../../src/components/views/messages/DateSeparator";

jest.mock("../../../../src/settings/SettingsStore");

describe("DateSeparator", () => {
    const HOUR_MS = 3600000;
    const DAY_MS = HOUR_MS * 24;
    // Friday Dec 17 2021, 9:09am
    const now = '2021-12-17T08:09:00.000Z';
    const nowMs = 1639728540000;
    const defaultProps = {
        ts: nowMs,
        now,
        roomId: "!unused:example.org",
    };
    const RealDate = global.Date;
    class MockDate extends Date {
        constructor(date) {
            super(date || now);
        }
    }

    const mockClient = getMockClientWithEventEmitter({});
    const getComponent = (props = {}) =>
        mount(<DateSeparator {...defaultProps} {...props} />, {
            wrappingComponent: MatrixClientContext.Provider,
            wrappingComponentProps: { value: mockClient },
        });

    type TestCase = [string, number, string];
    const testCases: TestCase[] = [
        ['the exact same moment', nowMs, 'Today'],
        ['same day as current day', nowMs - HOUR_MS, 'Today'],
        ['day before the current day', nowMs - (HOUR_MS * 12), 'Yesterday'],
        ['2 days ago', nowMs - DAY_MS * 2, 'Wednesday'],
        ['144 hours ago', nowMs - HOUR_MS * 144, 'Sat, Dec 11 2021'],
        [
            '6 days ago, but less than 144h',
            new Date('Saturday Dec 11 2021 23:59:00 GMT+0100 (Central European Standard Time)').getTime(),
            'Saturday',
        ],
    ];

    beforeEach(() => {
        global.Date = MockDate as unknown as DateConstructor;
        (SettingsStore.getValue as jest.Mock) = jest.fn((arg) => {
            if (arg === UIFeature.TimelineEnableRelativeDates) {
                return true;
            }
        });
    });

    afterAll(() => {
        global.Date = RealDate;
    });

    it('renders the date separator correctly', () => {
        const component = getComponent();
        expect(component).toMatchSnapshot();
        expect(SettingsStore.getValue).toHaveBeenCalledWith(UIFeature.TimelineEnableRelativeDates);
    });

    it.each(testCases)('formats date correctly when current time is %s', (_d, ts, result) => {
        expect(getComponent({ ts, forExport: false }).text()).toEqual(result);
    });

    describe('when forExport is true', () => {
        it.each(testCases)('formats date in full when current time is %s', (_d, ts) => {
            expect(getComponent({ ts, forExport: true }).text()).toEqual(formatFullDateNoTime(new Date(ts)));
        });
    });

    describe('when Settings.TimelineEnableRelativeDates is falsy', () => {
        beforeEach(() => {
            (SettingsStore.getValue as jest.Mock) = jest.fn((arg) => {
                if (arg === UIFeature.TimelineEnableRelativeDates) {
                    return false;
                }
            });
        });
        it.each(testCases)('formats date in full when current time is %s', (_d, ts) => {
            expect(getComponent({ ts, forExport: false }).text()).toEqual(formatFullDateNoTime(new Date(ts)));
        });
    });

    describe('when feature_jump_to_date is enabled', () => {
        beforeEach(() => {
            mocked(SettingsStore).getValue.mockImplementation((arg) => {
                if (arg === "feature_jump_to_date") {
                    return true;
                }
            });
        });
        it('renders the date separator correctly', () => {
            const component = getComponent();
            expect(component).toMatchSnapshot();
        });
    });
});
