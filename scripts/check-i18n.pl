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
my $srcdir = abs_path($1."/../src");

my $en = read_i18n($i18ndir."/en_EN.json");

my $src_strings = read_src_strings($srcdir);
my $src = {};

print "Checking strings in src\n";
foreach my $tuple (@$src_strings) {
    my ($s, $file) = (@$tuple);
    $src->{$s} = $file;
    if (!$en->{$s}) {
        if ($en->{$s . '.'}) {
            printf ("%50s %24s\t%s\n", $file, "en_EN has fullstop!", $s);
        }
        else {
            $s =~ /^(.*)\.?$/;
            if ($en->{$1}) {
                printf ("%50s %24s\t%s\n", $file, "en_EN lacks fullstop!", $s);
            }
            else {
                printf ("%50s %24s\t%s\n", $file, "Translation missing!", $s);
            }
        }
    }
}

print "\nChecking en_EN\n";
my $count = 0;
my $remaining_src = {};
foreach (keys %$src) { $remaining_src->{$_}++ };

foreach my $k (sort keys %$en) {
    # crappy heuristic to ignore country codes for now...
    next if ($k =~ /^(..|..-..)$/);

    if ($en->{$k} ne $k) {
        printf ("%50s %24s\t%s\n", "en_EN", "en_EN is not symmetrical", $k);
    }

    if (!$src->{$k}) {
        if ($src->{$k. '.'}) {
            printf ("%50s %24s\t%s\n", $src->{$k. '.'}, "src has fullstop!", $k);
        }
        else {
            $k =~ /^(.*)\.?$/;
            if ($src->{$1}) {
                printf ("%50s %24s\t%s\n", $src->{$1}, "src lacks fullstop!", $k);                
            }
            else {
                printf ("%50s %24s\t%s\n", '???', "Not present in src?", $k);
            }
        }
    }
    else {
        $count++;
        delete $remaining_src->{$k};
    }
}
printf ("$count/" . (scalar keys %$src) . " strings found in src are present in en_EN\n");
foreach (keys %$remaining_src) {
    print "missing: $_\n";
}

opendir(DIR, $i18ndir) || die $!;
my @files = readdir(DIR);
closedir(DIR);
foreach my $lang (grep { -f "$i18ndir/$_" && !/(basefile|en_EN)\.json/ } @files) {
    print "\nChecking $lang\n";

    my $map = read_i18n($i18ndir."/".$lang);
    my $count = 0;

    my $remaining_en = {};
    foreach (keys %$en) { $remaining_en->{$_}++ };

    foreach my $k (sort keys %$map) {
        {
            no warnings 'uninitialized';
            my $vars = {};
            while ($k =~ /%\((.*?)\)s/g) {
                $vars->{$1}++;
            }
            while ($map->{$k} =~ /%\((.*?)\)s/g) {
                $vars->{$1}--;
            }
            foreach my $var (keys %$vars) {
                if ($vars->{$var} != 0) {
                    printf ("%10s %24s\t%s\n", $lang, "Broken var ($var)s", $k);
                }
            }
        }

        if ($en->{$k}) {
            if ($map->{$k} eq $k) {
                printf ("%10s %24s\t%s\n", $lang, "Untranslated string?", $k);
            }
            $count++;
            delete $remaining_en->{$k};
        }
        else {
            if ($en->{$k . "."}) {
                printf ("%10s %24s\t%s\n", $lang, "en_EN has fullstop!", $k);
                next;
            }

            $k =~ /^(.*)\.?$/;
            if ($en->{$1}) {
                printf ("%10s %24s\t%s\n", $lang, "en_EN lacks fullstop!", $k);
                next;
            }

            printf ("%10s %24s\t%s\n", $lang, "Not present in en_EN", $k);
        }
    }

    if (scalar keys %$remaining_en < 100) {
        foreach (keys %$remaining_en) {
            printf ("%10s %24s\t%s\n", $lang, "Not yet translated", $_);
        }
    }

    printf ("$count/" . (scalar keys %$en) . " strings translated\n");
}

sub read_i18n {
    my $path = shift;
    my $map = {};
    $path =~ /.*\/(.*)$/;
    my $lang = $1;

    open(FILE, "<", $path) || die $!;
    while(<FILE>) {
        if ($_ =~ m/^(\s+)"(.*?)"(: *)"(.*?)"(,?)$/) {
            my ($indent, $src, $colon, $dst, $comma) = ($1, $2, $3, $4, $5);
            $src =~ s/\\"/"/g;
            $dst =~ s/\\"/"/g;

            if ($map->{$src}) {
                printf ("%10s %24s\t%s\n", $lang, "Duplicate translation!", $src);
            }
            $map->{$src} = $dst;
        }
    }
    close(FILE);

    return $map;
}

sub read_src_strings {
    my $path = shift;

    use File::Find;
    use File::Slurp;

    my $strings = [];

    my @files;
    find( sub { push @files, $File::Find::name if (-f $_ && /\.jsx?$/) }, $path );
    foreach my $file (@files) {
        my $src = read_file($file);
        $src =~ s/'\s*\+\s*'//g;
        $src =~ s/"\s*\+\s*"//g;

        $file =~ s/^.*\/src/src/;
        while ($src =~ /_t(?:Jsx)?\(\s*'(.*?[^\\])'/sg) {
            my $s = $1;
            $s =~ s/\\'/'/g;
            push @$strings, [$s, $file];
        }
        while ($src =~ /_t(?:Jsx)?\(\s*"(.*?[^\\])"/sg) {
            push @$strings, [$1, $file];
        }
    }

    return $strings;
}