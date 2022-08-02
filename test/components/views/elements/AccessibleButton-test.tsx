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

import AccessibleButton from '../../../../src/components/views/elements/AccessibleButton';
import { Key } from '../../../../src/Keyboard';
import { mockPlatformPeg, unmockPlatformPeg } from '../../../test-utils';

describe('<AccessibleButton />', () => {
    const defaultProps = {
        onClick: jest.fn(),
        children: 'i am a button',
    };
    const getComponent = (props = {}) =>
        mount(<AccessibleButton {...defaultProps} {...props} />);

    beforeEach(() => {
        mockPlatformPeg();
    });

    afterAll(() => {
        unmockPlatformPeg();
    });

    const makeKeyboardEvent = (key: string) => ({
        key,
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
    }) as unknown as KeyboardEvent;

    it('renders div with role button by default', () => {
        const component = getComponent();
        expect(component).toMatchSnapshot();
    });

    it('renders a button element', () => {
        const component = getComponent({ element: 'button' });
        expect(component).toMatchSnapshot();
    });

    it('renders with correct classes when button has kind', () => {
        const component = getComponent({
            kind: 'primary',
        });
        expect(component).toMatchSnapshot();
    });

    it('disables button correctly', () => {
        const onClick = jest.fn();
        const component = getComponent({
            onClick,
            disabled: true,
        });
        expect(component.find('.mx_AccessibleButton').props().disabled).toBeTruthy();
        expect(component.find('.mx_AccessibleButton').props()['aria-disabled']).toBeTruthy();

        act(() => {
            component.simulate('click');
        });

        expect(onClick).not.toHaveBeenCalled();

        act(() => {
            const keydownEvent = makeKeyboardEvent(Key.ENTER);
            component.simulate('keydown', keydownEvent);
        });

        expect(onClick).not.toHaveBeenCalled();
    });

    it('calls onClick handler on button click', () => {
        const onClick = jest.fn();
        const component = getComponent({
            onClick,
        });

        act(() => {
            component.simulate('click');
        });

        expect(onClick).toHaveBeenCalled();
    });

    it('calls onClick handler on button mousedown when triggerOnMousedown is passed', () => {
        const onClick = jest.fn();
        const component = getComponent({
            onClick,
            triggerOnMouseDown: true,
        });

        act(() => {
            component.simulate('mousedown');
        });

        expect(onClick).toHaveBeenCalled();
    });

    describe('handling keyboard events', () => {
        it('calls onClick handler on enter keydown', () => {
            const onClick = jest.fn();
            const component = getComponent({
                onClick,
            });

            const keyboardEvent = makeKeyboardEvent(Key.ENTER);
            act(() => {
                component.simulate('keydown', keyboardEvent);
            });

            expect(onClick).toHaveBeenCalled();

            act(() => {
                component.simulate('keyup', keyboardEvent);
            });

            // handler only called once on keydown
            expect(onClick).toHaveBeenCalledTimes(1);
            // called for both keyup and keydown
            expect(keyboardEvent.stopPropagation).toHaveBeenCalledTimes(2);
            expect(keyboardEvent.preventDefault).toHaveBeenCalledTimes(2);
        });

        it('calls onClick handler on space keyup', () => {
            const onClick = jest.fn();
            const component = getComponent({
                onClick,
            });

            const keyboardEvent = makeKeyboardEvent(Key.SPACE);
            act(() => {
                component.simulate('keydown', keyboardEvent);
            });

            expect(onClick).not.toHaveBeenCalled();

            act(() => {
                component.simulate('keyup', keyboardEvent);
            });

            // handler only called once on keyup
            expect(onClick).toHaveBeenCalledTimes(1);
            // called for both keyup and keydown
            expect(keyboardEvent.stopPropagation).toHaveBeenCalledTimes(2);
            expect(keyboardEvent.preventDefault).toHaveBeenCalledTimes(2);
        });

        it('calls onKeydown/onKeyUp handlers for keys other than space and enter', () => {
            const onClick = jest.fn();
            const onKeyDown = jest.fn();
            const onKeyUp = jest.fn();
            const component = getComponent({
                onClick,
                onKeyDown,
                onKeyUp,
            });

            const keyboardEvent = makeKeyboardEvent(Key.K);
            act(() => {
                component.simulate('keydown', keyboardEvent);
                component.simulate('keyup', keyboardEvent);
            });

            expect(onClick).not.toHaveBeenCalled();
            expect(onKeyDown).toHaveBeenCalled();
            expect(onKeyUp).toHaveBeenCalled();
            expect(keyboardEvent.stopPropagation).not.toHaveBeenCalled();
            expect(keyboardEvent.preventDefault).not.toHaveBeenCalled();
        });

        it('does nothing on non space/enter key presses when no onKeydown/onKeyUp handlers provided', () => {
            const onClick = jest.fn();
            const component = getComponent({
                onClick,
            });

            const keyboardEvent = makeKeyboardEvent(Key.K);
            act(() => {
                component.simulate('keydown', keyboardEvent);
                component.simulate('keyup', keyboardEvent);
            });

            // no onClick call, no problems
            expect(onClick).not.toHaveBeenCalled();
            expect(keyboardEvent.stopPropagation).not.toHaveBeenCalled();
            expect(keyboardEvent.preventDefault).not.toHaveBeenCalled();
        });
    });
});
