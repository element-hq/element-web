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

import {Dispatch, SetStateAction, useCallback, useEffect, useState} from "react";

const getValue = <T>(key: string, initialValue: T): T => {
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
    } catch (error) {
        return initialValue;
    }
};

// Hook behaving like useState but persisting the value to localStorage. Returns same as useState
export const useLocalStorageState = <T>(key: string, initialValue: T) => {
    const lsKey = "mx_" + key;

    const [value, setValue] = useState<T>(getValue(lsKey, initialValue));

    useEffect(() => {
        setValue(getValue(lsKey, initialValue));
    }, [lsKey, initialValue]);

    const _setValue: Dispatch<SetStateAction<T>> = useCallback((v: T) => {
        window.localStorage.setItem(lsKey, JSON.stringify(v));
        setValue(v);
    }, [lsKey]);

    return [value, _setValue];
};
