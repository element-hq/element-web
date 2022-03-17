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
import { mocked } from 'jest-mock';
import { mount } from 'enzyme';

import '../../../skinned-sdk';
import LeftPanelLiveShareWarning from '../../../../src/components/views/beacon/LeftPanelLiveShareWarning';
import { OwnBeaconStore, OwnBeaconStoreEvent } from '../../../../src/stores/OwnBeaconStore';
import { flushPromises } from '../../../test-utils';

jest.mock('../../../../src/stores/OwnBeaconStore', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const EventEmitter = require("events");
    class MockOwnBeaconStore extends EventEmitter {
        public hasLiveBeacons = jest.fn().mockReturnValue(false);
    }
    return {
        // @ts-ignore
        ...jest.requireActual('../../../../src/stores/OwnBeaconStore'),
        OwnBeaconStore: {
            instance: new MockOwnBeaconStore() as unknown as OwnBeaconStore,
        },
    };
},
);

describe('<LeftPanelLiveShareWarning />', () => {
    const defaultProps = {};
    const getComponent = (props = {}) =>
        mount(<LeftPanelLiveShareWarning {...defaultProps} {...props} />);

    it('renders nothing when user has no live beacons', () => {
        const component = getComponent();
        expect(component.html()).toBe(null);
    });

    describe('when user has live beacons', () => {
        beforeEach(() => {
            mocked(OwnBeaconStore.instance).hasLiveBeacons.mockReturnValue(true);
        });
        it('renders correctly when not minimized', () => {
            const component = getComponent();
            expect(component).toMatchSnapshot();
        });

        it('renders correctly when minimized', () => {
            const component = getComponent({ isMinimized: true });
            expect(component).toMatchSnapshot();
        });

        it('removes itself when user stops having live beacons', async () => {
            const component = getComponent({ isMinimized: true });
            // started out rendered
            expect(component.html()).toBeTruthy();

            mocked(OwnBeaconStore.instance).hasLiveBeacons.mockReturnValue(false);
            OwnBeaconStore.instance.emit(OwnBeaconStoreEvent.LivenessChange, false);

            await flushPromises();
            component.setProps({});

            expect(component.html()).toBe(null);
        });
    });
});
