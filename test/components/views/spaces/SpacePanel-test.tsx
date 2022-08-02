/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
// eslint-disable-next-line deprecate/import
import { mount } from 'enzyme';
import { mocked } from 'jest-mock';
import { MatrixClient } from 'matrix-js-sdk/src/matrix';
import { act } from "react-dom/test-utils";

import SpacePanel from '../../../../src/components/views/spaces/SpacePanel';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import { SpaceKey } from '../../../../src/stores/spaces';
import { findByTestId } from '../../../test-utils';
import { shouldShowComponent } from '../../../../src/customisations/helpers/UIComponents';
import { UIComponent } from '../../../../src/settings/UIFeature';

jest.mock('../../../../src/stores/spaces/SpaceStore', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const EventEmitter = require("events");
    class MockSpaceStore extends EventEmitter {
        invitedSpaces = [];
        enabledMetaSpaces = [];
        spacePanelSpaces = [];
        activeSpace: SpaceKey = '!space1';
    }
    return {
        instance: new MockSpaceStore(),
    };
});

jest.mock('../../../../src/customisations/helpers/UIComponents', () => ({
    shouldShowComponent: jest.fn(),
}));

describe('<SpacePanel />', () => {
    const defaultProps = {};
    const getComponent = (props = {}) =>
        mount(<SpacePanel {...defaultProps} {...props} />);

    const mockClient = {
        getUserId: jest.fn().mockReturnValue('@test:test'),
        isGuest: jest.fn(),
        getAccountData: jest.fn(),
    } as unknown as MatrixClient;

    beforeAll(() => {
        jest.spyOn(MatrixClientPeg, 'get').mockReturnValue(mockClient);
    });

    beforeEach(() => {
        mocked(shouldShowComponent).mockClear().mockReturnValue(true);
    });

    describe('create new space button', () => {
        it('renders create space button when UIComponent.CreateSpaces component should be shown', () => {
            const component = getComponent();
            expect(findByTestId(component, 'create-space-button').length).toBeTruthy();
        });

        it('does not render create space button when UIComponent.CreateSpaces component should not be shown', () => {
            mocked(shouldShowComponent).mockReturnValue(false);
            const component = getComponent();
            expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.CreateSpaces);
            expect(findByTestId(component, 'create-space-button').length).toBeFalsy();
        });

        it('opens context menu on create space button click', async () => {
            const component = getComponent();

            await act(async () => {
                findByTestId(component, 'create-space-button').at(0).simulate('click');
                component.setProps({});
            });

            expect(component.find('SpaceCreateMenu').length).toBeTruthy();
        });
    });
});
