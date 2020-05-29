/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import Adapter from "enzyme-adapter-react-16";
import { configure, mount } from "enzyme";

import {
    RovingTabIndexProvider,
    RovingTabIndexWrapper,
    useRovingTabIndex,
} from "../../src/accessibility/RovingTabIndex";

configure({ adapter: new Adapter() });

const Button = (props) => {
    const [onFocus, isActive, ref] = useRovingTabIndex();
    return <button {...props} onFocus={onFocus} tabIndex={isActive ? 0 : -1} ref={ref} />;
};

const checkTabIndexes = (buttons, expectations) => {
    expect(buttons.length).toBe(expectations.length);
    for (let i = 0; i < buttons.length; i++) {
        expect(buttons.at(i).prop("tabIndex")).toBe(expectations[i]);
    }
};

// give the buttons keys for the fibre reconciler to not treat them all as the same
const button1 = <Button key={1}>a</Button>;
const button2 = <Button key={2}>b</Button>;
const button3 = <Button key={3}>c</Button>;
const button4 = <Button key={4}>d</Button>;

describe("RovingTabIndex", () => {
    it("RovingTabIndexProvider renders children as expected", () => {
        const wrapper = mount(<RovingTabIndexProvider>
            {() => <div><span>Test</span></div>}
        </RovingTabIndexProvider>);
        expect(wrapper.text()).toBe("Test");
        expect(wrapper.html()).toBe('<div><span>Test</span></div>');
    });

    it("RovingTabIndexProvider works as expected with useRovingTabIndex", () => {
        const wrapper = mount(<RovingTabIndexProvider>
            {() => <React.Fragment>
                { button1 }
                { button2 }
                { button3 }
            </React.Fragment>}
        </RovingTabIndexProvider>);

        // should begin with 0th being active
        checkTabIndexes(wrapper.find("button"), [0, -1, -1]);

        // focus on 2nd button and test it is the only active one
        wrapper.find("button").at(2).simulate("focus");
        wrapper.update();
        checkTabIndexes(wrapper.find("button"), [-1, -1, 0]);

        // focus on 1st button and test it is the only active one
        wrapper.find("button").at(1).simulate("focus");
        wrapper.update();
        checkTabIndexes(wrapper.find("button"), [-1, 0, -1]);

        // check that the active button does not change even on an explicit blur event
        wrapper.find("button").at(1).simulate("blur");
        wrapper.update();
        checkTabIndexes(wrapper.find("button"), [-1, 0, -1]);

        // update the children, it should remain on the same button
        wrapper.setProps({
            children: () => [button1, button4, button2, button3],
        });
        wrapper.update();
        checkTabIndexes(wrapper.find("button"), [-1, -1, 0, -1]);

        // update the children, remove the active button, it should move to the next one
        wrapper.setProps({
            children: () => [button1, button4, button3],
        });
        wrapper.update();
        checkTabIndexes(wrapper.find("button"), [-1, -1, 0]);
    });

    it("RovingTabIndexProvider works as expected with RovingTabIndexWrapper", () => {
        const wrapper = mount(<RovingTabIndexProvider>
            {() => <React.Fragment>
                { button1 }
                { button2 }
                <RovingTabIndexWrapper>
                    {({onFocus, isActive, ref}) =>
                        <button onFocus={onFocus} tabIndex={isActive ? 0 : -1} ref={ref}>.</button>
                    }
                </RovingTabIndexWrapper>
            </React.Fragment>}
        </RovingTabIndexProvider>);

        // should begin with 0th being active
        checkTabIndexes(wrapper.find("button"), [0, -1, -1]);

        // focus on 2nd button and test it is the only active one
        wrapper.find("button").at(2).simulate("focus");
        wrapper.update();
        checkTabIndexes(wrapper.find("button"), [-1, -1, 0]);
    });
});


