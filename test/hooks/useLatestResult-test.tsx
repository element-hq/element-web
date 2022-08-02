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
import React, { useEffect, useState } from "react";
import { act } from "react-dom/test-utils";

import { useLatestResult } from "../../src/hooks/useLatestResult";

function LatestResultsComponent({ query, doRequest }) {
    const [value, setValueInternal] = useState<number>(0);
    const [updateQuery, updateResult] = useLatestResult(setValueInternal);
    useEffect(() => {
        updateQuery(query);
        doRequest(query).then(it => {
            updateResult(query, it);
        });
    }, [doRequest, query, updateQuery, updateResult]);

    return <div>
        { value }
    </div>;
}

describe("useLatestResult", () => {
    it("should return results", async () => {
        const doRequest = async (query) => {
            await sleep(20);
            return query;
        };

        const wrapper = mount(<LatestResultsComponent query={0} doRequest={doRequest} />);
        await act(async () => {
            await sleep(25);
        });
        expect(wrapper.text()).toEqual("0");
        wrapper.setProps({ doRequest, query: 1 });
        await act(async () => {
            await sleep(10);
        });
        wrapper.setProps({ doRequest, query: 2 });
        await act(async () => {
            await sleep(10);
        });
        expect(wrapper.text()).toEqual("0");
        await act(async () => {
            await sleep(15);
        });
        expect(wrapper.text()).toEqual("2");
    });

    it("should prevent out-of-order results", async () => {
        const doRequest = async (query) => {
            await sleep(query);
            return query;
        };

        const wrapper = mount(<LatestResultsComponent query={0} doRequest={doRequest} />);
        await act(async () => {
            await sleep(5);
        });
        expect(wrapper.text()).toEqual("0");
        wrapper.setProps({ doRequest, query: 50 });
        await act(async () => {
            await sleep(5);
        });
        wrapper.setProps({ doRequest, query: 1 });
        await act(async () => {
            await sleep(5);
        });
        expect(wrapper.text()).toEqual("1");
        await act(async () => {
            await sleep(50);
        });
        expect(wrapper.text()).toEqual("1");
    });
});
