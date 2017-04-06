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

// The prescribed way of doing this import would be:
//import {IndexedDbStoreWorker} from 'matrix-js-sdk';
// However, this still pulls in all of the js-sdk and we only use a tiny fraction
// of it. It also causes an Olm error to appear because we don't have an Olm in scope.
// Instead, we do this:
import IndexedDbStoreWorker from 'matrix-js-sdk/lib/store/indexeddb-remote-worker';

const remoteWorker = new IndexedDbStoreWorker(postMessage);

onmessage = remoteWorker.onMessage;
