/*
Copyright 2020 New Vector Ltd

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

import "modernizr";
import {Renderer} from "react-dom";

declare global {
    interface Window {
        Modernizr: ModernizrAPI & FeatureDetects;
        Olm: {
            init: () => Promise<void>;
        };

        mxSendRageshake: (text: string, withLogs?: boolean) => void;
        matrixChat: ReturnType<Renderer>;

        // electron-only
        ipcRenderer: any;
    }

    // workaround for https://github.com/microsoft/TypeScript/issues/30933
    interface ObjectConstructor {
        fromEntries?(xs: [string|number|symbol, any][]): object
    }
}
