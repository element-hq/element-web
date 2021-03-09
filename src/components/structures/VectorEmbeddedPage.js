/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 New Vector Ltd

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

import EmbeddedPage from 'matrix-react-sdk/src/components/structures/EmbeddedPage';
import sanitizeHtml from 'sanitize-html';
import { _t } from 'matrix-react-sdk/src/languageHandler';

export default class VectorEmbeddedPage extends EmbeddedPage {
    static replaces = 'EmbeddedPage';

    // we're overriding the base component here, for Element-specific tweaks
    translate(s) {
        s = sanitizeHtml(_t(s));
        // ugly fix for https://github.com/vector-im/element-web/issues/4243
        // eslint-disable-next-line max-len
        s = s.replace(/\[matrix\]/, '<a href="https://matrix.org" target="_blank" rel="noreferrer noopener"><img width="79" height="34" alt="Matrix" style="padding-left: 1px;vertical-align: middle" src="welcome/images/matrix.svg"/></a>');
        return s;
    }
}
