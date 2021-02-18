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

import defaultDispatcher from "../dispatcher/dispatcher";
import {AsyncStore} from "./AsyncStore";
import {ActionPayload} from "../dispatcher/payloads";

interface IState {
    hostSignupActive?: boolean;
}

export class HostSignupStore extends AsyncStore<IState> {
    private static internalInstance = new HostSignupStore();

    private constructor() {
        super(defaultDispatcher, {hostSignupActive: false});
    }

    public static get instance(): HostSignupStore {
        return HostSignupStore.internalInstance;
    }

    public get isHostSignupActive(): boolean {
        return this.state.hostSignupActive;
    }

    public async setHostSignupActive(status: boolean) {
        return this.updateState({
            hostSignupActive: status,
        });
    }

    protected onDispatch(payload: ActionPayload) {
        // Nothing to do
    }
}
