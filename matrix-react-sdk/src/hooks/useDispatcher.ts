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

import { useEffect, useRef } from "react";

import { ActionPayload } from "../dispatcher/payloads";
import { MatrixDispatcher } from "../dispatcher/dispatcher";

// Hook to simplify listening to event dispatches
export const useDispatcher = (dispatcher: MatrixDispatcher, handler: (payload: ActionPayload) => void): void => {
    // Create a ref that stores handler
    const savedHandler = useRef((payload: ActionPayload) => {});

    // Update ref.current value if handler changes.
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(() => {
        // Create event listener that calls handler function stored in ref
        const ref = dispatcher.register((payload) => savedHandler.current(payload));
        // Remove event listener on cleanup
        return () => {
            dispatcher.unregister(ref);
        };
    }, [dispatcher]);
};
