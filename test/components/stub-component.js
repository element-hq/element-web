/* A dummy React component which we use for stubbing out app-level components
 */

import React from 'react';
import createReactClass from 'create-react-class';

export default function(opts) {
    opts = opts || {};
    if (!opts.displayName) {
        opts.displayName = 'StubComponent';
    }

    if (!opts.render) {
        opts.render = function() {
            return <div>{ this.displayName }</div>;
        };
    }

    return createReactClass(opts);
}
