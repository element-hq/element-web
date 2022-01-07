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

import React from 'react';
import { mount } from "enzyme";

import '../../../skinned-sdk';
import * as TestUtils from "../../../test-utils";
import _ThemeChoicePanel from '../../../../src/components/views/settings/ThemeChoicePanel';

const ThemeChoicePanel = TestUtils.wrapInMatrixClientContext(_ThemeChoicePanel);

// Avoid errors about global.matchMedia. See:
// https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // Deprecated
        removeListener: jest.fn(), // Deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Fake random strings to give a predictable snapshot
jest.mock(
    'matrix-js-sdk/src/randomstring',
    () => {
        return {
            randomString: () => "abdefghi",
        };
    },
);

describe('ThemeChoicePanel', () => {
    it('renders the theme choice UI', () => {
        TestUtils.stubClient();
        const wrapper = mount(
            <ThemeChoicePanel />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
