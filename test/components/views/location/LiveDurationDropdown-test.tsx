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
import { act } from 'react-dom/test-utils';

import LiveDurationDropdown, { DEFAULT_DURATION_MS }
    from '../../../../src/components/views/location/LiveDurationDropdown';
import { findById, mockPlatformPeg } from '../../../test-utils';

mockPlatformPeg({ overrideBrowserShortcuts: jest.fn().mockReturnValue(false) });

describe('<LiveDurationDropdown />', () => {
    const defaultProps = {
        timeout: DEFAULT_DURATION_MS,
        onChange: jest.fn(),
    };
    const getComponent = (props = {}) =>
        mount(<LiveDurationDropdown {...defaultProps} {...props} />);

    const getOption = (wrapper, timeout) => findById(wrapper, `live-duration__${timeout}`).at(0);
    const getSelectedOption = (wrapper) => findById(wrapper, 'live-duration_value');
    const openDropdown = (wrapper) => act(() => {
        wrapper.find('[role="button"]').at(0).simulate('click');
        wrapper.setProps({});
    });

    it('renders timeout as selected option', () => {
        const wrapper = getComponent();
        expect(getSelectedOption(wrapper).text()).toEqual('Share for 15m');
    });

    it('renders non-default timeout as selected option', () => {
        const timeout = 1234567;
        const wrapper = getComponent({ timeout });
        expect(getSelectedOption(wrapper).text()).toEqual(`Share for 21m`);
    });

    it('renders a dropdown option for a non-default timeout value', () => {
        const timeout = 1234567;
        const wrapper = getComponent({ timeout });
        openDropdown(wrapper);
        expect(getOption(wrapper, timeout).text()).toEqual(`Share for 21m`);
    });

    it('updates value on option selection', () => {
        const onChange = jest.fn();
        const wrapper = getComponent({ onChange });

        const ONE_HOUR = 3600000;

        openDropdown(wrapper);

        act(() => {
            getOption(wrapper, ONE_HOUR).simulate('click');
        });

        expect(onChange).toHaveBeenCalledWith(ONE_HOUR);
    });
});
