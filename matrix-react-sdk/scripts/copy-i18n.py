#!/usr/bin/env python

import json
import sys
import os

if len(sys.argv) < 3:
    print "Usage: %s <source> <dest>" % (sys.argv[0],)
    print "eg. %s pt_BR.json pt.json" % (sys.argv[0],)
    print
    print "Adds any translations to <dest> that exist in <source> but not <dest>"
    sys.exit(1)

srcpath = sys.argv[1]
dstpath = sys.argv[2]
tmppath = dstpath + ".tmp"

with open(srcpath) as f:
    src = json.load(f)

with open(dstpath) as f:
    dst = json.load(f)

toAdd = {}
for k,v in src.iteritems():
    if k not in dst:
        print "Adding %s" % (k,)
        toAdd[k] = v

# don't just json.dumps as we'll probably re-order all the keys (and they're
# not in any given order so we can't just sort_keys). Append them to the end.
with open(dstpath) as ifp:
    with open(tmppath, 'w') as ofp:
        for line in ifp:
            strippedline = line.strip()
            if strippedline in ('{', '}'):
                ofp.write(line)
            elif strippedline.endswith(','):
                ofp.write(line)
            else:
                ofp.write('    '+strippedline+',')
                toAddStr = json.dumps(toAdd, indent=4, separators=(',', ': '), ensure_ascii=False, encoding="utf8").strip("{}\n")
                ofp.write("\n")
                ofp.write(toAddStr.encode('utf8'))
                ofp.write("\n")

os.rename(tmppath, dstpath)
