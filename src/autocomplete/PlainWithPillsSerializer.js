/*
Copyright 2018 New Vector Ltd

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

// Based originally on slate-plain-serializer

import { Block } from 'slate';

/**
 * Plain text serializer, which converts a Slate `value` to a plain text string,
 * serializing pills into various different formats as required.
 *
 * @type {PlainWithPillsSerializer}
 */

class PlainWithPillsSerializer {

    /*
     * @param {String} options.pillFormat - either 'md', 'plain', 'id'
     */
    constructor(options = {}) {
        let {
            pillFormat = 'plain',
        } = options;
        this.pillFormat = pillFormat;
    }

    /**
     * Serialize a Slate `value` to a plain text string,
     * serializing pills as either MD links, plain text representations or
     * ID representations as required.
     *
     * @param {Value} value
     * @return {String}
     */
    serialize = value => {
        return this._serializeNode(value.document)
    }

    /**
     * Serialize a `node` to plain text.
     *
     * @param {Node} node
     * @return {String}
     */
    _serializeNode = node => {
        if (
            node.object == 'document' ||
            (node.object == 'block' && Block.isBlockList(node.nodes))
        ) {
            return node.nodes.map(this._serializeNode).join('\n');
        }
        else if (node.type == 'emoji') {
            return node.data.get('emojiUnicode');
        } else if (node.type == 'pill') {
            switch (this.pillFormat) {
                case 'plain':
                    return node.data.get('completion');
                case 'md':
                    return `[${ node.data.get('completion') }](${ node.data.get('href') })`;
                case 'id':
                    return node.data.get('completionId') || node.data.get('completion');
            }
        }
        else if (node.nodes) {
            return node.nodes.map(this._serializeNode).join('');
        }
        else {
            return node.text;
        }
    }
}

/**
 * Export.
 *
 * @type {PlainWithPillsSerializer}
 */

export default PlainWithPillsSerializer