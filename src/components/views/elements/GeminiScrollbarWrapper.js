/*
Copyright 2018 New Vector Ltd.

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

import React from 'react';
import GeminiScrollbar from 'react-gemini-scrollbar';

class GeminiScrollbarWrapper extends React.Component {
    render() {
        // Enable forceGemini so that gemini is always enabled. This is
        // to avoid future issues where a feature is implemented without
        // doing QA on every OS/browser combination.
        //
        // By default GeminiScrollbar allows native scrollbars to be used
        // on macOS. Use forceGemini to enable Gemini's non-native
        // scrollbars on all OSs.
        return <GeminiScrollbar ref={this.props.wrappedRef} forceGemini={true} {...this.props}>
            { this.props.children }
        </GeminiScrollbar>;
    }
}

export default GeminiScrollbarWrapper;

