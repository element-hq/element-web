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

import {
    localStorageErrorsEventsEmitter,
    LocalStorageErrors,
} from 'matrix-js-sdk/src/store/local-storage-events-emitter';

const ls = window.localStorage;

const isQuotaExceededError = (e: Error) => {
    return e instanceof DOMException && (
        // everything except Firefox
        e.code === 22 ||
        // Firefox
        e.code === 1014 ||
        // test name field too, because code might not be present
        // everything except Firefox
        e.name === 'QuotaExceededError' ||
        // Firefox
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
        // acknowledge QuotaExceededError only if there's something already stored
        (ls && ls.length !== 0);
};

if (ls) {
    /**
     * Because we've been saving a lot of additional logger data in the localStorage for no particular reason
     * we need to, hopefully, unbrick user's devices by geting rid of unnecessary data.
     * TODO: Remove it when all users have successfully upgraded
     * */
    Object.keys(ls).forEach(key => {
        if (key.indexOf('loglevel:') === 0) {
            ls.removeItem(key);
        }
    });
    // This file is a crude attempt at fixing global localstorage errors all over the app.
    const { setItem, getItem, removeItem, clear } = ls;
    ls.setItem = (key: string, item: string) => {
        try {
            return setItem.call(ls, key, item);
        } catch (e) {
            localStorageErrorsEventsEmitter.emit(LocalStorageErrors.Global, e);
            localStorageErrorsEventsEmitter.emit(LocalStorageErrors.SetItemError, e);
            if (isQuotaExceededError(e)) {
                localStorageErrorsEventsEmitter.emit(LocalStorageErrors.QuotaExceededError, e);
            }
        }
    };
    ls.getItem = (key: string) => {
        try {
            return getItem.call(ls, key);
        } catch (e) {
            localStorageErrorsEventsEmitter.emit(LocalStorageErrors.Global, e);
            localStorageErrorsEventsEmitter.emit(LocalStorageErrors.GetItemError, e);
            if (isQuotaExceededError(e)) {
                localStorageErrorsEventsEmitter.emit(LocalStorageErrors.QuotaExceededError, e);
            }
        }
    };
    ls.removeItem = (key: string) => {
        try {
            return removeItem.call(ls, key);
        } catch (e) {
            localStorageErrorsEventsEmitter.emit(LocalStorageErrors.Global, e);
            localStorageErrorsEventsEmitter.emit(LocalStorageErrors.RemoveItemError, e);
            if (isQuotaExceededError(e)) {
                localStorageErrorsEventsEmitter.emit(LocalStorageErrors.QuotaExceededError, e);
            }
            throw e;
        }
    };
    ls.clear = () => {
        return clear.call(ls);
    };
}
