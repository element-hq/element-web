/*
Copyright 2016 OpenMarket Ltd

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

/**
 * formats numbers to fit into ~3 characters, suitable for badge counts
 * e.g: 999, 9.9K, 99K, 0.9M, 9.9M, 99M, 0.9B, 9.9B
 */
export function formatCount(count) {
   if (count < 1000) return count;
   if (count < 10000) return (count / 1000).toFixed(1) + "K";
   if (count < 100000) return (count / 1000).toFixed(0) + "K";
   if (count < 10000000) return (count / 1000000).toFixed(1) + "M";
   if (count < 100000000) return (count / 1000000).toFixed(0) + "M";
   return (count / 1000000000).toFixed(1) + "B"; // 10B is enough for anyone, right? :S
}
