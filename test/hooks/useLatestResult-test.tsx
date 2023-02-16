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

import { renderHook, RenderHookResult } from "@testing-library/react-hooks/dom";

import { useLatestResult } from "../../src/hooks/useLatestResult";

// All tests use fake timers throughout, comments will show the elapsed time in ms
jest.useFakeTimers();

const mockSetter = jest.fn();

beforeEach(() => {
    mockSetter.mockClear();
});

function simulateRequest(
    hookResult: RenderHookResult<typeof useLatestResult, ReturnType<typeof useLatestResult>>["result"],
    { id, delayInMs, result }: { id: string; delayInMs: number; result: string },
) {
    const [setQuery, setResult] = hookResult.current;
    setQuery(id);
    setTimeout(() => setResult(id, result), delayInMs);
}

describe("renderhook tests", () => {
    it("should return a result", () => {
        const { result: hookResult } = renderHook(() => useLatestResult(mockSetter));

        const query = { id: "query1", delayInMs: 100, result: "result1" };
        simulateRequest(hookResult, query);

        // check we have made no calls to the setter
        expect(mockSetter).not.toHaveBeenCalled();

        // advance timer until the timeout elapses, check we have called the setter
        jest.advanceTimersToNextTimer();
        expect(mockSetter).toHaveBeenCalledTimes(1);
        expect(mockSetter).toHaveBeenLastCalledWith(query.result);
    });

    it("should not let a slower response to an earlier query overwrite the result of a later query", () => {
        const { result: hookResult } = renderHook(() => useLatestResult(mockSetter));

        const slowQuery = { id: "slowQuery", delayInMs: 500, result: "slowResult" };
        const fastQuery = { id: "fastQuery", delayInMs: 100, result: "fastResult" };

        simulateRequest(hookResult, slowQuery);
        simulateRequest(hookResult, fastQuery);

        // advance to fastQuery response, check the setter call
        jest.advanceTimersToNextTimer();
        expect(mockSetter).toHaveBeenCalledTimes(1);
        expect(mockSetter).toHaveBeenLastCalledWith(fastQuery.result);

        // advance time to slowQuery response, check the setter has _not_ been
        // called again and that the result is still from the fast query
        jest.advanceTimersToNextTimer();
        expect(mockSetter).toHaveBeenCalledTimes(1);
        expect(mockSetter).toHaveBeenLastCalledWith(fastQuery.result);
    });

    it("should return expected results when all response times similar", () => {
        const { result: hookResult } = renderHook(() => useLatestResult(mockSetter));

        const commonDelayInMs = 180;
        const query1 = { id: "q1", delayInMs: commonDelayInMs, result: "r1" };
        const query2 = { id: "q2", delayInMs: commonDelayInMs, result: "r2" };
        const query3 = { id: "q3", delayInMs: commonDelayInMs, result: "r3" };

        // ELAPSED: 0ms, no queries sent
        simulateRequest(hookResult, query1);
        jest.advanceTimersByTime(100);

        // ELAPSED: 100ms, query1 sent, no responses
        expect(mockSetter).not.toHaveBeenCalled();
        simulateRequest(hookResult, query2);
        jest.advanceTimersByTime(70);

        // ELAPSED: 170ms, query1 and query2 sent, no responses
        expect(mockSetter).not.toHaveBeenCalled();
        simulateRequest(hookResult, query3);
        jest.advanceTimersByTime(70);

        // ELAPSED: 240ms, all queries sent, responses for query1 and query2
        expect(mockSetter).not.toHaveBeenCalled();

        // ELAPSED: 360ms, all queries sent, all queries have responses
        jest.advanceTimersByTime(120);
        expect(mockSetter).toHaveBeenLastCalledWith(query3.result);
    });

    it("should prevent out of order results", () => {
        const { result: hookResult } = renderHook(() => useLatestResult(mockSetter));

        const query1 = { id: "q1", delayInMs: 0, result: "r1" };
        const query2 = { id: "q2", delayInMs: 50, result: "r2" };
        const query3 = { id: "q3", delayInMs: 1, result: "r3" };

        // ELAPSED: 0ms, no queries sent
        simulateRequest(hookResult, query1);
        jest.advanceTimersByTime(5);

        // ELAPSED: 5ms, query1 sent, response from query1
        expect(mockSetter).toHaveBeenCalledTimes(1);
        expect(mockSetter).toHaveBeenLastCalledWith(query1.result);
        simulateRequest(hookResult, query2);
        jest.advanceTimersByTime(5);

        // ELAPSED: 10ms, query1 and query2 sent, response from query1
        simulateRequest(hookResult, query3);
        jest.advanceTimersByTime(5);

        // ELAPSED: 15ms, all queries sent, responses from query1 and query3
        expect(mockSetter).toHaveBeenCalledTimes(2);
        expect(mockSetter).toHaveBeenLastCalledWith(query3.result);

        // ELAPSED: 65ms, all queries sent, all queries have responses
        // so check that the result is still from query3, not query2
        jest.advanceTimersByTime(50);
        expect(mockSetter).toHaveBeenLastCalledWith(query3.result);
    });
});
