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

import SettingsStore from '../../../../src/settings/SettingsStore';
import UiFeatureSettingWrapper from '../../../../src/components/views/settings/UiFeatureSettingWrapper';
import { UIFeature } from '../../../../src/settings/UIFeature';

jest.mock('../../../../src/settings/SettingsStore');

describe('<UiFeatureSettingWrapper>', () => {
    const defaultProps = {
        uiFeature: UIFeature.Feedback,
        children: <div>test</div>,
    };
    const getComponent = (props = {}) => mount(<UiFeatureSettingWrapper {...defaultProps} {...props} />);

    beforeEach(() => {
        (SettingsStore.getValue as jest.Mock).mockClear().mockReturnValue(true);
    });

    it('renders children when setting is truthy', () => {
        const component = getComponent();

        expect(component).toMatchSnapshot();
        expect(SettingsStore.getValue).toHaveBeenCalledWith(defaultProps.uiFeature);
    });

    it('returns null when setting is truthy but children are undefined', () => {
        const component = getComponent({ children: undefined });

        expect(component.html()).toBeNull();
    });

    it('returns null when setting is falsy', () => {
        (SettingsStore.getValue as jest.Mock).mockReturnValue(false);
        const component = getComponent();

        expect(component.html()).toBeNull();
    });
});
