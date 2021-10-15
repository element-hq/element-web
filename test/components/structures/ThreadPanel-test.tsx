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
import { shallow, mount } from "enzyme";
import '../../skinned-sdk';

import {
    ThreadFilterType,
    ThreadPanelHeader,
    ThreadPanelHeaderFilterOptionItem,
} from '../../../src/components/structures/ThreadPanel';
import { ContextMenuButton } from '../../../src/accessibility/context_menu/ContextMenuButton';
import ContextMenu from '../../../src/components/structures/ContextMenu';
import { _t } from '../../../src/languageHandler';

describe('ThreadPanel', () => {
    describe('Header', () => {
        it('expect that All filter for ThreadPanelHeader properly renders Show: All threads', () => {
            const wrapper = shallow(
                <ThreadPanelHeader
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined} />,
            );
            expect(wrapper).toMatchSnapshot();
        });

        it('expect that My filter for ThreadPanelHeader properly renders Show: My threads', () => {
            const wrapper = shallow(
                <ThreadPanelHeader
                    filterOption={ThreadFilterType.My}
                    setFilterOption={() => undefined} />,
            );
            expect(wrapper).toMatchSnapshot();
        });

        it('expect that ThreadPanelHeader properly opens a context menu when clicked on the button', () => {
            const wrapper = mount(
                <ThreadPanelHeader
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined} />,
            );
            const found = wrapper.find(ContextMenuButton);
            expect(found).not.toBe(undefined);
            expect(found).not.toBe(null);
            expect(wrapper.exists(ContextMenu)).toEqual(false);
            found.simulate('click');
            expect(wrapper.exists(ContextMenu)).toEqual(true);
        });

        it('expect that ThreadPanelHeader has the correct option selected in the context menu', () => {
            const wrapper = mount(
                <ThreadPanelHeader
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined} />,
            );
            wrapper.find(ContextMenuButton).simulate('click');
            const found = wrapper.find(ThreadPanelHeaderFilterOptionItem);
            expect(found.length).toEqual(2);
            const foundButton = found.find('[aria-selected=true]').first();
            expect(foundButton.text()).toEqual(`${_t("All threads")}${_t('Shows all threads from current room')}`);
            expect(foundButton).toMatchSnapshot();
        });
    });
});
