#!/usr/bin/perl

use strict;
use warnings;
use Cwd 'abs_path';

# script which checks how out of sync the i18ns are drifting

# example i18n format:
#   "%(oneUser)sleft": "%(oneUser)sleft",

$|=1;

$0 =~ /^(.*\/)/;
my $i18ndir = abs_path($1."/../src/i18n/strings");
my $en = read_i18n($i18ndir."/en_EN.json");

opendir(DIR, $i18ndir) || die $!;
my @files = readdir(DIR);
closedir(DIR);
foreach my $lang (grep { -f "$i18ndir/$_" && !/en_EN\.json/ } @files) {
    print "\nChecking $lang\n";

    my $map = read_i18n($i18ndir."/".$lang);
    my $count = 0;

    foreach my $k (sort keys %$map) {
        if ($en->{$k}) {
            if ($map->{$k} eq $k) {
                printf ("%10s %24s\t%s\n", $lang, "Untranslated string?", "$k");
            }
            $count++;
        }
        else {
            if ($en->{$k . "."}) {
                printf ("%10s %24s\t%s\n", $lang, "en_EN has fullstop!", "$k");
                next;
            }

            $k =~ /^(.*)\.?$/;
            if ($en->{$1}) {
                printf ("%10s %24s\t%s\n", $lang, "en_EN lacks fullstop!", "$k");
                next;
            }

            printf ("%10s %24s\t%s\n", $lang, "Not present in en_EN", "$k");
        }
    }

    printf ("$count/" . (scalar keys %$en) . " strings translated\n");
}

sub read_i18n {
    my $path = shift;
    my $map = {};

    open(FILE, "<", $path) || die $!;
    while(<FILE>) {
        if ($_ =~ m/^(\s+)"(.*?)"(: *)"(.*?)"(,?)$/) {
            my ($indent, $src, $colon, $dst, $comma) = ($1, $2, $3, $4, $5);

            $map->{$src} = $dst;
        }
    }
    close(FILE);

    return $map;
}