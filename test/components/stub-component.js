/* A dummy React component which we use for stubbing out app-level components
 */

import React from 'react';

export default function({displayName = "StubComponent", render} = {}) {
    if (!render) {
        render = function() {
            return <div>{ displayName }</div>;
        };
    }

    return class extends React.Component {
        static displayName = displayName;

        render() {
            return render();
        }
    };
}
