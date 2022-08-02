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

// eslint-disable-next-line deprecate/import
import { mount } from "enzyme";
import { sleep } from "matrix-js-sdk/src/utils";
import React from "react";
import { act } from "react-dom/test-utils";

import { useDebouncedCallback } from "../../src/hooks/spotlight/useDebouncedCallback";

function DebouncedCallbackComponent({ enabled, params, callback }) {
    useDebouncedCallback(enabled, callback, params);
    return <div>
        { JSON.stringify(params) }
    </div>;
}

describe("useDebouncedCallback", () => {
    it("should be able to handle empty parameters", async () => {
        const params = [];
        const callback = jest.fn();

        const wrapper = mount(<DebouncedCallbackComponent callback={callback} enabled={true} params={[]} />);
        await act(async () => {
            await sleep(1);
            wrapper.setProps({ enabled: true, params, callback });
            return act(() => sleep(500));
        });

        expect(wrapper.text()).toContain(JSON.stringify(params));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should call the callback with the parameters", async () => {
        const params = ["USER NAME"];
        const callback = jest.fn();

        const wrapper = mount(<DebouncedCallbackComponent callback={callback} enabled={true} params={[]} />);
        await act(async () => {
            await sleep(1);
            wrapper.setProps({ enabled: true, params, callback });
            return act(() => sleep(500));
        });

        expect(wrapper.text()).toContain(JSON.stringify(params));
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(...params);
    });

    it("should handle multiple parameters", async () => {
        const params = [4, 8, 15, 16, 23, 42];
        const callback = jest.fn();

        const wrapper = mount(<DebouncedCallbackComponent callback={callback} enabled={true} params={[]} />);
        await act(async () => {
            await sleep(1);
            wrapper.setProps({ enabled: true, params, callback });
            return act(() => sleep(500));
        });

        expect(wrapper.text()).toContain(JSON.stringify(params));
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(...params);
    });

    it("should debounce quick changes", async () => {
        const queries = [
            "U",
            "US",
            "USE",
            "USER",
            "USER ",
            "USER N",
            "USER NM",
            "USER NMA",
            "USER NM",
            "USER N",
            "USER NA",
            "USER NAM",
            "USER NAME",
        ];
        const callback = jest.fn();

        const wrapper = mount(<DebouncedCallbackComponent callback={callback} enabled={true} params={[]} />);
        await act(async () => {
            await sleep(1);
            for (const query of queries) {
                wrapper.setProps({ enabled: true, params: [query], callback });
                await sleep(50);
            }
            return act(() => sleep(500));
        });

        const query = queries[queries.length - 1];
        expect(wrapper.text()).toContain(JSON.stringify(query));
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(query);
    });

    it("should not debounce slow changes", async () => {
        const queries = [
            "U",
            "US",
            "USE",
            "USER",
            "USER ",
            "USER N",
            "USER NM",
            "USER NMA",
            "USER NM",
            "USER N",
            "USER NA",
            "USER NAM",
            "USER NAME",
        ];
        const callback = jest.fn();

        const wrapper = mount(<DebouncedCallbackComponent callback={callback} enabled={true} params={[]} />);
        await act(async () => {
            await sleep(1);
            for (const query of queries) {
                wrapper.setProps({ enabled: true, params: [query], callback });
                await sleep(200);
            }
            return act(() => sleep(500));
        });

        const query = queries[queries.length - 1];
        expect(wrapper.text()).toContain(JSON.stringify(query));
        expect(callback).toHaveBeenCalledTimes(queries.length);
        expect(callback).toHaveBeenCalledWith(query);
    });

    it("should not call the callback if it’s disabled", async () => {
        const queries = [
            "U",
            "US",
            "USE",
            "USER",
            "USER ",
            "USER N",
            "USER NM",
            "USER NMA",
            "USER NM",
            "USER N",
            "USER NA",
            "USER NAM",
            "USER NAME",
        ];
        const callback = jest.fn();

        const wrapper = mount(<DebouncedCallbackComponent callback={callback} enabled={false} params={[]} />);
        await act(async () => {
            await sleep(1);
            for (const query of queries) {
                wrapper.setProps({ enabled: false, params: [query], callback });
                await sleep(200);
            }
            return act(() => sleep(500));
        });

        const query = queries[queries.length - 1];
        expect(wrapper.text()).toContain(JSON.stringify(query));
        expect(callback).toHaveBeenCalledTimes(0);
    });
});
