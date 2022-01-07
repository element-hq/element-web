#!/usr/bin/perl -pi

# pass in a list of filenames whose imports should be fixed up to be relative
# to matrix-react-sdk rather than vector-web.
# filenames must be relative to src/ - e.g. ./components/moo/Moo.js

# run with something like:
# sierra:src matthew$ grep -ril 'require(.matrix-react-sdk' . | xargs ../scripts/fixup-imports.pl 
# sierra:src matthew$ grep -ril 'import.*matrix-react-sdk' . | xargs ../scripts/fixup-imports.pl 

# e.g. turning:
# var rate_limited_func = require('matrix-react-sdk/lib/ratelimitedfunc');
#
# into:
# const rate_limited_func = require('../../ratelimitedfunc'); 
#
# ...if the current file is two levels deep inside lib.

$depth = () = $ARGV =~ m#/#g;
$depth--;
$prefix = $depth > 0 ? ('../' x $depth) : './';

s/= require\(['"]matrix-react-sdk\/lib\/(.*?)['"]\)/= require('$prefix$1')/;
s/= require\(['"]matrix-react-sdk['"]\)/= require('${prefix}index')/;

s/^(import .* from )['"]matrix-react-sdk\/lib\/(.*?)['"]/$1'$prefix$2'/;
s/^(import .* from )['"]matrix-react-sdk['"]/$1'${prefix}index'/;
