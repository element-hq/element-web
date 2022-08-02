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
import { act } from "react-dom/test-utils";

import LabelledCheckbox from "../../../../src/components/views/elements/LabelledCheckbox";

// Fake random strings to give a predictable snapshot for checkbox IDs
jest.mock(
    'matrix-js-sdk/src/randomstring',
    () => {
        return {
            randomString: () => "abdefghi",
        };
    },
);

describe('<LabelledCheckbox />', () => {
    type CompProps = React.ComponentProps<typeof LabelledCheckbox>;
    const getComponent = (props: CompProps) => mount(<LabelledCheckbox {...props} />);
    type CompClass = ReturnType<typeof getComponent>;

    const getCheckbox = (component: CompClass) => component.find(`input[type="checkbox"]`);
    const getLabel = (component: CompClass) => component.find(`.mx_LabelledCheckbox_label`);
    const getByline = (component: CompClass) => component.find(`.mx_LabelledCheckbox_byline`);

    const isChecked = (checkbox: ReturnType<typeof getCheckbox>) => checkbox.is(`[checked=true]`);
    const isDisabled = (checkbox: ReturnType<typeof getCheckbox>) => checkbox.is(`[disabled=true]`);
    const getText = (span: ReturnType<typeof getLabel>) => span.length > 0 ? span.at(0).text() : null;

    test.each([null, "this is a byline"])(
        "should render with byline of %p",
        (byline) => {
            const props: CompProps = {
                label: "Hello world",
                value: true,
                byline: byline,
                onChange: jest.fn(),
            };
            const component = getComponent(props);
            const checkbox = getCheckbox(component);

            expect(component).toMatchSnapshot();
            expect(isChecked(checkbox)).toBe(true);
            expect(isDisabled(checkbox)).toBe(false);
            expect(getText(getLabel(component))).toBe(props.label);
            expect(getText(getByline(component))).toBe(byline);
        },
    );

    it('should support unchecked by default', () => {
        const props: CompProps = {
            label: "Hello world",
            value: false,
            onChange: jest.fn(),
        };
        const component = getComponent(props);

        expect(isChecked(getCheckbox(component))).toBe(false);
    });

    it('should be possible to disable the checkbox', () => {
        const props: CompProps = {
            label: "Hello world",
            value: false,
            disabled: true,
            onChange: jest.fn(),
        };
        const component = getComponent(props);

        expect(isDisabled(getCheckbox(component))).toBe(true);
    });

    it('should emit onChange calls', () => {
        const props: CompProps = {
            label: "Hello world",
            value: false,
            onChange: jest.fn(),
        };
        const component = getComponent(props);

        expect(props.onChange).not.toHaveBeenCalled();

        act(() => {
            getCheckbox(component).simulate('change');
        });

        expect(props.onChange).toHaveBeenCalledTimes(1);
    });

    it('should react to value and disabled prop changes', () => {
        const props: CompProps = {
            label: "Hello world",
            value: false,
            onChange: jest.fn(),
        };
        const component = getComponent(props);
        let checkbox = getCheckbox(component);

        expect(isChecked(checkbox)).toBe(false);
        expect(isDisabled(checkbox)).toBe(false);

        component.setProps({ value: true, disabled: true });
        checkbox = getCheckbox(component); // refresh reference to checkbox

        expect(isChecked(checkbox)).toBe(true);
        expect(isDisabled(checkbox)).toBe(true);
    });
});
