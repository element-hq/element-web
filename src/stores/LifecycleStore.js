/*
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import dis from '../dispatcher/dispatcher';
import {Store} from 'flux/utils';

const INITIAL_STATE = {
    deferred_action: null,
};

/**
 * A class for storing application state to do with authentication. This is a simple flux
 * store that listens for actions and updates its state accordingly, informing any
 * listeners (views) of state changes.
 */
class LifecycleStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = INITIAL_STATE;
    }

    _setState(newState) {
        this._state = Object.assign(this._state, newState);
        this.__emitChange();
    }

    __onDispatch(payload) {
        switch (payload.action) {
            case 'do_after_sync_prepared':
                this._setState({
                    deferred_action: payload.deferred_action,
                });
                break;
            case 'cancel_after_sync_prepared':
                this._setState({
                    deferred_action: null,
                });
                break;
            case 'sync_state': {
                if (payload.state !== 'PREPARED') {
                    break;
                }
                if (!this._state.deferred_action) break;
                const deferredAction = Object.assign({}, this._state.deferred_action);
                this._setState({
                    deferred_action: null,
                });
                dis.dispatch(deferredAction);
                break;
            }
            case 'on_client_not_viable':
            case 'on_logged_out':
                this.reset();
                break;
        }
    }

    reset() {
        this._state = Object.assign({}, INITIAL_STATE);
    }
}

let singletonLifecycleStore = null;
if (!singletonLifecycleStore) {
    singletonLifecycleStore = new LifecycleStore();
}
export default singletonLifecycleStore;
