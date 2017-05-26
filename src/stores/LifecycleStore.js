/*
Copyright 2017 Vector Creations Ltd

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
import dis from '../dispatcher';
import {Store} from 'flux/utils';

/**
 * A class for storing application state to do with login/registration. This is a simple
 * flux store that listens for actions and updates its state accordingly, informing any
 * listeners (views) of state changes.
 */
class LifecycleStore extends Store {
    constructor() {
        super(dis);

        // Initialise state
        this._state = {
            deferred_action: null,
        };
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
            case 'sync_state':
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
    }
}

let singletonLifecycleStore = null;
if (!singletonLifecycleStore) {
    singletonLifecycleStore = new LifecycleStore();
}
module.exports = singletonLifecycleStore;
